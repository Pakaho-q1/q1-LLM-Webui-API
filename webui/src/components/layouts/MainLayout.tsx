import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatContainer } from '@/features/chat/components/ChatContainer';
import { useModelActions, useModelCatalog, useModelStatus } from '@/features/models/hooks/useModelManager';
import { useMainLayout } from './hooks/useMainLayout';
import { useSettings } from '@/services/SettingsContext';
import { ConnectionState, useSSE } from '@/contexts/SSEContext';
import { Combobox } from '@/components/ui/Combobox';
import { Sun, Moon, Menu, ChevronRight, Zap, ZapOff } from 'lucide-react';

const LAST_MODEL_KEY = 'v1_last_selected_model';

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((p) => !p) };
}

const Spinner = () => (
  <span className="inline-block h-2.5 w-2.5 shrink-0 animate-[spinSlow_1s_linear_infinite] rounded-full border-2 border-current border-t-transparent" />
);

export const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingAction, setIsLoadingAction] = useState<
    'load' | 'unload' | null
  >(null);
  const { dark, toggle } = useTheme();

  const { localModels, isLoadingModels } = useModelCatalog();
  const { loadModel, unloadModel } = useModelActions();
  useModelStatus();
  const { currentModel, isModelRunning, isModelLoading, modelState, modelOperation } =
    useMainLayout();
  const { settings } = useSettings();
  const { isConnected, connectionState } = useSSE();

  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem(LAST_MODEL_KEY) || '',
  );

  useEffect(() => {
    if (localModels.length === 0) return;
    const cached = localStorage.getItem(LAST_MODEL_KEY);
    if (cached && !localModels.some((m) => m.name === cached)) {
      setSelectedModel('');
      localStorage.removeItem(LAST_MODEL_KEY);
    }
  }, [localModels]);

  const handleModelChange = (val: string) => {
    setSelectedModel(val);
    if (val) localStorage.setItem(LAST_MODEL_KEY, val);
    else localStorage.removeItem(LAST_MODEL_KEY);
  };

  const handleLoadModel = async () => {
    if (!selectedModel) return;
    setIsLoadingAction('load');
    try {
      await unloadModel({ preserveForLoad: { targetModel: selectedModel } });
      await loadModel(selectedModel, {
        n_ctx: settings.nCtx,
        n_gpu_layers: settings.nGpuLayers,
        n_threads: settings.nThreads,
        n_batch: settings.nBatch,
      });
    } catch (err) {
      console.error('Failed to load model:', err);
    } finally {
      setIsLoadingAction(null);
    }
  };

  const handleUnloadModel = async () => {
    setIsLoadingAction('unload');
    try {
      await unloadModel();
    } finally {
      setIsLoadingAction(null);
    }
  };

  const displayModelName =
    modelOperation?.targetModel || currentModel || '';

  const statusLabel =
    modelState === 'loading'
      ? 'Loading'
      : modelState === 'unloading'
        ? 'Unloading'
        : isModelRunning
          ? displayModelName.split('/').pop() || 'Running'
          : 'No Model';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <aside
        className={`z-30 shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-sidebar)] transition-[width] duration-300 ${isSidebarOpen ? 'w-[350px]' : 'w-0'}`}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg-base)]">
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-header)] px-4 shadow-[var(--shadow-sm)] backdrop-blur-xl">
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen((v) => !v)}
              className="icon-btn"
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {isSidebarOpen ? <ChevronRight size={17} /> : <Menu size={17} />}
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-[7px] w-[7px] rounded-full ${
                  connectionState === ConnectionState.CONNECTED
                    ? 'bg-[var(--success)] shadow-[0_0_6px_var(--success)]'
                    : connectionState === ConnectionState.CONNECTING
                      ? 'animate-[pulseDot_1.2s_ease-in-out_infinite] bg-[var(--warning)] shadow-[0_0_6px_var(--warning)]'
                      : connectionState === ConnectionState.ERROR
                        ? 'bg-[var(--danger)] shadow-[0_0_6px_var(--danger)]'
                        : 'bg-[var(--text-tertiary)] shadow-[0_0_6px_var(--text-tertiary)]'
                }`}
              />
              <span className="whitespace-nowrap text-[1.3rem] font-bold tracking-[-0.02em]">
                q1-LLM-Local
              </span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div
              className={`max-w-40 shrink-0 truncate rounded-full border px-2.5 py-1 text-xs font-medium ${
                isModelLoading
                  ? 'border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]'
                  : isModelRunning
                    ? 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]'
                    : 'border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isModelLoading ? (
                  <Spinner />
                ) : (
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      isModelRunning
                        ? 'animate-[pulseDot_2s_ease-in-out_infinite] bg-[var(--success)]'
                        : 'bg-[var(--text-tertiary)]'
                    }`}
                  />
                )}
                <span
                  className="truncate"
                  title={displayModelName || undefined}
                >
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="w-[190px] shrink-0">
              <Combobox
                className="w-full text-sm"
                options={localModels.map((m) => ({
                  value: m.name,
                  searchText: m.name,
                  label: (
                    <span
                      className="text-[0.8rem] text-[var(--text-primary)]"
                      title={m.name}
                    >
                      {m.name}
                    </span>
                  ),
                }))}
                value={selectedModel}
                onChange={handleModelChange}
                placeholder={isLoadingModels ? 'Loading…' : 'Select model…'}
                disabled={isLoadingModels || !isConnected}
              />
            </div>

            <button
              onClick={handleLoadModel}
              disabled={
                !selectedModel || !isConnected || isLoadingAction !== null
              }
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--success)] px-3.5 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoadingAction === 'load' ? <Spinner /> : <Zap size={12} />}
              Load
            </button>

            <button
              onClick={handleUnloadModel}
              disabled={!isConnected || isLoadingAction !== null}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--danger)] px-3.5 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoadingAction === 'unload' ? (
                <Spinner />
              ) : (
                <ZapOff size={12} />
              )}
              Unload
            </button>

            <button
              onClick={toggle}
              className="icon-btn shrink-0"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <ChatContainer />
        </main>
      </div>
    </div>
  );
};
