import { create } from 'zustand';
import { ProviderFeatures, ProviderName } from '@/types/provider.types';

export type SidebarTab = 'history' | 'models' | 'settings';
export const TOAST_DURATION_MS = 3000;

export interface ToastItem {
  id: string;
  message: string;
  kind: 'error' | 'warning' | 'success' | 'info';
  createdAt: number;
  durationMs: number;
}

interface SystemState {
  currentConversationId: string | null;
  currentModel: string;
  isModelRunning: boolean;
  isModelLoading: boolean;
  modelState: 'idle' | 'loading' | 'running' | 'unloading' | 'error';
  modelOperation: {
    id: string;
    type: 'load' | 'unload';
    targetModel?: string;
    startedAt: number;
  } | null;
  modelStatusVersion: number;
  currentProvider: ProviderName;
  providerFeatures: ProviderFeatures;
  providerSupportedChatParams: string[];
  providerConfig: Record<string, unknown>;
  canonicalChatParams: string[];
  providerConfigSchema: Record<string, unknown>;
  isAuthRequired: boolean;
  activeSidebarTab: SidebarTab;
  isContextCompacting: boolean;
  contextCompactionStatus: string | null;
  pendingRequestCount: number;
  pendingRequestsByKey: Record<string, number>;
  lastError: string | null;
  toasts: ToastItem[];

