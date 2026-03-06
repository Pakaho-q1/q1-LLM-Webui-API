import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useSettings } from '@/services/SettingsContext';
import { useSSE } from '@/contexts/SSEContext';
import { ChatMessagesGemini } from './ui/ChatMessagesGemini';
import { ChatInputGemini } from './ui/ChatInputGemini';
import { X, Sparkles, Zap, Code2, BookOpen, ArrowRight } from 'lucide-react';

const QUICK_PROMPTS = [
  {
    icon: <Code2 size={15} />,
    label: 'Write code',
    prompt: 'Help me write a Python script to ',
  },
  {
    icon: <Sparkles size={15} />,
    label: 'Brainstorm',
    prompt: 'Help me brainstorm ideas for ',
  },
  {
    icon: <BookOpen size={15} />,
    label: 'Explain',
    prompt: 'Explain this concept simply: ',
  },
  {
    icon: <Zap size={15} />,
    label: 'Quick task',
    prompt: 'Summarize the following: ',
  },
];

const IdleScreen: React.FC<{ onQuickPrompt: (t: string) => void }> = ({
  onQuickPrompt,
}) => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg-base)] px-6">
    <div className="mb-7 animate-[fadeIn_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,var(--accent)_0%,color-mix(in_srgb,var(--accent)_60%,#818cf8)_100%)] shadow-[0_8px_32px_color-mix(in_srgb,var(--accent)_35%,transparent)]">
        <div className="absolute inset-0 animate-[shimmer_2.5s_linear_infinite] bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.18)_50%,transparent_80%)] bg-[length:200%_100%]" />
        <span className="relative text-2xl font-extrabold tracking-[-0.04em] text-white">
          AI
        </span>
      </div>
    </div>

    <h1 className="m-0 animate-[fadeIn_0.5s_0.08s_both] text-center text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
      What can I help you with?
    </h1>

    <p className="mb-9 mt-2.5 max-w-[380px] animate-[fadeIn_0.5s_0.14s_both] text-center text-[0.9rem] leading-6 text-[var(--text-secondary)]">
      Start a new chat or select a conversation from the sidebar. You can also
      type below to begin.
    </p>

    <div className="grid w-full max-w-[460px] grid-cols-2 gap-2.5 animate-[fadeIn_0.5s_0.2s_both]">
      {QUICK_PROMPTS.map((p, i) => (
        <button
          key={i}
          onClick={() => onQuickPrompt(p.prompt)}
          className="group flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-3 text-left text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-all duration-150 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:shadow-[0_4px_16px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
        >
          <span className="shrink-0 text-[var(--accent)] opacity-85">
            {p.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-[0.83rem] font-semibold">{p.label}</div>
            <div className="truncate text-[0.75rem] text-[var(--text-tertiary)]">
              {p.prompt}…
            </div>
          </div>
          <ArrowRight
            size={13}
            className="shrink-0 text-[var(--text-tertiary)] opacity-60"
          />
        </button>
      ))}
    </div>

    <p className="mt-7 animate-[fadeIn_0.5s_0.45s_both] text-[0.77rem] text-[var(--text-tertiary)]">
      Press{' '}
      <kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-[5px] py-px font-mono text-[0.72rem]">
        ↵ Enter
      </kbd>{' '}
      to send ·{' '}
      <kbd className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-[5px] py-px font-mono text-[0.72rem]">
        ⇧ Shift+Enter
      </kbd>{' '}
      for new line
    </p>
  </div>
);

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
  const { settings } = useSettings();
  const { currentConversation } = useSSE();
  const [editText, setEditText] = useState('');
  const [idleInput, setIdleInput] = useState('');

  const handleSendMessage = (text: string, files: File[] = []) => {
    sendMessage(
      text,
      files[0] ?? null,
      {
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        top_p: settings.topP,
        top_k: settings.topK,
      },
      settings.systemPrompt,
    );
  };

  const handleRetry = (msg: any) => handleSendMessage(msg.content || '');
  const handleEdit = (msg: any) => setEditText(msg.content || '');

  if (!currentConversation) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-base)]">
        <div className="min-h-0 flex-1 overflow-hidden">
          <IdleScreen onQuickPrompt={(text) => setIdleInput(text)} />
        </div>
        <ChatInputGemini
          onSend={(text, files) => handleSendMessage(text, files)}
          onStop={stopGeneration}
          disabled={!isConnected}
          isGenerating={isGenerating}
          initialText={idleInput}
          onTextChange={setIdleInput}
          onOpenTools={() => {}}
        />
      </div>
    );
  }

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

      <ChatMessagesGemini
        messages={messages.map((m) => ({
          id: undefined,
          role: m.role as any,
          content: m.content as string,
          attachments: (m as any).attachments,
          isTyping: (m as any).isTyping,
        }))}
        onEdit={handleEdit}
        onRetry={handleRetry}
      />

      <ChatInputGemini
        onSend={(text, files) => handleSendMessage(text, files)}
        onStop={stopGeneration}
        disabled={!isConnected}
        isGenerating={isGenerating}
        initialText={editText}
        onTextChange={setEditText}
        onOpenTools={() => {}}
      />
    </div>
  );
};
