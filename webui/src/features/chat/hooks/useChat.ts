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
import {
  Attachment,
  InternalMessage,
  useChatStore,
} from '../store/chat.store';

const toOpenAIMessage = (message: InternalMessage): OpenAIChatMessage => ({
  role: message.role,
  content: message.content,
});

export const useChat = () => {
  const DEFAULT_NEW_SESSION_TITLE = 'New Chat';
  const streamAbortRef = useRef<AbortController | null>(null);
  const { currentConversation, setCurrentConversation } = useSSE();

  const {
    messages,
    isGenerating,
    chatError,
    pushMessage,
    removeMessageById,
    appendAssistantChunk,
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
      model = 'gpt-4o-mini',
    ) => {
      if ((!text.trim() && files.length === 0) || isGenerating) return;

      let userMessageId: string | null = null;
      let shouldAutoRenameAfterSuccess = false;
      let pendingAutoTitle = '';
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
        userMessageId = userMsg.id;

        setGenerating(true);
        pushMessage(userMsg);

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

        await streamOpenAIChatCompletion(
          {
            model,
            messages: history,
            stream: true,
            conversation_id: conversationId,
            ...params,
            params: {
              ...(params || {}),
              _user_message_metadata: {
                attachments: uploadedAttachmentsMeta,
              },
            },
          },
          {
            signal: abortController.signal,
            onDelta: (chunk) => appendAssistantChunk(chunk),
            onDone: () => {
              setGenerating(false);
              stopAssistantTyping();
              streamAbortRef.current = null;
            },
          },
        );

        if (shouldAutoRenameAfterSuccess && conversationId) {
          await apiFetch(`/sessions/${encodeURIComponent(conversationId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: pendingAutoTitle }),
          });
        }
      } catch (err) {
        if (userMessageId) removeMessageById(userMessageId);
        setChatError(err instanceof Error ? err.message : 'Failed to send');
        setGenerating(false);
        streamAbortRef.current = null;
      }
    },
    [
      appendAssistantChunk,
      currentConversation,
      isGenerating,
      pushMessage,
      removeMessageById,
      setCurrentConversation,
      DEFAULT_NEW_SESSION_TITLE,
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
