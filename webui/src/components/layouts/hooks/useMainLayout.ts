import { useEffect, useState } from 'react';
import { useSSE } from '../../../contexts/SSEContext';

export const useMainLayout = () => {
  const { lastMessage } = useSSE();

  const [currentModel, setCurrentModel] = useState<string>('');
  const [isModelRunning, setIsModelRunning] = useState<boolean>(false);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'model_status') {
      const data = (lastMessage as any).data || {};
      setIsModelRunning(Boolean(data.running));

      setCurrentModel(data.name || data.model || '');

      if (typeof data.loading === 'boolean') {
        setIsModelLoading(Boolean(data.loading));
      } else {
        setIsModelLoading(
          Boolean(data.running) === false && Boolean(data.name),
        );
      }
      return;
    }

    if (['status', 'info'].includes(lastMessage.type)) {
      const msg = (lastMessage as any).message || '';
      const lower = String(msg).toLowerCase();
      if (lower.includes('loading')) setIsModelLoading(true);
      if (
        lower.includes('loaded') ||
        lower.includes('unloaded') ||
        lower.includes('error')
      ) {
        setIsModelLoading(false);
        if (lower.includes('loaded')) setIsModelRunning(true);
        if (lower.includes('unloaded')) setIsModelRunning(false);
      }
    }
  }, [lastMessage]);

  return {
    currentModel,
    isModelRunning,
    isModelLoading,
  };
};
