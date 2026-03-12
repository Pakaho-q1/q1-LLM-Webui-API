import React from 'react';

interface IconActionButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const IconActionButton: React.FC<IconActionButtonProps> = ({
  icon,
  title,
  onClick,
  disabled = false,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] transition disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
  >
    {icon}
  </button>
);

