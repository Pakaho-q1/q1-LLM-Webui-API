import { useSystemStore } from '@/services/system.store';

export const useMainLayout = () => {
  const currentModel = useSystemStore((state) => state.currentModel);
  const isModelRunning = useSystemStore((state) => state.isModelRunning);
  const isModelLoading = useSystemStore((state) => state.isModelLoading);

  return {
    currentModel,
    isModelRunning,
    isModelLoading,
  };
};
