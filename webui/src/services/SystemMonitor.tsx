import React, { useEffect, useCallback } from 'react';
import { useFetch } from '@/contexts/FetchContext';
import { useSystemStore } from './system.store';

export const SystemMonitor: React.FC = () => {
  const { apiFetch } = useFetch();
  const setStatus = useSystemStore((state) => state.setStatus);

  const fetchGlobalStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ name?: string; model?: string; running?: boolean; loading?: boolean }>(
        '/api/models/status',
        {},
        {
        requestKey: 'fetch:models_status',
        cancelPrevious: true,
        suppressGlobalError: true,
      });

      setStatus({
        currentModel: data.name || data.model || '',
        isModelRunning: Boolean(data.running),
        isModelLoading: Boolean(data.loading),
      });
    } catch (err) {
      console.warn('System monitor failed to fetch status');
    }
  }, [apiFetch, setStatus]);

  useEffect(() => {
    fetchGlobalStatus();

    const interval = setInterval(fetchGlobalStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchGlobalStatus]);

  return null;
};