  setStatus: (status: Partial<SystemState>) => void;
  setModelStatus: (
    status: {
      currentModel?: string;
      isModelRunning?: boolean;
      isModelLoading?: boolean;
    },
    meta?: {
      source?: 'local' | 'sse' | 'poll' | 'init';
      timestamp?: number;
      requestId?: string;
    },
  ) => void;
  setProviderState: (state: {
    currentProvider?: ProviderName;
    providerFeatures?: ProviderFeatures;
    providerSupportedChatParams?: string[];
    providerConfig?: Record<string, unknown>;
    canonicalChatParams?: string[];
    providerConfigSchema?: Record<string, unknown>;
  }) => void;
  beginModelOperation: (type: 'load' | 'unload', targetModel?: string) => string;
  endModelOperation: () => void;
  setAuthRequired: (required: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setContextCompaction: (active: boolean, status?: string | null) => void;
  beginRequest: (requestKey?: string) => void;
  endRequest: (requestKey?: string) => void;
  setLastError: (message: string | null) => void;
  pushToast: (
    message: string,
    kind?: ToastItem['kind'],
    durationMs?: number,
  ) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  clearStatus: () => void;
  setCurrentConversationId: (id: string | null) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  currentModel: '',
  currentConversationId: null,
  isModelRunning: false,
  isModelLoading: false,
  modelState: 'idle',
  modelOperation: null,
  modelStatusVersion: 0,
  currentProvider: 'local',
  providerFeatures: {
    local_model_lifecycle: true,
    model_downloads: true,
    multimodal: true,
  },
  providerSupportedChatParams: [],
  providerConfig: {},
  canonicalChatParams: [],
  providerConfigSchema: {},
  isAuthRequired: false,
  activeSidebarTab: 'history',
  isContextCompacting: false,
  contextCompactionStatus: null,
  pendingRequestCount: 0,
  pendingRequestsByKey: {},
  lastError: null,
  toasts: [],

  setStatus: (newStatus) => set((state) => ({ ...state, ...newStatus })),
  setModelStatus: (status, meta) =>
    set((state) => {
      const timestamp = meta?.timestamp ?? Date.now();
      if (timestamp < state.modelStatusVersion) return state;

      const source = meta?.source ?? 'local';
      const op = state.modelOperation;
      if (source === 'local' && meta?.requestId && op?.id && meta.requestId !== op.id) {
        return state;
      }
      const nextRunning = status.isModelRunning ?? state.isModelRunning;
      const nextLoading = status.isModelLoading ?? state.isModelLoading;
      const nextModel = status.currentModel ?? state.currentModel;

      if ((source === 'sse' || source === 'poll') && op) {
        if (op.type === 'load') {
          const incomingModel = status.currentModel ?? nextModel;
          const target = op.targetModel ?? '';
          const incomingEmpty = !incomingModel;
          const mismatched = target && incomingModel && incomingModel !== target;
          if (incomingEmpty && !nextLoading && !nextRunning) return state;
          if (mismatched && !nextRunning) return state;
          if (!incomingEmpty && target && incomingModel === target && nextRunning) {
            return {
              ...state,
              currentModel: incomingModel,
              isModelRunning: nextRunning,
              isModelLoading: nextLoading,
              modelState: 'running',
              modelOperation: null,
              modelStatusVersion: timestamp,
            };
          }
        }
        if (op.type === 'unload') {
          if (nextLoading) return state;
          if (!nextRunning && !nextLoading) {
            return {
              ...state,
              currentModel: '',
              isModelRunning: false,
              isModelLoading: false,
              modelState: 'idle',
              modelOperation: null,
              modelStatusVersion: timestamp,
            };
          }
        }
      }

      const modelState: SystemState['modelState'] = nextLoading
        ? op?.type === 'unload'
          ? 'unloading'
          : 'loading'
        : nextRunning
          ? 'running'
          : state.lastError
            ? 'error'
            : 'idle';

      return {
        ...state,
        currentModel: nextModel,
        isModelRunning: nextRunning,
        isModelLoading: nextLoading,
        modelState,
        modelStatusVersion: timestamp,
      };
    }),
  setProviderState: (providerState) =>
    set((state) => ({
      ...state,
      currentProvider: providerState.currentProvider ?? state.currentProvider,
      providerFeatures: providerState.providerFeatures ?? state.providerFeatures,
      providerSupportedChatParams:
        providerState.providerSupportedChatParams ?? state.providerSupportedChatParams,
      providerConfig: providerState.providerConfig ?? state.providerConfig,
      canonicalChatParams: providerState.canonicalChatParams ?? state.canonicalChatParams,
      providerConfigSchema: providerState.providerConfigSchema ?? state.providerConfigSchema,
    })),
  beginModelOperation: (type, targetModel) => {
    const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set({
      modelOperation: { id, type, targetModel, startedAt: Date.now() },
      modelState: type === 'unload' ? 'unloading' : 'loading',
    });
    return id;
  },
  endModelOperation: () => set({ modelOperation: null }),
  setAuthRequired: (required) => set({ isAuthRequired: required }),
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  setContextCompaction: (active, status = null) =>
    set({
      isContextCompacting: active,
      contextCompactionStatus: active ? (status || 'Summarizing context...') : null,
    }),
  beginRequest: (requestKey) =>
    set((state) => {
      const key = requestKey || '__global__';
      return {
        pendingRequestCount: state.pendingRequestCount + 1,
        pendingRequestsByKey: {
          ...state.pendingRequestsByKey,
          [key]: (state.pendingRequestsByKey[key] ?? 0) + 1,
        },
      };
    }),
  endRequest: (requestKey) =>
    set((state) => {
      const key = requestKey || '__global__';
      const current = state.pendingRequestsByKey[key] ?? 0;
      const nextByKey = { ...state.pendingRequestsByKey };
      if (current <= 1) {
        delete nextByKey[key];
      } else {
        nextByKey[key] = current - 1;
      }

      return {
        pendingRequestCount: Math.max(0, state.pendingRequestCount - 1),
        pendingRequestsByKey: nextByKey,
      };
    }),
  setLastError: (message) => set({ lastError: message }),
  pushToast: (message, kind = 'info', _durationMs = TOAST_DURATION_MS) => {
    const effectiveDuration = TOAST_DURATION_MS;
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, kind, createdAt: Date.now(), durationMs: effectiveDuration },
      ],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  clearStatus: () =>
    set({
      currentModel: '',
      currentConversationId: null,
      isModelRunning: false,
      isModelLoading: false,
      modelState: 'idle',
      modelOperation: null,
      modelStatusVersion: 0,
      currentProvider: 'local',
      providerFeatures: {
        local_model_lifecycle: true,
        model_downloads: true,
        multimodal: true,
      },
      providerSupportedChatParams: [],
      providerConfig: {},
      canonicalChatParams: [],
      providerConfigSchema: {},
      isAuthRequired: false,
      isContextCompacting: false,
      contextCompactionStatus: null,
      pendingRequestCount: 0,
      pendingRequestsByKey: {},
      lastError: null,
    }),
}));
