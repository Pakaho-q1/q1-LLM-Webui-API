import { create } from 'zustand';

export type SidebarTab = 'history' | 'models' | 'settings';

export interface ToastItem {
  id: string;
  message: string;
  kind: 'error' | 'warning' | 'success' | 'info';
  createdAt: number;
  durationMs: number;
}

interface SystemState {
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
  isAuthRequired: boolean;
  activeSidebarTab: SidebarTab;
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
      source?: 'local' | 'sse' | 'init';
      timestamp?: number;
      requestId?: string;
    },
  ) => void;
  beginModelOperation: (type: 'load' | 'unload', targetModel?: string) => string;
  endModelOperation: () => void;
  setAuthRequired: (required: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
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
}

export const useSystemStore = create<SystemState>((set) => ({
  currentModel: '',
  isModelRunning: false,
  isModelLoading: false,
  modelState: 'idle',
  modelOperation: null,
  modelStatusVersion: 0,
  isAuthRequired: false,
  activeSidebarTab: 'history',
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

      if (source === 'sse' && op) {
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
  pushToast: (message, kind = 'info', durationMs = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, kind, createdAt: Date.now(), durationMs },
      ],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
  clearStatus: () =>
    set({
      currentModel: '',
      isModelRunning: false,
      isModelLoading: false,
      modelState: 'idle',
      modelOperation: null,
      modelStatusVersion: 0,
      isAuthRequired: false,
      pendingRequestCount: 0,
      pendingRequestsByKey: {},
      lastError: null,
    }),
}));
