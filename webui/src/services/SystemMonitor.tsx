import React, { useCallback, useEffect, useRef } from 'react';
import { useFetch } from '@/contexts/FetchContext';
import { useSystemStore } from './system.store';
import { ProviderCapabilitiesResponse, ProviderCurrentResponse } from '@/types/provider.types';

const BASE_POLL_MS = 8000;
const MAX_POLL_MS = 60000;
const PROVIDER_SYNC_MS = 30000;

export const SystemMonitor: React.FC = () => {
  const { apiFetch } = useFetch();
  const setModelStatus = useSystemStore((state) => state.setModelStatus);
  const setProviderState = useSystemStore((state) => state.setProviderState);
  const activeSidebarTab = useSystemStore((state) => state.activeSidebarTab);

  const timerRef = useRef<number | null>(null);
  const failureCountRef = useRef(0);
  const lastProviderSyncAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextTick = useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void pollStatus();
      }, delayMs);
    },
    [clearTimer],
  );

  const fetchProviderCapabilitiesOnce = useCallback(async () => {
    try {
      const providerCapabilities = await apiFetch<ProviderCapabilitiesResponse>(
        '/api/providers/capabilities',
        {},
        {
          requestKey: 'fetch:provider_capabilities',
          cancelPrevious: true,
          suppressGlobalError: true,
        },
      );

      setProviderState({
        canonicalChatParams: providerCapabilities.canonical_chat_params || [],
        providerConfigSchema: providerCapabilities.config_schema || {},
      });
    } catch {
      // Ignore bootstrap failure. Runtime flows can still recover from manual actions.
    }
  }, [apiFetch, setProviderState]);

  const fetchModelStatus = useCallback(async () => {
    const data = await apiFetch<{ name?: string; model?: string; running?: boolean; loading?: boolean }>(
      '/api/models/status',
      {},
      {
        requestKey: 'fetch:models_status',
        cancelPrevious: true,
        suppressGlobalError: true,
      },
    );

    setModelStatus(
      {
        currentModel: data.name || data.model || '',
        isModelRunning: Boolean(data.running),
        isModelLoading: Boolean(data.loading),
      },
      { source: 'poll', timestamp: Date.now() },
    );
  }, [apiFetch, setModelStatus]);

  const fetchProviderCurrent = useCallback(async () => {
    const providerCurrent = await apiFetch<ProviderCurrentResponse>(
      '/api/provider/current',
      {},
      {
        requestKey: 'fetch:provider_current',
        cancelPrevious: true,
        suppressGlobalError: true,
      },
    );

    setProviderState({
      currentProvider: providerCurrent.provider,
      providerFeatures: providerCurrent.features,
      providerSupportedChatParams: providerCurrent.supported_chat_params || [],
      providerConfig: providerCurrent.config || {},
    });
    lastProviderSyncAtRef.current = Date.now();
  }, [apiFetch, setProviderState]);

  const pollStatus = useCallback(async () => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    try {
      await fetchModelStatus();

      const shouldSyncProvider =
        activeSidebarTab !== 'history' ||
        Date.now() - lastProviderSyncAtRef.current > PROVIDER_SYNC_MS;

      if (shouldSyncProvider) {
        await fetchProviderCurrent();
      }

      failureCountRef.current = 0;
    } catch {
      failureCountRef.current += 1;
    } finally {
      const backoff = Math.min(
        BASE_POLL_MS * 2 ** failureCountRef.current,
        MAX_POLL_MS,
      );
      scheduleNextTick(backoff);
    }
  }, [
    activeSidebarTab,
    fetchModelStatus,
    fetchProviderCurrent,
    scheduleNextTick,
  ]);

  useEffect(() => {
    const bootstrap = async () => {
      await fetchProviderCapabilitiesOnce();
      await pollStatus();
    };
    void bootstrap();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pollStatus();
        return;
      }
      clearTimer();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      clearTimer();
    };
  }, [clearTimer, fetchProviderCapabilitiesOnce, pollStatus]);

  useEffect(() => {
    if (document.visibilityState !== 'visible') return;
    if (activeSidebarTab === 'history') return;
    void pollStatus();
  }, [activeSidebarTab, pollStatus]);

  return null;
};
