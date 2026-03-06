import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--bg-sidebar)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 border-none bg-transparent px-4 py-3 text-xs font-semibold uppercase tracking-[0.01em] transition-colors duration-150 ${
              isActive
                ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[var(--accent)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
