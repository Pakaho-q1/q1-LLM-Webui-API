import { useCallback, useRef } from 'react';
import {
  API_BASE,
  apiFetch,
  fileToDataUrl,
  OpenAIChatMessage,
  streamOpenAIChatCompletion,
  transcribeAudioFile,
  uploadOpenAIFile,
} from '@/services/api.service';
import { useSSE } from '@/contexts/SSEContext';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKey } from '@/services/dataClient';
import { useSystemStore } from '@/services/system.store';
import { emitTelemetryEvent } from '@/services/telemetry';
import {
  Attachment,
  InternalMessage,
  useChatStore,
} from '../store/chat.store';
import { ChatStreamMetrics } from '@/types/chat.types';

const toOpenAIMessage = (message: InternalMessage): OpenAIChatMessage => ({
  role: message.role,
  content: message.content,
});

export const useChat = () => {
  const DEFAULT_NEW_SESSION_TITLE = 'New Chat';
  const streamAbortRef = useRef<AbortController | null>(null);
  const { currentConversation, setCurrentConversation } = useSSE();
  const queryClient = useQueryClient();
  const pushToast = useSystemStore((state) => state.pushToast);
  const currentProvider = useSystemStore((state) => state.currentProvider);

  const {
    messages,
    isGenerating,
    chatError,
    pushMessage,
    removeMessageById,
    appendAssistantChunk,
    updateAssistantMetrics,
    setGenerating,
    setChatError,
    stopAssistantTyping,
    clearMessages,
  } = useChatStore();

  const idRef = useRef(0);
  const createId = () => `msg-${Date.now()}-${idRef.current++}`;
  const buildPersistentFileUrl = (fileId: string): string => {
    return `${API_BASE}/v1/files/${encodeURIComponent(fileId)}/content`;
  };
  const buildTitleFromFirstSentence = (text: string): string => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return 'New Chat';
    const sentence = clean.split(/[.!?]\s+/)[0] || clean;
    return sentence.slice(0, 80).trim() || 'New Chat';
  };

  const stopGeneration = useCallback(async () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;

    setGenerating(false);
    stopAssistantTyping();
  }, [setGenerating, stopAssistantTyping]);

  const sendMessage = useCallback(
    async (
      text: string,
      files: File[] = [],
      params: Record<string, unknown> = {},
      systemPrompt = '',
      model?: string,
    ) => {
      if ((!text.trim() && files.length === 0) || isGenerating) return;

      let userMessageId: string | null = null;
      let assistantMessageId: string | null = null;
      let shouldAutoRenameAfterSuccess = false;
      let pendingAutoTitle = '';
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const streamStartedAt = performance.now();
      let streamChunkCount = 0;
      let streamChars = 0;
      try {
        setChatError(null);
        let conversationId = currentConversation;
        const attachments: Attachment[] | undefined =
          files.length > 0
            ? files.map((file) => ({
                url: URL.createObjectURL(file),
                type: file.type,
                name: file.name,
                file,
              }))
            : undefined;

        const userMsg: InternalMessage = {
          id: createId(),
          role: 'user',
          content: text,
          attachments,
        };
        assistantMessageId = createId();
        userMessageId = userMsg.id;
        const assistantPlaceholder: InternalMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          isTyping: true,
          metrics: {
            prompt_tokens: 0,
            prompt_processing_time_ms: 0,
            prompt_tokens_per_sec: 0,
            generated_tokens: 0,
            generation_time_ms: 0,
            generation_tokens_per_sec: 0,
            total_time_ms: 0,
          },
        };

        setGenerating(true);
        pushMessage(userMsg);
        pushMessage(assistantPlaceholder);

        if (!conversationId) {
          // Create with a neutral title first. First auto-rename is applied only
          // after the first successful backend response to keep state consistent.
          pendingAutoTitle = buildTitleFromFirstSentence(text);
          const created = await apiFetch<{ data?: { id?: string } }>('/sessions', {
            method: 'POST',
            body: JSON.stringify({ title: DEFAULT_NEW_SESSION_TITLE }),
          });
          conversationId = created?.data?.id || null;
          if (!conversationId) {
            throw new Error('Failed to create new chat session');
          }
          shouldAutoRenameAfterSuccess =
            pendingAutoTitle.length > 0 &&
            pendingAutoTitle !== DEFAULT_NEW_SESSION_TITLE;
          setCurrentConversation?.(conversationId);
          localStorage.setItem('v1_last_session_id', conversationId);
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        }

        let history = useChatStore
          .getState()
          .messages.map((m) => toOpenAIMessage(m));

        if (systemPrompt.trim()) {
          history = [{ role: 'system', content: systemPrompt }, ...history];
        }

        const uploadedAttachmentsMeta: Array<{
          file_id: string;
          name: string;
          type: string;
          url: string;
          is_image: boolean;
        }> = [];
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        if (text.trim()) {
          contentParts.push({ type: 'text', text: text.trim() });
        }

        for (const file of files) {
          const uploaded = await uploadOpenAIFile(file, 'user_data');
          const persistentUrl = buildPersistentFileUrl(uploaded.id);
          uploadedAttachmentsMeta.push({
            file_id: uploaded.id,
            name: file.name,
            type: file.type,
            url: persistentUrl,
            is_image: file.type.startsWith('image/'),
          });

          if (file.type.startsWith('image/')) {
            const dataUrl = await fileToDataUrl(file);
            contentParts.push({
              type: 'image_url',
              image_url: { url: dataUrl },
            });
            continue;
          }

          if (file.type.startsWith('audio/')) {
            try {
              const transcript = await transcribeAudioFile(file);
              if (transcript.trim()) {
                contentParts.push({
                  type: 'text',
                  text: `[Audio transcript: ${transcript.trim()}]`,
                });
              }
            } catch {
              contentParts.push({
                type: 'text',
                text: `[Audio attached but transcription failed: ${file.name}]`,
              });
            }
          }
        }

        history[history.length - 1] = {
          role: 'user',
          content: contentParts.length > 0 ? contentParts : text,
        };

        const abortController = new AbortController();
        streamAbortRef.current = abortController;
        const telemetryConversationId = conversationId || 'unknown';
        emitTelemetryEvent({
          name: 'chat_stream_start',
          request_id: requestId,
          conversation_id: telemetryConversationId,
          provider: currentProvider,
          model: model || undefined,
        });

        const requestPayload: Record<string, unknown> = {
          messages: history,
          stream: true,
          conversation_id: conversationId,
          request_id: requestId,
          ...params,
          params: {
            ...(params || {}),
            _user_message_metadata: {
              attachments: uploadedAttachmentsMeta,
            },
            _message_ids: {
              user_message_id: userMsg.id,
              assistant_message_id: assistantMessageId,
            },
          },
        };
        if (model && model.trim()) {
          requestPayload.model = model.trim();
        }

        await streamOpenAIChatCompletion(
          requestPayload,
          {
            signal: abortController.signal,
            onDelta: (chunk) => {
              streamChunkCount += 1;
              streamChars += chunk.length;
              appendAssistantChunk(chunk, assistantMessageId || undefined);
            },
            onMetrics: (metrics: ChatStreamMetrics) => {
              updateAssistantMetrics(metrics, assistantMessageId || undefined);
            },
            onWarnings: ({ unsupportedParams, invalidParams }) => {
              if (unsupportedParams.length > 0) {
                pushToast(
                  `Unsupported params: ${unsupportedParams.join(', ')}`,
                  'warning',
                  5000,
                );
              }
              if (invalidParams.length > 0) {
                pushToast(
                  `Invalid param values: ${invalidParams.join(', ')}`,
                  'warning',
                  5000,
                );
              }
            },
            onDone: () => {
              emitTelemetryEvent({
                name: 'chat_stream_done',
                request_id: requestId,
                conversation_id: telemetryConversationId,
                provider: currentProvider,
                duration_ms: Math.round(performance.now() - streamStartedAt),
                chunks: streamChunkCount,
                chars: streamChars,
              });
              setGenerating(false);
              stopAssistantTyping(assistantMessageId || undefined);
              streamAbortRef.current = null;
            },
          },
        );

        if (shouldAutoRenameAfterSuccess && conversationId) {
          await apiFetch(`/sessions/${encodeURIComponent(conversationId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: pendingAutoTitle }),
          });
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        }
      } catch (err) {
        emitTelemetryEvent({
          name: 'chat_stream_error',
          request_id: requestId,
          conversation_id: currentConversation || 'unknown',
          provider: currentProvider,
          duration_ms: Math.round(performance.now() - streamStartedAt),
          error_name: err instanceof Error ? err.name : 'Error',
          error_message: err instanceof Error ? err.message : 'Failed to send',
        });
        if (userMessageId) removeMessageById(userMessageId);
        if (assistantMessageId) removeMessageById(assistantMessageId);
        setChatError(err instanceof Error ? err.message : 'Failed to send');
        setGenerating(false);
        streamAbortRef.current = null;
      }
    },
    [
      appendAssistantChunk,
      updateAssistantMetrics,
      currentConversation,
      currentProvider,
      isGenerating,
      pushMessage,
      removeMessageById,
      setCurrentConversation,
      DEFAULT_NEW_SESSION_TITLE,
      queryClient,
      pushToast,
      setGenerating,
      setChatError,
      stopAssistantTyping,
    ],
  );

  const clearError = useCallback(() => setChatError(null), [setChatError]);

  return {
    isConnected: true,
    messages,
    isGenerating,
    error: chatError,
    sendMessage,
    stopGeneration,
    clearMessages,
    clearError,
  };
};
