import React from 'react';

interface StatusBadgeProps {
  status: 'running' | 'loading' | 'stopped';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const statusClass =
    status === 'running'
      ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]'
      : status === 'loading'
        ? 'border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]'
        : 'border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}
    >
      {status === 'loading' ? (
        <span className="inline-block h-2 w-2 shrink-0 animate-[spinSlow_1.2s_linear_infinite] rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            status === 'running'
              ? 'animate-[pulseDot_1.5s_ease-in-out_infinite] bg-[var(--success)]'
              : 'bg-[var(--text-tertiary)]'
          }`}
        />
      )}
      <span className="max-w-[120px] truncate">{label || status}</span>
    </span>
  );
};

export default StatusBadge;
