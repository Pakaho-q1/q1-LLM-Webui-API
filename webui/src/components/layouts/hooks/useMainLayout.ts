import { useSystemStore } from '@/services/system.store';

export const useMainLayout = () => {
  const currentModel = useSystemStore((state) => state.currentModel);
  const isModelRunning = useSystemStore((state) => state.isModelRunning);
  const isModelLoading = useSystemStore((state) => state.isModelLoading);
  const modelState = useSystemStore((state) => state.modelState);
  const modelOperation = useSystemStore((state) => state.modelOperation);

  return {
    currentModel,
    isModelRunning,
    isModelLoading,
    modelState,
    modelOperation,
  };
};
