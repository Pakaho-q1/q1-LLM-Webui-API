import React from 'react';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  children,
  className = '',
}) => (
  <section
    className={`mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 ${className}`}
  >
    <h3 className="mb-3.5 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
      {title}
    </h3>
    {children}
  </section>
);

