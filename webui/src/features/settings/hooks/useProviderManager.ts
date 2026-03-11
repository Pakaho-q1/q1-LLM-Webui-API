import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  providerCapabilitiesKey,
  providerCurrentKey,
  modelStatusKey,
  localModelsKey,
  downloadsKey,
} from '@/services/dataClient';
import {
  ProviderCapabilitiesResponse,
  ProviderCurrentResponse,
  ProviderName,
  ProviderSetPayload,
} from '@/types/provider.types';
import { useSystemStore } from '@/services/system.store';
import { useFetch } from '@/contexts/FetchContext';
import { emitTelemetryEvent } from '@/services/telemetry';

const extractErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const useProviderManager = () => {
  const [error, setError] = useState<string | null>(null);
  const { apiFetch } = useFetch();
  const queryClient = useQueryClient();
  const setProviderState = useSystemStore((state) => state.setProviderState);

  const providerCurrentQuery = useQuery({
    queryKey: providerCurrentKey,
    queryFn: async () =>
      apiFetch<ProviderCurrentResponse>('/api/provider/current', { method: 'GET' }),
    onSuccess: (res: ProviderCurrentResponse) => {
      setProviderState({
        currentProvider: res.provider,
        providerFeatures: res.features,
        providerSupportedChatParams: res.supported_chat_params || [],
        providerConfig: res.config || {},
        providerConfigSchema: res.config_schema || {},
      });
    },
  });

  const providerCapabilitiesQuery = useQuery({
    queryKey: providerCapabilitiesKey,
    queryFn: async () =>
      apiFetch<ProviderCapabilitiesResponse>('/api/providers/capabilities', { method: 'GET' }),
    onSuccess: (res: ProviderCapabilitiesResponse) => {
      setProviderState({
        canonicalChatParams: res.canonical_chat_params || [],
        providerConfigSchema: res.config_schema || {},
      });
    },
  });

  const switchProviderMutation = useMutation({
    mutationFn: (payload: ProviderSetPayload) =>
      apiFetch('/api/provider/current', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: providerCurrentKey });
      await queryClient.cancelQueries({ queryKey: modelStatusKey });

      const capabilities = queryClient.getQueryData<ProviderCapabilitiesResponse>(providerCapabilitiesKey);
      const providerData = capabilities?.providers?.[payload.provider];
      setProviderState({
        currentProvider: payload.provider,
        providerFeatures: providerData?.features,
        providerSupportedChatParams: providerData?.supported_chat_params || [],
        providerConfig: payload.config || {},
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: providerCurrentKey });
      await queryClient.invalidateQueries({ queryKey: providerCapabilitiesKey });
      await queryClient.invalidateQueries({ queryKey: modelStatusKey });
      await queryClient.invalidateQueries({ queryKey: localModelsKey });
      await queryClient.invalidateQueries({ queryKey: downloadsKey });
      await queryClient.refetchQueries({ queryKey: providerCurrentKey, type: 'active' });
      await queryClient.refetchQueries({ queryKey: modelStatusKey, type: 'active' });
      await queryClient.refetchQueries({ queryKey: localModelsKey, type: 'active' });
      setError(null);
    },
  });

  const switchProvider = useCallback(
    async (provider: ProviderName, config: Record<string, unknown>) => {
      const startedAt = performance.now();
      emitTelemetryEvent({
        name: 'provider_switch_start',
        target_provider: provider,
        has_config: Object.keys(config || {}).length > 0,
      });
      try {
        setError(null);
        await switchProviderMutation.mutateAsync({ provider, config });
        emitTelemetryEvent({
          name: 'provider_switch_success',
          target_provider: provider,
          duration_ms: Math.round(performance.now() - startedAt),
        });
      } catch (err) {
        emitTelemetryEvent({
          name: 'provider_switch_error',
          target_provider: provider,
          duration_ms: Math.round(performance.now() - startedAt),
          error_name: err instanceof Error ? err.name : 'Error',
          error_message: extractErrorMessage(err, 'Failed to switch provider'),
        });
        setError(extractErrorMessage(err, 'Failed to switch provider'));
      }
    },
    [switchProviderMutation],
  );

  const queryError = useMemo(() => {
    if (providerCurrentQuery.error) {
      return extractErrorMessage(providerCurrentQuery.error, 'Failed to fetch provider status');
    }
    if (providerCapabilitiesQuery.error) {
      return extractErrorMessage(providerCapabilitiesQuery.error, 'Failed to fetch provider capabilities');
    }
    return null;
  }, [providerCurrentQuery.error, providerCapabilitiesQuery.error]);

  return {
    current: providerCurrentQuery.data || null,
    capabilities: providerCapabilitiesQuery.data || null,
    isSwitching: switchProviderMutation.isPending,
    switchProvider,
    error: error ?? queryError,
    clearError: () => setError(null),
  };
};
