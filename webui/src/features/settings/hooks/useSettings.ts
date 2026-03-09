import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/services/api.service';
import { useSettings as useSettingsContext } from '../../../services/SettingsContext';
import { PresetData, PresetListItem } from '../../../types/chat.types';

export const useSettings = () => {
  const { settings, updateSetting } = useSettingsContext();

  const [presets, setPresets] = useState<PresetListItem[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
      }
      setSelectedPresetName(data.name);
      setError(null);
    },
    [updateSetting],
  );

  const fetchPresets = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetch<{ data?: PresetListItem[] }>('/api/presets', {
        method: 'GET',
      });
      const newPresets = Array.isArray(res?.data) ? res.data : [];
      setPresets(newPresets);
      setSelectedPresetName((prev) =>
        prev && !newPresets.some((p) => p.name === prev) ? '' : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch presets');
    }
  }, []);

  const loadPreset = useCallback(
    async (name: string) => {
      try {
        if (!name.trim()) {
          setError('Please select a preset to load');
          return;
        }

        const presetExists = presets.some((p) => p.name === name);
        if (!presetExists) {
          setError(`Preset "${name}" not found. It may have been deleted.`);
          return;
        }

        setError(null);
        const res = await apiFetch<{ data?: PresetData }>(
          `/api/presets/${encodeURIComponent(name)}`,
          { method: 'GET' },
        );
        if (!res?.data) {
          throw new Error('Preset data not found');
        }
        applyPresetData(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preset');
      }
    },
    [applyPresetData, presets],
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
    }),
    [settings],
  );

  const createPreset = useCallback(
    async (name: string, description: string) => {
      try {
        if (!name.trim()) {
          setError('Preset name cannot be empty');
          return;
        }
        setError(null);
        await apiFetch('/api/presets', {
          method: 'POST',
          body: JSON.stringify({
            preset: {
              name,
              description,
              system_prompt: settings.systemPrompt,
              parameters: getFullParameters(),
            },
          }),
        });
        setSelectedPresetName(name);
        await fetchPresets();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create preset');
      }
    },
    [fetchPresets, getFullParameters, settings.systemPrompt],
  );

  const updatePreset = useCallback(
    async (name: string, description: string = '') => {
      const presetExists = presets.some((p) => p.name === name);
      if (!presetExists) {
        setError(`Preset "${name}" not found. It may have been deleted.`);
        return;
      }

      try {
        setError(null);
        await apiFetch(`/api/presets/${encodeURIComponent(name)}`, {
          method: 'PUT',
          body: JSON.stringify({
            preset: {
              name,
              description,
              system_prompt: settings.systemPrompt,
              parameters: getFullParameters(),
            },
          }),
        });
        await fetchPresets();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update preset');
      }
    },
    [fetchPresets, getFullParameters, presets, settings.systemPrompt],
  );

  const deletePreset = useCallback(
    async (name: string) => {
      const presetExists = presets.some((p) => p.name === name);
      if (!presetExists) {
        setError(`Preset "${name}" not found. It may have been already deleted.`);
        return;
      }

      try {
        setError(null);
        await apiFetch(`/api/presets/${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });
        if (selectedPresetName === name) setSelectedPresetName('');
        await fetchPresets();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete preset');
      }
    },
    [fetchPresets, presets, selectedPresetName],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    selectedPresetName,
    error,
    loadPreset,
    createPreset,
    updatePreset,
    deletePreset,
    clearError,
  };
};
