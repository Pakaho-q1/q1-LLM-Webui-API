import { useEffect, useCallback, useRef } from 'react';
import { useSSE } from '../../../contexts/SSEContext';
import { ChatMessage } from '../../../types/chat.types';
import {
  Attachment,
  InternalMessage,
  useChatStore,
} from '../store/chat.store';

const toOpenAIMessage = (message: InternalMessage): ChatMessage => ({
  role: message.role,
  content: message.content,
});

export const useChat = () => {
  const {
    isConnected,
    sendPayload,
    sendForm,
    lastMessage,
    subscribeToChat,
    error,
    currentConversation,
  } = useSSE();

  const creatingSessionRef = useRef(false);
  const currentConversationRef = useRef<string | null>(currentConversation);

  const {
    messages,
    isGenerating,
    chatError,
    setMessages,
    pushMessage,
    appendAssistantChunk,
    setGenerating,
    setChatError,
    stopAssistantTyping,
    clearMessages,
  } = useChatStore();

  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  const idRef = useRef(0);
  const createId = () => `msg-${Date.now()}-${idRef.current++}`;

  useEffect(() => {
    if (!lastMessage) return;
    try {
      if (
        lastMessage.type === 'chat_history' &&
        Array.isArray(lastMessage.data)
      ) {
        const historyMessages: InternalMessage[] = (
          lastMessage.data as any[]
        ).map((msg) => ({
          id: createId(),
          role: msg.role || 'user',
          content: msg.content || '',
        }));
        setMessages(historyMessages);
        setChatError(null);
        setGenerating(false);
      }
    } catch (err) {
      console.error('Error processing history:', err);
    }
  }, [lastMessage, setGenerating, setMessages, setChatError]);

  useEffect(() => {
    const handleIncoming = (msg: any) => {
      try {
        if (msg === '[DONE]') {
          stopAssistantTyping();
          setGenerating(false);
          return;
        }

        if (msg.type === 'chunk' && msg.content) {
          appendAssistantChunk(msg.content, msg.id);
          return;
        }

        if (msg.type === 'done' || msg.type === 'success') {
          setGenerating(false);
          stopAssistantTyping();
          return;
        }

        if (msg.type === 'error') {
          setChatError(msg.message || 'Unknown error');
          setGenerating(false);
        }
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Processing error');
        setGenerating(false);
      }
    };

    return subscribeToChat(handleIncoming);
  }, [
    appendAssistantChunk,
    setGenerating,
    setChatError,
    stopAssistantTyping,
    subscribeToChat,
  ]);

  const stopGeneration = useCallback(async () => {
    setGenerating(false);
    stopAssistantTyping();
    try {
      await sendPayload({ action: 'stop_generation' });
    } catch (_) {}
  }, [sendPayload, setGenerating, stopAssistantTyping]);

  const sendMessage = useCallback(
    async (
      text: string,
      file: File | null = null,
      params: Record<string, unknown> = {},
      systemPrompt = '',
      model = 'default',
    ) => {
      if ((!text.trim() && !file) || !isConnected || isGenerating) return;

      try {
        setChatError(null);

        let attachments: Attachment[] | undefined;
        if (file) {
          attachments = [
            {
              url: URL.createObjectURL(file),
              type: file.type,
              name: file.name,
              file,
            },
          ];
        }

        const userMsg: InternalMessage = {
          id: createId(),
          role: 'user',
          content: text,
          attachments,
        };

        setGenerating(true);
        pushMessage(userMsg);

        let history = useChatStore
          .getState()
          .messages.map((m) => toOpenAIMessage(m));
        if (systemPrompt.trim()) {
          history = [{ role: 'system', content: systemPrompt }, ...history];
        }

        if (!currentConversationRef.current && !creatingSessionRef.current) {
          creatingSessionRef.current = true;
          try {
            await sendPayload({
              action: 'create_session',
              title: text.slice(0, 60) || 'New Chat',
            });
            const start = Date.now();
            while (
              !currentConversationRef.current &&
              Date.now() - start < 5000
            ) {
              await new Promise((r) => setTimeout(r, 100));
            }
          } finally {
            creatingSessionRef.current = false;
          }
        }

        if (file) {
          const fd = new FormData();
          fd.append('file', file, file.name);
          fd.append('action', 'chat_with_file');
          fd.append('content', text);
          fd.append('messages', JSON.stringify(history));
          fd.append('params', JSON.stringify(params));
          if (currentConversationRef.current) {
            fd.append('conversation_id', currentConversationRef.current);
          }

          await sendForm('chat_file', fd);
        } else {
          const payload: Record<string, unknown> = {
            action: 'chat_completion',
            model,
            messages: history,
            stream: true,
            ...params,
          };
          if (currentConversationRef.current) {
            payload.conversation_id = currentConversationRef.current;
          }
          await sendPayload(payload);
        }
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Failed to send');
        setGenerating(false);
      }
    },
    [isConnected, isGenerating, pushMessage, sendForm, sendPayload, setGenerating, setChatError],
  );

  const clearError = useCallback(() => setChatError(null), [setChatError]);

  return {
    isConnected,
    messages,
    isGenerating,
    error: chatError || error,
    sendMessage,
    stopGeneration,
    clearMessages,
    clearError,
  };
};
