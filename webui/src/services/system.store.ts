import { create } from 'zustand';

interface SystemState {
  currentModel: string;
  isModelRunning: boolean;
  isModelLoading: boolean;

  setStatus: (status: Partial<SystemState>) => void;
  clearStatus: () => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  currentModel: '',
  isModelRunning: false,
  isModelLoading: false,

  setStatus: (newStatus) => set((state) => ({ ...state, ...newStatus })),
  clearStatus: () =>
    set({ currentModel: '', isModelRunning: false, isModelLoading: false }),
}));
