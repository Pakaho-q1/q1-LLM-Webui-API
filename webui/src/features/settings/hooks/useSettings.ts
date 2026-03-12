import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettings as useSettingsContext } from '../../../services/SettingsContext';
import { PresetData, PresetListItem } from '../../../types/chat.types';
import { presetKey, presetsKey, STALE_TIME_MS } from '@/services/dataClient';
import { useFetch } from '@/contexts/FetchContext';

const extractErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const useSettings = () => {
  const { settings, updateSetting } = useSettingsContext();
  const { apiFetch } = useFetch();
  const queryClient = useQueryClient();

  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const presetsQuery = useQuery({
    queryKey: presetsKey,
    queryFn: async () => {
      const res = await apiFetch<{ data?: PresetListItem[] }>('/api/presets', {
        method: 'GET',
      });
      return Array.isArray(res?.data) ? res.data : [];
    },
    staleTime: STALE_TIME_MS,
  });

  const applyPresetData = useCallback(
    (data: PresetData) => {
      if (data.system_prompt) updateSetting('systemPrompt', data.system_prompt);

      if (data.parameters) {
        if (data.parameters.temperature !== undefined) updateSetting('temperature', data.parameters.temperature as number);
        if (data.parameters.max_tokens !== undefined) updateSetting('maxTokens', data.parameters.max_tokens as number);
        if (data.parameters.top_p !== undefined) updateSetting('topP', data.parameters.top_p as number);
        if (data.parameters.top_k !== undefined) updateSetting('topK', data.parameters.top_k as number);
        if (data.parameters.min_p !== undefined) updateSetting('minP', data.parameters.min_p as number);
        if (data.parameters.repeat_penalty !== undefined) updateSetting('repeatPenalty', data.parameters.repeat_penalty as number);
        if (data.parameters.frequency_penalty !== undefined) updateSetting('frequencyPenalty', data.parameters.frequency_penalty as number);
        if (data.parameters.presence_penalty !== undefined) updateSetting('presencePenalty', data.parameters.presence_penalty as number);
        if (data.parameters.seed !== undefined) updateSetting('seed', data.parameters.seed as number);
        if (data.parameters.n_ctx !== undefined) updateSetting('nCtx', data.parameters.n_ctx as number);
        if (data.parameters.n_gpu_layers !== undefined) updateSetting('nGpuLayers', data.parameters.n_gpu_layers as number);
        if (data.parameters.n_threads !== undefined) updateSetting('nThreads', data.parameters.n_threads as number);
        if (data.parameters.n_batch !== undefined) updateSetting('nBatch', data.parameters.n_batch as number);
        if (data.parameters.context_compaction_threshold !== undefined) {
          updateSetting('contextCompactionThreshold', data.parameters.context_compaction_threshold as number);
        }
      }
      setSelectedPresetName(data.name);
      setError(null);
    },
    [updateSetting],
  );

  const presetFetcher = useCallback(
    async (name: string) => {
      const res = await apiFetch<{ data?: PresetData }>(
        `/api/presets/${encodeURIComponent(name)}`,
        { method: 'GET' },
      );
      if (!res?.data) {
        throw new Error('Preset data not found');
      }
      return res.data;
    },
    [],
  );

  const getFullParameters = useCallback(
    () => ({
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      top_p: settings.topP,
      top_k: settings.topK,
      min_p: settings.minP,
      repeat_penalty: settings.repeatPenalty,
      frequency_penalty: settings.frequencyPenalty,
      presence_penalty: settings.presencePenalty,
      seed: settings.seed,
      n_ctx: settings.nCtx,
      n_gpu_layers: settings.nGpuLayers,
      n_threads: settings.nThreads,
      n_batch: settings.nBatch,
      context_compaction_threshold: settings.contextCompactionThreshold,
    }),
    [settings],
  );

  const createPresetMutation = useMutation({
    mutationFn: async (args: { name: string; description: string }) =>
      apiFetch('/api/presets', {
        method: 'POST',
        body: JSON.stringify({
          preset: {
            name: args.name,
            description: args.description,
            system_prompt: settings.systemPrompt,
            parameters: getFullParameters(),
          },
        }),
      }),
    onSuccess: (_res, args) => {
      setSelectedPresetName(args.name);
      queryClient.invalidateQueries({ queryKey: presetsKey });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: async (args: { name: string; description?: string }) =>
      apiFetch(`/api/presets/${encodeURIComponent(args.name)}`, {
        method: 'PUT',
        body: JSON.stringify({
          preset: {
            name: args.name,
            description: args.description ?? '',
            system_prompt: settings.systemPrompt,
            parameters: getFullParameters(),
          },
        }),
      }),
    onSuccess: (_res, args) => {
      queryClient.invalidateQueries({ queryKey: presetKey(args.name) });
      queryClient.invalidateQueries({ queryKey: presetsKey });
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (name: string) =>
      apiFetch(`/api/presets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),
    onSuccess: (_res, name) => {
      if (selectedPresetName === name) setSelectedPresetName('');
      queryClient.invalidateQueries({ queryKey: presetKey(name) });
      queryClient.invalidateQueries({ queryKey: presetsKey });
    },
  });

  const loadPreset = useCallback(
    async (name: string) => {
      try {
        if (!name.trim()) {
          setError('Please select a preset to load');
          return;
        }
        setError(null);
        const data = await queryClient.ensureQueryData({
          queryKey: presetKey(name),
          queryFn: () => presetFetcher(name),
          staleTime: STALE_TIME_MS,
        });
        applyPresetData(data);
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to load preset'));
      }
    },
    [applyPresetData, presetFetcher, queryClient],
  );

  const createPreset = useCallback(
    async (name: string, description: string) => {
      try {
        if (!name.trim()) {
          setError('Preset name cannot be empty');
          return;
        }
        setError(null);
        await createPresetMutation.mutateAsync({ name, description });
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to create preset'));
      }
    },
    [createPresetMutation],
  );

  const updatePreset = useCallback(
    async (name: string, description: string = '') => {
      const presetExists = (presetsQuery.data ?? []).some((p) => p.name === name);
      if (!presetExists) {
        setError(`Preset "${name}" not found. It may have been deleted.`);
        return;
      }

      try {
        setError(null);
        await updatePresetMutation.mutateAsync({ name, description });
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to update preset'));
      }
    },
    [presetsQuery.data, updatePresetMutation],
  );

  const deletePreset = useCallback(
    async (name: string) => {
      const presetExists = (presetsQuery.data ?? []).some((p) => p.name === name);
      if (!presetExists) {
        setError(`Preset "${name}" not found. It may have been already deleted.`);
        return;
      }

      try {
        setError(null);
        await deletePresetMutation.mutateAsync(name);
      } catch (err) {
        setError(extractErrorMessage(err, 'Failed to delete preset'));
      }
    },
    [deletePresetMutation, presetsQuery.data],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const queryError = useMemo(() => {
    if (presetsQuery.error) {
      return extractErrorMessage(presetsQuery.error, 'Failed to fetch presets');
    }
    return null;
  }, [presetsQuery.error]);

  return {
    presets: presetsQuery.data ?? [],
    selectedPresetName,
    error: error ?? queryError,
    loadPreset,
    createPreset,
    updatePreset,
    deletePreset,
    clearError,
  };
};
