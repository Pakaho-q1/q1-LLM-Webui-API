import React from 'react';
import { Loader2 } from 'lucide-react';

interface BlockingOverlayProps {
  open: boolean;
  title: string;
  description: string;
}

export const BlockingOverlay: React.FC<BlockingOverlayProps> = ({
  open,
  title,
  description,
}) => {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-base)_72%,black)] backdrop-blur-sm">
      <div className="w-[min(92vw,440px)] rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)]">
        <div className="mb-2 flex items-center gap-2 text-[var(--text-primary)]">
          <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-[0.83rem] text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
};

