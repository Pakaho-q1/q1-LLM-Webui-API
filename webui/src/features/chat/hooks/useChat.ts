import { useCallback, useRef } from 'react';
import {
  fileToDataUrl,
  OpenAIChatMessage,
  streamOpenAIChatCompletion,
  transcribeAudioFile,
  uploadOpenAIFile,
} from '@/services/api.service';
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
  const streamAbortRef = useRef<AbortController | null>(null);

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
      try {
        setChatError(null);

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

        let history = useChatStore
          .getState()
          .messages.map((m) => toOpenAIMessage(m));

        if (systemPrompt.trim()) {
          history = [{ role: 'system', content: systemPrompt }, ...history];
        }

        const fileNotes: string[] = [];
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        if (text.trim()) {
          contentParts.push({ type: 'text', text: text.trim() });
        }

        for (const file of files) {
          const uploaded = await uploadOpenAIFile(file, 'user_data');
          fileNotes.push(`${file.name} (id: ${uploaded.id})`);

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

        if (fileNotes.length > 0) {
          contentParts.push({
            type: 'text',
            text: `Attached file references: ${fileNotes.join(', ')}`,
          });
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
            ...params,
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
      } catch (err) {
        if (userMessageId) removeMessageById(userMessageId);
        setChatError(err instanceof Error ? err.message : 'Failed to send');
        setGenerating(false);
        streamAbortRef.current = null;
      }
    },
    [
      appendAssistantChunk,
      isGenerating,
      pushMessage,
      removeMessageById,
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
