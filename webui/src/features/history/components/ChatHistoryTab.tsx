import React, { useEffect, useState, useMemo } from 'react';
import { useHistory } from '../hooks/useHistory';
import { Modal } from '@/components/ui/Modal';
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
    fetchSessions,
    createSession,
    renameSession,
    deleteSession,
    getChatHistory,
    lastSessionKey,
  } = useHistory();

  const [selected, setSelected] = useState<string | null>(() =>
    localStorage.getItem(lastSessionKey),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (sessions.length === 0) return;
    const savedId = localStorage.getItem(lastSessionKey);
    if (savedId && sessions.some((s) => s.id === savedId) && !selected) {
      setSelected(savedId);
      getChatHistory(savedId);
    }
  }, [sessions, getChatHistory, lastSessionKey, selected]);

  useEffect(() => {
    if (
      selected &&
      sessions.length > 0 &&
      !sessions.some((s) => s.id === selected)
    ) {
      setSelected(null);
    }
  }, [sessions, selected]);

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
    await getChatHistory(id);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setCreateOpen(false);
    await createSession(formTitle.trim());
    setFormTitle('');
  };

  const handleRename = async () => {
    if (!pendingId || !formTitle.trim()) return;
    setRenameOpen(false);
    await renameSession(pendingId, formTitle.trim());
    setPendingId(null);
    setFormTitle('');
  };

  const handleDelete = async () => {
    if (!pendingId) return;
    setDeleteOpen(false);
    if (selected === pendingId) setSelected(null);
    await deleteSession(pendingId);
    setPendingId(null);
  };

  const inputClassName =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[0.83rem] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {loading
            ? '...'
            : `${filtered.length} Session${filtered.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => {
            setFormTitle('New Chat');
            setCreateOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[0.78rem] font-semibold text-white shadow-[0_1px_4px_color-mix(in_srgb,var(--accent)_35%,transparent)] transition hover:opacity-90"
        >
          <Plus size={13} /> New Chat
        </button>
      </div>

      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <input
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClassName} pl-[30px]`}
        />
      </div>

      {error && <div className="py-1 text-[0.8rem] text-[var(--danger)]">{error}</div>}

      <div className="flex flex-col gap-0.5">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[0.83rem] text-[var(--text-tertiary)]">
            <span className="inline-block h-3.5 w-3.5 animate-[spinSlow_1s_linear_infinite] rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Loading…
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
                className={`group flex cursor-pointer items-center rounded-[10px] border px-2.5 py-[9px] transition animate-[fadeIn_0.2s_both] ${
                  isActive
                    ? 'border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-subtle)]'
                    : 'border-transparent hover:bg-[var(--bg-hover)]'
                }`}
              >
                <MessageSquare
                  size={13}
                  className={`mr-2 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}
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
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreate}
        title="New Chat"
        confirmText="Create"
        confirmVariant="primary"
      >
        <div>
          <label className="mb-1.5 block text-[0.8rem] font-medium text-[var(--text-secondary)]">
            Chat Title
          </label>
          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className={inputClassName}
            placeholder="Enter a title…"
          />
        </div>
      </Modal>

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
