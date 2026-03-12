import React, { useEffect, useMemo, useState } from 'react';
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
  Download,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Save,
  X as XIcon,
} from 'lucide-react';
import { MermaidBlock } from './mermaid-repair-engine/MermaidBlock';
import { parseThinking, preprocessContent } from './utils';
import { MessageBubbleProps } from './types';
import { MessageActions } from './message/MessageActions';
import { MessageMetrics } from './message/MessageMetrics';
import { API_BASE, getApiHeaders } from '@/services/api.service';
import { useSystemStore } from '@/services/system.store';

interface BubbleAttachment {
  url: string;
  type?: string;
  name?: string;
}

const CODE_EXT_BY_LANGUAGE: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  json: 'json',
  html: 'html',
  css: 'css',
  bash: 'sh',
  shell: 'sh',
  yaml: 'yaml',
  yml: 'yml',
  markdown: 'md',
  md: 'md',
  sql: 'sql',
  xml: 'xml',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  go: 'go',
  rust: 'rs',
  php: 'php',
  ruby: 'rb',
  kotlin: 'kt',
  swift: 'swift',
  plaintext: 'txt',
  text: 'txt',
};

const MIME_EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'application/json': 'json',
  'text/plain': 'txt',
};

const DOWNLOAD_POLICY = {
  code: {
    minLines: 5,
    minChars: 160,
    relaxedForTaggedCode: {
      minLines: 3,
      minChars: 100,
    },
  },
  plainText: {
    minLines: 20,
    minChars: 800,
  },
};

const CODE_CARD_LANG_ALLOWLIST = new Set([
  'json',
  'python',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'bash',
  'shell',
  'sh',
  'sql',
  'yaml',
  'yml',
]);

const normalizeFilename = (input: string): string =>
  input.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

const extractExtensionFromName = (name?: string): string | null => {
  if (!name) return null;
  const cleaned = normalizeFilename(name);
  const dot = cleaned.lastIndexOf('.');
  if (dot < 0 || dot === cleaned.length - 1) return null;
  return cleaned.slice(dot + 1).toLowerCase();
};

const timestampToken = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const buildProjectFilename = (extension = 'txt'): string =>
  normalizeFilename(`q1_llm+${timestampToken()}.${extension}`);

const countLines = (input: string): number => input.split(/\r?\n/).length;

const isPlainTextLanguage = (language: string): boolean =>
  ['text', 'plaintext', 'txt'].includes(language);

const looksLikeCode = (input: string): boolean => {
  const codeHints = [
    /\b(function|class|import|export|return|const|let|var|def|async|await)\b/,
    /[{}[\]();=>]/,
    /^\s*#include\s+/m,
    /^\s*<\w+.*>/m,
  ];
  return codeHints.some((pattern) => pattern.test(input));
};

const shouldShowDownloadForCodeBlock = (
  content: string,
  language: string,
  hasExplicitLanguage: boolean,
): boolean => {
  const lines = countLines(content);
  const chars = content.trim().length;

  if (isPlainTextLanguage(language)) {
    return (
      lines >= DOWNLOAD_POLICY.plainText.minLines ||
      chars >= DOWNLOAD_POLICY.plainText.minChars
    );
  }

  if (hasExplicitLanguage) {
    return (
      lines >= DOWNLOAD_POLICY.code.relaxedForTaggedCode.minLines ||
      chars >= DOWNLOAD_POLICY.code.relaxedForTaggedCode.minChars
    );
  }

  if (!looksLikeCode(content)) return false;

  return (
    lines >= DOWNLOAD_POLICY.code.minLines ||
    chars >= DOWNLOAD_POLICY.code.minChars
  );
};

const shouldRenderAsCompactInline = (
  content: string,
  language: string,
  hasExplicitLanguage: boolean,
): boolean => {
  const trimmed = content.trim();
  const lines = countLines(trimmed);
  const chars = trimmed.length;
  const isShort = lines <= 2 && chars <= 80;

  if (!isShort) return false;
  if (isPlainTextLanguage(language)) return true;
  if (!hasExplicitLanguage && !looksLikeCode(trimmed)) return true;
  return false;
};

