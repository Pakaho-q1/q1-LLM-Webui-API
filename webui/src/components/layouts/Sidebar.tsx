import React, { useState, useMemo } from 'react';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { TabModels } from '@/features/models/components/TabModels';
import { TabSettings } from '@/features/settings/components/TabSettings';
import { ChatHistoryTab } from '@/features/history/components/ChatHistoryTab';
import { History, Cpu, Settings, X } from 'lucide-react';

type TabType = 'history' | 'settings' | 'models';

export const Sidebar: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('history');

  const menuTabs: TabItem[] = useMemo(
    () => [
      { id: 'history', label: 'History', icon: <History size={14} /> },
      { id: 'models', label: 'Models', icon: <Cpu size={14} /> },
      { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
    ],
    [],
  );

  return (
    <div className="flex h-full min-w-[350px] w-[350px] flex-col bg-[var(--bg-sidebar)]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent)] shadow-[0_2px_8px_var(--accent-subtle)]">
            <span className="text-[0.7rem] font-bold text-white">AI</span>
          </div>
          <span className="text-[0.9rem] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
            System Control
          </span>
        </div>

        <button onClick={onClose} className="icon-btn" title="Close sidebar">
          <X size={16} />
        </button>
      </div>

      <Tabs
        tabs={menuTabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabType)}
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--bg-sidebar)] p-4">
        {activeTab === 'history' && <ChatHistoryTab />}
        {activeTab === 'models' && <TabModels />}
        {activeTab === 'settings' && <TabSettings />}
      </div>
    </div>
  );
};
