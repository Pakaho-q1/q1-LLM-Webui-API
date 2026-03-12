import React from 'react';

interface MetricChipProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  title?: string;
  className?: string;
}

export const MetricChip: React.FC<MetricChipProps> = ({
  icon,
  value,
  title,
  className = '',
}) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-[3px] ${className}`}
  >
    {icon}
    {value}
  </span>
);

