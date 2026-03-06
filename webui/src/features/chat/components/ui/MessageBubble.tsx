import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Copy,
  Check,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Edit2,
  RefreshCw,
  Paperclip,
} from 'lucide-react';
import { MermaidBlock } from './mermaid-repair-engine/MermaidBlock';
import { parseThinking, preprocessContent } from './utils';
import { MessageBubbleProps } from './types';

export const MessageBubble: React.FC<
  MessageBubbleProps & { animIndex?: number }
> = ({ msg, onEdit, onRetry }) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const { thinkingText, cleanContent } = parseThinking(msg.content);
  const formattedContent = preprocessContent(cleanContent);
  const isUser = msg.role === 'user';

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(code);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const markdownComponents = useMemo(
    () => ({
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(children).replace(/\n$/, '');

        if (!inline && match && match[1] === 'mermaid') {
          return <MermaidBlock codeString={codeString} />;
        }

        return !inline && match ? (
          <div className="my-2.5 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-code)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3.5 py-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.05em] text-white/50">
                {match[1].toUpperCase()}
              </span>
              <button
                onClick={() => handleCopyCode(codeString)}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.72rem] transition ${
                  copiedText === codeString ? 'text-emerald-500' : 'text-white/60'
                }`}
              >
                {copiedText === codeString ? <Check size={12} /> : <Copy size={12} />}
                {copiedText === codeString ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'transparent',
                fontSize: '0.84rem',
              }}
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        ) : (
          <code
            className="rounded bg-[var(--bg-code)] px-1.5 py-0.5 font-mono text-[0.86em] text-[#e06c75]"
            {...props}
          >
            {children}
          </code>
        );
      },

      table: ({ node, ...props }: any) => (
        <div className="my-4 overflow-x-auto">
          <table
            className="min-w-full overflow-hidden rounded-lg border border-[var(--border)] border-collapse"
            {...props}
          />
        </div>
      ),
      thead: ({ node, ...props }: any) => (
        <thead className="bg-[var(--bg-elevated)]" {...props} />
      ),
      tbody: ({ node, ...props }: any) => <tbody {...props} />,
      tr: ({ node, ...props }: any) => (
        <tr className="border-b border-[var(--border)]" {...props} />
      ),
      th: ({ node, ...props }: any) => (
        <th
          className="px-3.5 py-2.5 text-left text-[0.78rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]"
          {...props}
        />
      ),
      td: ({ node, ...props }: any) => (
        <td className="px-3.5 py-2.5 text-[0.875rem] text-[var(--text-primary)]" {...props} />
      ),
      blockquote: ({ node, ...props }: any) => (
        <blockquote
          className="my-3 rounded-r-lg border-l-[3px] border-[var(--accent)] bg-[var(--accent-subtle)] px-4 py-2.5 text-[var(--text-secondary)]"
          {...props}
        />
      ),
    }),
    [copiedText],
  );

  return (
    <div
      className={`group flex w-full px-2 py-1 ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.22s_cubic-bezier(0.16,1,0.3,1)_both]`}
    >
      {!isUser && (
        <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[var(--accent-subtle)]">
          <span className="text-[0.65rem] font-bold text-[var(--accent)]">AI</span>
        </div>
      )}

      <div className={`relative ${isUser ? 'max-w-[75%]' : 'max-w-[90%]'}`}>
        <div
          className={`${
            isUser
              ? 'rounded-[18px_18px_6px_18px] border-none bg-[var(--bg-bubble-user)] px-3.5 py-2.5 text-[var(--text-bubble-user)] shadow-[0_2px_12px_color-mix(in_srgb,var(--accent)_25%,transparent)]'
              : 'rounded-[4px_18px_18px_18px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--text-bubble-ai)] shadow-[var(--shadow-sm)]'
          }`}
        >
          {thinkingText && (
            <div className="mb-2.5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
              <button
                onClick={() => setIsThinkingExpanded((p) => !p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[0.8rem] font-medium text-[var(--text-secondary)]"
              >
                <BrainCircuit
                  size={14}
                  className={`shrink-0 ${msg.isTyping ? 'animate-[pulseDot_1.5s_ease-in-out_infinite] text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                />
                <span className="flex-1 text-left">
                  {msg.isTyping && !formattedContent ? 'Thinking…' : 'Chain of thought'}
                </span>
                {isThinkingExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              {isThinkingExpanded && (
                <div className="animate-[fadeIn_0.18s_both] whitespace-pre-wrap border-t border-[var(--border)] px-3 py-2.5 font-mono text-[0.8rem] leading-6 text-[var(--text-secondary)]">
                  {thinkingText}
                </div>
              )}
            </div>
          )}

          {msg.attachments?.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {msg.attachments.map((file: any, idx: number) =>
                file.type?.startsWith('image/') ? (
                  <img
                    key={idx}
                    src={file.url}
                    alt={file.name || 'attachment'}
                    className="max-h-[200px] max-w-[280px] rounded-[10px] border border-[var(--border)] object-contain"
                  />
                ) : (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-secondary)]"
                  >
                    <Paperclip size={13} />
                    <span className="max-w-[180px] truncate">{file.name || 'File'}</span>
                  </div>
                ),
              )}
            </div>
          )}

          {msg.isTyping && !formattedContent && !thinkingText && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}

          {formattedContent && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {formattedContent}
              </ReactMarkdown>
              {msg.isTyping && <span className="cursor-blink" />}
            </div>
          )}
        </div>

        <div
          className={`absolute -bottom-[22px] flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 ${
            isUser ? 'right-1' : 'left-1'
          }`}
        >
          {msg.role === 'user' && onEdit && (
            <button
              onClick={() => onEdit(msg)}
              title="Edit message"
              className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-[3px] text-[0.72rem] text-[var(--text-secondary)]"
            >
              <Edit2 size={11} /> Edit
            </button>
          )}
          {msg.role === 'model' && onRetry && (
            <button
              onClick={() => onRetry(msg)}
              title="Regenerate response"
              className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-[3px] text-[0.72rem] text-[var(--text-secondary)]"
            >
              <RefreshCw size={11} /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
