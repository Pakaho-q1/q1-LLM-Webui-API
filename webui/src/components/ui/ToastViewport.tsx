import React, { useEffect, useMemo, useState } from 'react';
import { TOAST_DURATION_MS, ToastItem, useSystemStore } from '@/services/system.store';
import { X } from 'lucide-react';

const toastClassByKind: Record<string, string> = {
  error:
    'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]',
  warning:
    'border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]',
  success:
    'border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]',
  info:
    'border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]',
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const durationMs = toast.durationMs || TOAST_DURATION_MS;
  const remainingMs = Math.max(0, toast.createdAt + durationMs - now);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPercent = useMemo(
    () => Math.max(0, Math.min(100, (remainingMs / durationMs) * 100)),
    [durationMs, remainingMs],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), remainingMs);
    const tick = window.setInterval(() => setNow(Date.now()), 100);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(tick);
    };
  }, [onDismiss, remainingMs, toast.id]);

  return (
    <div
      className={`pointer-events-auto rounded-lg border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] ${toastClassByKind[toast.kind] || toastClassByKind.info}`}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <span className="min-w-0 flex-1 break-words">{toast.message}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.7rem] font-semibold opacity-75">{remainingSeconds}s</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="mt-[1px] rounded p-0.5 opacity-70 transition hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded bg-black/10">
        <div
          className="h-full rounded bg-current/65 transition-[width] duration-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

export const ToastViewport: React.FC = () => {
  const toasts = useSystemStore((state) => state.toasts);
  const removeToast = useSystemStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};
