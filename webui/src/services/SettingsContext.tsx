import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';
import { logger } from './logger';

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
  contextCompactionThreshold: number;
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
  contextCompactionThreshold: 3000,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const toFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const sanitizeSettings = (payload: unknown): AppSettings => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return defaultSettings;
  }

  const source = payload as Record<string, unknown>;

  return {
    systemPrompt:
      typeof source.systemPrompt === 'string'
        ? source.systemPrompt.slice(0, 10000)
        : defaultSettings.systemPrompt,
    temperature: clamp(toFiniteNumber(source.temperature, defaultSettings.temperature), 0, 2),
    maxTokens: Math.round(clamp(toFiniteNumber(source.maxTokens, defaultSettings.maxTokens), 128, 8192)),
    topP: clamp(toFiniteNumber(source.topP, defaultSettings.topP), 0, 1),
    topK: Math.round(clamp(toFiniteNumber(source.topK, defaultSettings.topK), 0, 100)),
    minP: clamp(toFiniteNumber(source.minP, defaultSettings.minP), 0, 1),
    repeatPenalty: clamp(toFiniteNumber(source.repeatPenalty, defaultSettings.repeatPenalty), 1, 2),
    frequencyPenalty: clamp(toFiniteNumber(source.frequencyPenalty, defaultSettings.frequencyPenalty), -2, 2),
    presencePenalty: clamp(toFiniteNumber(source.presencePenalty, defaultSettings.presencePenalty), -2, 2),
    seed: Math.round(clamp(toFiniteNumber(source.seed, defaultSettings.seed), -1, 2_147_483_647)),
    nCtx: Math.round(clamp(toFiniteNumber(source.nCtx, defaultSettings.nCtx), 512, 32768)),
    nGpuLayers: Math.round(clamp(toFiniteNumber(source.nGpuLayers, defaultSettings.nGpuLayers), -1, 100)),
    nThreads: Math.round(clamp(toFiniteNumber(source.nThreads, defaultSettings.nThreads), 1, 64)),
    nBatch: Math.round(clamp(toFiniteNumber(source.nBatch, defaultSettings.nBatch), 128, 2048)),
    contextCompactionThreshold: (() => {
      const nCtx = Math.round(clamp(toFiniteNumber(source.nCtx, defaultSettings.nCtx), 512, 32768));
      const maxAllowed = Math.max(256, Math.floor(nCtx * 0.8));
      return Math.round(
        clamp(
          toFiniteNumber(source.contextCompactionThreshold, defaultSettings.contextCompactionThreshold),
          256,
          maxAllowed,
        ),
      );
    })(),
  };
};

const getInitialSettings = (): AppSettings => {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return defaultSettings;

    const parsed = JSON.parse(saved);
    return sanitizeSettings(parsed);
  } catch (error) {
    logger.error('SettingsContext', 'Failed to load settings from storage', error);
    return defaultSettings;
  }
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }, 500);

    return () => clearTimeout(handler);
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => sanitizeSettings({ ...prev, [key]: value }));
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
