import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useHistory } from '../hooks/useHistory';
import type { HistoryMessage } from '../hooks/useHistory';
import {
  getHistoryCache,
  isHistoryFresh,
} from '@/services/dataClient';
import { Modal } from '@/components/ui/Modal';
import { useSSE } from '@/contexts/SSEContext';
import { useChatStore } from '@/features/chat/store/chat.store';
import type { Attachment } from '@/features/chat/store/chat.store';
import { API_BASE, readRuntimeApiKey } from '@/services/api.service';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const ChatHistoryTab: React.FC = () => {
  const {
    sessions,
    loading,
    error,
    renameSession,
    deleteSession,
    getChatHistory,
    lastSessionKey,
  } = useHistory();
  const queryClient = useQueryClient();
  const { currentConversation, setCurrentConversation } = useSSE();
  const clearMessages = useChatStore((state) => state.clearMessages);
  const setMessages = useChatStore((state) => state.setMessages);
  const messages = useChatStore((state) => state.messages);
  const isGenerating = useChatStore((state) => state.isGenerating);

  const [selected, setSelected] = useState<string | null>(() =>
    localStorage.getItem(lastSessionKey),
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('New Chat');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const mapHistoryToInternalMessages = (
    history: any[],
    conversationId: string,
  ) =>
    history.map((m, idx) => {
      const runtimeKey = readRuntimeApiKey();
      const attachments: Attachment[] = Array.isArray(m?.metadata?.attachments)
        ? m.metadata.attachments
            .map((a: any) => {
              const fileId = typeof a?.file_id === 'string' ? a.file_id : '';
              const baseUrl =
                typeof a?.url === 'string' && a.url
                  ? String(a.url)
                  : fileId
                    ? `${API_BASE}/v1/files/${encodeURIComponent(fileId)}/content`
                    : '';
              if (!baseUrl) return null;
              const hasApiKey = baseUrl.includes('api_key=');
              const url =
                runtimeKey && !hasApiKey
                  ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(runtimeKey)}`
                  : baseUrl;
              return {
                url,
                type: String(a?.type || 'application/octet-stream'),
                name: a?.name ? String(a.name) : undefined,
              } as Attachment;
            })
            .filter((x: Attachment | null): x is Attachment => Boolean(x))
            .map((a: any) => ({
              url: a.url,
              type: a.type,
              name: a.name,
            }))
        : [];

      const cleanedContent = String(m.content || '')
        .replace(/(?:\n)?Attached file references:[^\n]*(?:\n)?/gi, '\n')
        .trim();

      return {
        id: `hist-${conversationId}-${idx}`,
        role: m.role as 'user' | 'assistant' | 'system',
        content: cleanedContent,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
    });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (sessions.length === 0) return;
    const savedId = localStorage.getItem(lastSessionKey);
    if (savedId && sessions.some((s) => s.id === savedId) && !selected) {
      setSelected(savedId);
      if (messages.length === 0 && !isGenerating) {
        const cached = getHistoryCache<HistoryMessage[]>(queryClient, savedId);
        const fresh = isHistoryFresh(queryClient, savedId);
        if (cached && cached.length > 0) {
          setMessages(mapHistoryToInternalMessages(cached, savedId));
          if (fresh) return;
        }
        getChatHistory(savedId).then((history) => {
          setMessages(mapHistoryToInternalMessages(history, savedId));
        });
      }
    }
  }, [
    sessions,
    getChatHistory,
    lastSessionKey,
    selected,
    setMessages,
    messages.length,
    isGenerating,
    queryClient,
  ]);

  useEffect(() => {
    if (
      selected &&
      sessions.length > 0 &&
      !sessions.some((s) => s.id === selected)
    ) {
      setSelected(null);
    }
  }, [sessions, selected]);

  useEffect(() => {
    if (!currentConversation) return;
    if (sessions.some((s) => s.id === currentConversation)) return;
  }, [currentConversation, sessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [sessions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSelect = async (id: string) => {
    setSelected(id);
    const cached = getHistoryCache<HistoryMessage[]>(queryClient, id);
    const fresh = isHistoryFresh(queryClient, id);
    if (cached && cached.length > 0) {
      setMessages(mapHistoryToInternalMessages(cached, id));
    }
    if (fresh) return;
    const history = await getChatHistory(id);
    setMessages(mapHistoryToInternalMessages(history, id));
  };

  const handleNewChat = () => {
    setSelected(null);
    setCurrentConversation?.(null);
    clearMessages();
    localStorage.removeItem(lastSessionKey);
  };

  const handleRename = async () => {
    if (!pendingId || !formTitle.trim()) return;
    setRenameOpen(false);
    await renameSession(pendingId, formTitle.trim());
    setPendingId(null);
    setFormTitle('New Chat');
  };

  const handleDelete = async () => {
    if (!pendingId) return;
    setDeleteOpen(false);
    if (selected === pendingId) {
      setSelected(null);
      clearMessages();
      setCurrentConversation?.(null);
      localStorage.removeItem(lastSessionKey);
    }
    await deleteSession(pendingId);
    setPendingId(null);
  };

  const inputClassName =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[0.83rem] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] uppercase">
          {loading
            ? '...'
            : `${filtered.length} Session${filtered.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[0.78rem] font-semibold text-white shadow-[0_1px_4px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition hover:opacity-90"
        >
          <Plus size={13} /> New Chat
        </button>
      </div>

      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <input
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClassName} pl-[30px]`}
        />
      </div>

      {error && (
        <div className="py-1 text-[0.8rem] text-[var(--danger)]">{error}</div>
      )}

      <div className="flex flex-col gap-0.5">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[0.83rem] text-[var(--text-tertiary)]">
            <span className="inline-block h-3.5 w-3.5 animate-[spinSlow_1s_linear_infinite] rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Loading...
          </div>
        ) : paged.length === 0 ? (
          <div className="py-5 text-center text-[0.83rem] text-[var(--text-tertiary)]">
            {search ? 'No results' : 'No sessions yet'}
          </div>
        ) : (
          paged.map((s) => {
            const isActive = selected === s.id;
            return (
              <div
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className={`group flex animate-[fadeIn_0.2s_both] cursor-pointer items-center rounded-[10px] border px-2.5 py-[9px] transition ${
                  isActive
                    ? 'border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-subtle)]'
                    : 'border-transparent hover:bg-[var(--bg-hover)]'
                }`}
              >
                <MessageSquare
                  size={13}
                  className={`mr-2 shrink-0 ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[0.84rem] ${
                      isActive
                        ? 'font-semibold text-[var(--accent)]'
                        : 'font-normal text-[var(--text-primary)]'
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[0.7rem] text-[var(--text-tertiary)]">
                    {s.updated_at
                      ? new Date(s.updated_at * 1000).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' },
                        )
                      : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingId(s.id);
                      setFormTitle(s.title);
                      setRenameOpen(true);
                    }}
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] border border-stone-500/30 bg-stone-500/30 text-stone-500 transition hover:bg-stone-500 hover:text-white"
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingId(s.id);
                      setDeleteOpen(true);
                    }}
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-0.5 flex items-center justify-between border-t border-[var(--border)] pt-2">
          <span className="text-[0.75rem] text-[var(--text-tertiary)]">
            {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            {[
              {
                icon: <ChevronLeft size={13} />,
                action: () => setPage((p) => Math.max(1, p - 1)),
                disabled: page === 1,
              },
              {
                icon: <ChevronRight size={13} />,
                action: () => setPage((p) => Math.min(totalPages, p + 1)),
                disabled: page === totalPages,
              },
            ].map(({ icon, action, disabled }, i) => (
              <button
                key={i}
                onClick={action}
                disabled={disabled}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        onConfirm={handleRename}
        title="Rename Session"
        confirmText="Save"
        confirmVariant="primary"
      >
        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[var(--text-secondary)]">
            New Title
          </label>
          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
            className={inputClassName}
          />
        </div>
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Session"
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-[0.875rem] text-[var(--text-secondary)]">
          This session will be permanently deleted and cannot be recovered.
        </p>
      </Modal>
    </div>
  );
};

export default ChatHistoryTab;
