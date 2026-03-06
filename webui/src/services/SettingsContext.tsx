import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';

export interface AppSettings {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  minP: number;
  repeatPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  seed: number;
  nCtx: number;
  nGpuLayers: number;
  nThreads: number;
  nBatch: number;
}

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  resetSettings: () => void;
}

const SETTINGS_STORAGE_KEY = 'v1_app_settings';

const defaultSettings: AppSettings = {
  systemPrompt: 'You are a helpful, respectful and honest coding assistant.',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
  topK: 40,
  minP: 0.0,
  repeatPenalty: 1.1,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  seed: -1,
  nCtx: 4096,
  nGpuLayers: -1,
  nThreads: 4,
  nBatch: 512,
};

const getInitialSettings = (): AppSettings => {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return defaultSettings;

    const parsed = JSON.parse(saved);

    return { ...defaultSettings, ...parsed };
  } catch (error) {
    console.error('Failed to load settings from storage:', error);
    return defaultSettings;
  }
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);

  const isFirstRender = useRef(true);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }, 500);

    return () => clearTimeout(handler);
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSetting, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context)
    throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
