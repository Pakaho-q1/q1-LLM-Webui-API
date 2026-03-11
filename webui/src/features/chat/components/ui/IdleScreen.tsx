// src/features/chat/components/ui/IdleScreen.tsx
import React from 'react';
import { Sparkles, Zap, Code2, BookOpen, ArrowRight } from 'lucide-react';

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

interface IdleScreenProps {
  onQuickPrompt: (text: string) => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({ onQuickPrompt }) => (
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

    <p className="mt-2.5 mb-9 max-w-[380px] animate-[fadeIn_0.5s_0.14s_both] text-center text-[0.9rem] leading-6 text-[var(--text-secondary)]">
      Start a new chat or select a conversation from the sidebar. You can also
      type below to begin.
    </p>

    <div className="grid w-full max-w-[460px] animate-[fadeIn_0.5s_0.2s_both] grid-cols-2 gap-2.5">
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