const shouldRenderAsCodeCard = (
  content: string,
  language: string,
  hasExplicitLanguage: boolean,
): boolean => {
  if (!hasExplicitLanguage) return false;
  if (!CODE_CARD_LANG_ALLOWLIST.has(language)) return false;
  return !shouldRenderAsCompactInline(content, language, hasExplicitLanguage);
};

const isBackendFileUrl = (url: string) => url.startsWith(API_BASE);

const SecureAttachment: React.FC<{ file: BubbleAttachment }> = ({ file }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isImage = file.type?.startsWith('image/');
  const isAudio = file.type?.startsWith('audio/');
  const isVideo = file.type?.startsWith('video/');
  const displayName = file.name || 'attachment';
  const downloadName = buildProjectFilename(
    extractExtensionFromName(displayName) ||
      (file.type ? MIME_EXT_BY_TYPE[file.type] : null) ||
      'bin',
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const resolveAttachment = async () => {
      if (!file.url || !isBackendFileUrl(file.url)) {
        setBlobUrl(file.url);
        return;
      }
      try {
        const response = await fetch(file.url, {
          method: 'GET',
          headers: getApiHeaders(false),
        });
        if (!response.ok) {
          throw new Error(`Attachment fetch failed (${response.status})`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!active) return;
        setBlobUrl(objectUrl);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load attachment',
        );
      }
    };

    void resolveAttachment();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.url]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-1.5 text-[0.78rem] text-[var(--danger)]">
        {loadError}
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[0.78rem] text-[var(--text-tertiary)]">
        Loading attachment...
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
        <img
          src={blobUrl}
          alt={displayName}
          className="max-h-[200px] max-w-[280px] rounded-[8px] object-contain"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="max-w-[180px] truncate text-[0.75rem] text-[var(--text-secondary)]">
            {displayName}
          </span>
          <a
            href={blobUrl}
            download={downloadName}
            className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[0.72rem] text-[var(--text-secondary)] no-underline"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
        <audio src={blobUrl} controls className="w-full min-w-[250px]" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="max-w-[180px] truncate text-[0.75rem] text-[var(--text-secondary)]">
            {displayName}
          </span>
          <a
            href={blobUrl}
            download={downloadName}
            className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[0.72rem] text-[var(--text-secondary)] no-underline"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
        <video
          src={blobUrl}
          controls
          className="max-h-[240px] w-full rounded-[8px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="max-w-[180px] truncate text-[0.75rem] text-[var(--text-secondary)]">
            {displayName}
          </span>
          <a
            href={blobUrl}
            download={downloadName}
            className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[0.72rem] text-[var(--text-secondary)] no-underline"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={blobUrl}
      download={downloadName}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[0.8rem] text-[var(--text-secondary)] no-underline"
      target="_blank"
      rel="noreferrer"
    >
      <Paperclip size={13} />
      <span className="max-w-[180px] truncate">{displayName}</span>
      <span className="ml-1 inline-flex items-center gap-1 text-[0.72rem] opacity-80">
        <Download size={12} /> Download
      </span>
    </a>
  );
};

export const MessageBubble: React.FC<
  MessageBubbleProps & { animIndex?: number }
