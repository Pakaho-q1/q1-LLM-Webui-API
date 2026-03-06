import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirm',
  confirmVariant = 'primary',
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex animate-[fadeIn_0.15s_both] items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[4px]"
      />

      <div className="relative w-full max-w-[440px] overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] animate-[scaleIn_0.2s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-[14px]">
          <span className="text-[0.9rem] font-semibold text-[var(--text-primary)]">
            {title}
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-[18px] pb-[14px] pt-[18px]">{children}</div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-[18px] py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-[0.83rem] font-medium text-[var(--text-secondary)] transition"
          >
            Cancel
          </button>

          {onConfirm && (
            <button
              onClick={() => {
                onConfirm();
              }}
              className={`rounded-lg px-[18px] py-2 text-[0.83rem] font-semibold text-white transition ${
                confirmVariant === 'danger'
                  ? 'bg-[var(--danger)] shadow-[0_1px_4px_color-mix(in_srgb,var(--danger)_35%,transparent)]'
                  : 'bg-[var(--accent)] shadow-[0_1px_4px_color-mix(in_srgb,var(--accent)_35%,transparent)]'
              }`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
