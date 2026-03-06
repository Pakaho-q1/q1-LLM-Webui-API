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
  isAuthRequired: boolean;
  activeSidebarTab: SidebarTab;
  pendingRequestCount: number;
  pendingRequestsByKey: Record<string, number>;
  lastError: string | null;
  toasts: ToastItem[];

  setStatus: (status: Partial<SystemState>) => void;
  setModelStatus: (status: {
    currentModel?: string;
    isModelRunning?: boolean;
    isModelLoading?: boolean;
  }) => void;
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
  isAuthRequired: false,
  activeSidebarTab: 'history',
  pendingRequestCount: 0,
  pendingRequestsByKey: {},
  lastError: null,
  toasts: [],

  setStatus: (newStatus) => set((state) => ({ ...state, ...newStatus })),
  setModelStatus: (status) =>
    set((state) => ({
      ...state,
      currentModel: status.currentModel ?? state.currentModel,
      isModelRunning: status.isModelRunning ?? state.isModelRunning,
      isModelLoading: status.isModelLoading ?? state.isModelLoading,
    })),
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
      isAuthRequired: false,
      pendingRequestCount: 0,
      pendingRequestsByKey: {},
      lastError: null,
    }),
}));