> = ({ msg, onEdit, onRetry, onDelete }) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(msg.content || '');

  const { thinkingText, cleanContent } = parseThinking(msg.content);
  const formattedContent = preprocessContent(cleanContent);
  const isUser = msg.role === 'user';
  const isAssistant = msg.role === 'assistant' || msg.role === 'model';
  const currentModel = useSystemStore((state) => state.currentModel);

  useEffect(() => {
    setEditDraft(msg.content || '');
  }, [msg.content, msg.id]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(code);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCopyMessage = () => {
    const content = (formattedContent || cleanContent || '').trim();
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedText(`message:${msg.id || msg.content.slice(0, 24)}`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDownloadCode = (code: string, language: string) => {
    const lang = (language || 'txt').toLowerCase();
    const extension = CODE_EXT_BY_LANGUAGE[lang] || lang || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildProjectFilename(extension);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = () => {
    const content = editDraft.trim();
    if (!content || !onEdit) return;
    onEdit(msg, content);
    setIsEditing(false);
  };

  const markdownComponents = useMemo(
    () => ({
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(children).replace(/\n$/, '');
        const language = (match?.[1] || 'text').toLowerCase();
        const hasExplicitLanguage = Boolean(match?.[1]);
        const canDownload = shouldShowDownloadForCodeBlock(
          codeString,
          language,
          hasExplicitLanguage,
        );
        const shouldRenderCard = shouldRenderAsCodeCard(
          codeString,
          language,
          hasExplicitLanguage,
        );
        const shouldCompact = shouldRenderAsCompactInline(
          codeString,
          language,
          hasExplicitLanguage,
        );

        if (!inline && language === 'mermaid') {
          return <MermaidBlock codeString={codeString} />;
        }

        if (!inline && shouldCompact) {
          return (
            <code
              className="rounded bg-[var(--bg-code)] px-1.5 py-0.5 font-mono text-[0.86em] text-[#e06c75]"
              {...props}
            >
              {codeString.trim()}
            </code>
          );
        }

        if (!inline && !shouldRenderCard) {
          return (
            <pre className="my-2.5 overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg-code)] px-3.5 py-2.5">
              <code
                className="font-mono text-[0.82rem] whitespace-pre-wrap text-[var(--text-primary)]"
                {...props}
              >
                {codeString}
              </code>
            </pre>
          );
        }

        return !inline ? (
          <div className="my-2.5 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-code)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3.5 py-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.05em] text-white/50">
                {language.toUpperCase()}
              </span>
              <div className="flex items-center gap-2">
                {canDownload && (
                  <button
                    onClick={() => handleDownloadCode(codeString, language)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.72rem] text-white/60 transition hover:text-white/90"
                  >
                    <Download size={12} />
                    Download
                  </button>
                )}
                <button
                  onClick={() => handleCopyCode(codeString)}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.72rem] transition ${
                    copiedText === codeString
                      ? 'text-emerald-500'
                      : 'text-white/60'
                  }`}
                >
                  {copiedText === codeString ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}
                  {copiedText === codeString ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={language}
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
            className="min-w-full border-collapse overflow-hidden rounded-lg border border-[var(--border)]"
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
          className="px-3.5 py-2.5 text-left text-[0.78rem] font-semibold tracking-[0.04em] text-[var(--text-secondary)] uppercase"
          {...props}
        />
      ),
      td: ({ node, ...props }: any) => (
        <td
          className="px-3.5 py-2.5 text-[0.875rem] text-[var(--text-primary)]"
          {...props}
        />
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
        <div className="mt-1 mr-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[var(--accent-subtle)]">
          <span className="text-[0.65rem] font-bold text-[var(--accent)]">
            AI
          </span>
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
                  {msg.isTyping && !formattedContent
                    ? 'Thinking…'
                    : 'Chain of thought'}
                </span>
                {isThinkingExpanded ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
              {isThinkingExpanded && (
                <div className="animate-[fadeIn_0.18s_both] border-t border-[var(--border)] px-3 py-2.5 font-mono text-[0.8rem] leading-6 whitespace-pre-wrap text-[var(--text-secondary)]">
                  {thinkingText}
                </div>
              )}
            </div>
          )}

          {/* การแก้ไข: ตรวจสอบ attachments อย่างปลอดภัย */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {msg.attachments.map((file: BubbleAttachment, idx: number) => (
                <SecureAttachment key={`${file.url}-${idx}`} file={file} />
              ))}
            </div>
          )}

          {msg.isTyping && !formattedContent && !thinkingText && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="custom-scrollbar min-h-[96px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-[0.88rem] text-[var(--text-primary)] outline-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditDraft(msg.content || '');
                  }}
                  title="Cancel edit"
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)]"
                >
                  <XIcon size={12} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  title="Save edit"
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)]"
                >
                  <Save size={12} />
                </button>
              </div>
            </div>
          ) : (
            formattedContent && (
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
            )
          )}
        </div>

        {isAssistant && (
          <MessageMetrics msg={msg} currentModel={currentModel || 'assistant'} />
        )}

        <MessageActions
          msg={msg}
          isUser={isUser}
          isAssistant={isAssistant}
          copiedText={copiedText}
          onCopy={handleCopyMessage}
          onStartEdit={onEdit ? () => setIsEditing(true) : undefined}
          onRetry={onRetry}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};
