import React, { useEffect } from 'react';
import { useSystemStore } from '@/services/system.store';
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

export const ToastViewport: React.FC = () => {
  const toasts = useSystemStore((state) => state.toasts);
  const removeToast = useSystemStore((state) => state.removeToast);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), toast.durationMs),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [removeToast, toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] ${toastClassByKind[toast.kind] || toastClassByKind.info}`}
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="mt-[1px] rounded p-0.5 opacity-70 transition hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
