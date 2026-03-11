import React, { useMemo, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useChatStore } from '../store/chat.store';
import { useTokenCounter } from '../hooks/useTokenCounter';
import { useSettings } from '@/services/SettingsContext';
import { useSystemStore } from '@/services/system.store';
import { useFetch } from '@/contexts/FetchContext';
import { useSSE } from '@/contexts/SSEContext';
import { ChatMessagesGemini } from './ui/ChatMessagesGemini';
import { ChatInputGemini } from './ui/ChatInputGemini';
import { IdleScreen } from './ui/IdleScreen';
import { X } from 'lucide-react';

export const ChatContainer: React.FC = () => {
  const {
    isConnected,
    messages,
    isGenerating,
    error,
    sendMessage,
    stopGeneration,
    clearError,
  } = useChat();

  const removeMessageById = useChatStore((state) => state.removeMessageById);
  const updateMessageById = useChatStore((state) => state.updateMessageById);
  const truncateFromMessage = useChatStore((state) => state.truncateFromMessage);
  const { tokenCount, isCountingTokens, countTokens } = useTokenCounter();
  const { apiFetch } = useFetch();

  const { settings } = useSettings();
  const providerSupportedChatParams = useSystemStore(
    (state) => state.providerSupportedChatParams,
  );
  const currentModel = useSystemStore((state) => state.currentModel);
  const storeConversationId = useSystemStore((state) => state.currentConversationId);
  const pushToast = useSystemStore((state) => state.pushToast);
  const { currentConversation } = useSSE();
  const currentConversationId = currentConversation || storeConversationId;
  const [editText, setEditText] = useState('');

  const handleSendMessage = (text: string, files: File[] = []) => {
    const payload: Record<string, unknown> = {};
    if (providerSupportedChatParams.includes('temperature')) payload.temperature = settings.temperature;
    if (providerSupportedChatParams.includes('max_tokens')) payload.max_tokens = settings.maxTokens;
    if (providerSupportedChatParams.includes('top_p')) payload.top_p = settings.topP;
    if (providerSupportedChatParams.includes('top_k')) payload.top_k = settings.topK;
    if (providerSupportedChatParams.includes('min_p')) payload.min_p = settings.minP;
    if (providerSupportedChatParams.includes('repeat_penalty')) payload.repeat_penalty = settings.repeatPenalty;
    if (providerSupportedChatParams.includes('presence_penalty')) payload.presence_penalty = settings.presencePenalty;
    if (providerSupportedChatParams.includes('frequency_penalty')) payload.frequency_penalty = settings.frequencyPenalty;
    if (providerSupportedChatParams.includes('seed')) payload.seed = settings.seed;

    sendMessage(
      text,
      files,
      payload,
      settings.systemPrompt,
      currentModel || undefined,
    );
  };

  const handleRetry = (msg: any) => {
    if (!msg) return;

    if (msg.role === 'user') {
      if (msg.id) truncateFromMessage(msg.id);
      handleSendMessage(msg.content || '');
      return;
    }

    const idx = messages.findIndex((m: any) => m.id === msg.id);
    if (idx >= 0) {
      for (let i = idx - 1; i >= 0; i -= 1) {
        const previous = messages[i] as any;
        if (previous?.role === 'user') {
          if (msg.id) truncateFromMessage(msg.id);
          handleSendMessage(previous.content || '');
          return;
        }
      }
    }

    handleSendMessage(msg.content || '');
  };

  const handleEdit = async (msg: any, nextContent?: string) => {
    const content = String(nextContent || '').trim();
    if (!msg?.id || !content) return;

    updateMessageById(msg.id, { content });
    if (!currentConversationId) return;
    try {
      await apiFetch(
        `/history/${encodeURIComponent(currentConversationId)}/messages/${encodeURIComponent(msg.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        },
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to update message', 'error', 3000);
    }
  };

  const handleDeleteMessage = async (msg: any) => {
    if (msg?.id) removeMessageById(msg.id);
    if (!msg?.id || !currentConversationId) return;
    try {
      await apiFetch(
        `/history/${encodeURIComponent(currentConversationId)}/messages/${encodeURIComponent(msg.id)}`,
        { method: 'DELETE' },
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to delete message', 'error', 3000);
    }
  };

  const latestAssistantMetrics = useMemo(() => {
    const found = [...messages]
      .reverse()
      .find((m: any) => m.role === 'assistant' && m.metrics);
    return (found as any)?.metrics || {};
  }, [messages]);

  const contextMaxTokens = Math.max(1, Number(settings.nCtx || 4096));
  const contextUsedTokens =
    Number(latestAssistantMetrics.prompt_tokens || 0) +
    Number(latestAssistantMetrics.generated_tokens || 0);
  const contextPct = Math.max(
    0,
    Math.min(100, Math.round((contextUsedTokens / contextMaxTokens) * 100)),
  );

  const shouldShowIdle = messages.length === 0 && !isGenerating;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-base)]">
      {error && (
        <div className="flex shrink-0 animate-[fadeIn_0.2s_both] items-center justify-between border-b border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-2.5 text-sm text-[var(--danger)]">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="icon-btn h-6 w-6 text-[var(--danger)]"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {shouldShowIdle ? (
        <div className="flex-1 overflow-y-auto">
          <IdleScreen onQuickPrompt={(text) => setEditText(text)} />
        </div>
      ) : (
        <ChatMessagesGemini
          messages={messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            isTyping: m.isTyping,
            metrics: m.metrics,
          }))}
          onEdit={handleEdit}
          onRetry={handleRetry}
          onDelete={handleDeleteMessage}
        />
      )}

      {isGenerating && (
        <div className="mx-auto flex w-full max-w-[768px] items-center gap-3 px-4 pb-1 text-[0.75rem] text-[var(--text-tertiary)]">
          <span>
            Context: {contextUsedTokens.toLocaleString()}/{contextMaxTokens.toLocaleString()} ({contextPct}%)
          </span>
          <span>
            Output: {Number(latestAssistantMetrics.generated_tokens || 0).toLocaleString()} tok
          </span>
          <span>{Number(latestAssistantMetrics.generation_tokens_per_sec || 0).toFixed(2)} t/s</span>
        </div>
      )}

      <ChatInputGemini
        onSend={(text, files) => handleSendMessage(text, files)}
        onStop={stopGeneration}
        disabled={!isConnected}
        isGenerating={isGenerating}
        initialText={editText}
        onTextChange={(text) => {
          setEditText(text);
          countTokens(text);
        }}
        onOpenTools={() => {}}
        inputTokenCount={tokenCount}
        isCountingTokens={isCountingTokens}
      />
    </div>
  );
};
