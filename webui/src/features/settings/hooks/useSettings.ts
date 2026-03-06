import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '../../../contexts/SSEContext';
import { useSettings as useSettingsContext } from '../../../contexts/SettingsContext';
import { PresetData, PresetListItem } from '../../../types/chat.types';

export const useSettings = () => {
  const { isConnected, sendPayload, lastMessage, error: wsError } = useSSE();
  const { settings, updateSetting } = useSettingsContext();

  const [presets, setPresets] = useState<PresetListItem[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      if (lastMessage.type === 'presets' && lastMessage.data) {
        const newPresets = lastMessage.data as PresetListItem[];
        setPresets(newPresets);

        if (
          selectedPresetName &&
          !newPresets.some((p) => p.name === selectedPresetName)
        ) {
          setSelectedPresetName('');
        }
        setError(null);
      } else if (lastMessage.type === 'preset_data' && lastMessage.data) {
        const data = lastMessage.data as PresetData;

        if (data.system_prompt)
          updateSetting('systemPrompt', data.system_prompt);

        if (data.parameters) {
          if (data.parameters.temperature !== undefined)
            updateSetting('temperature', data.parameters.temperature as number);
          if (data.parameters.max_tokens !== undefined)
            updateSetting('maxTokens', data.parameters.max_tokens as number);
          if (data.parameters.top_p !== undefined)
            updateSetting('topP', data.parameters.top_p as number);
          if (data.parameters.top_k !== undefined)
            updateSetting('topK', data.parameters.top_k as number);

          if (data.parameters.min_p !== undefined)
            updateSetting('minP', data.parameters.min_p as number);
          if (data.parameters.repeat_penalty !== undefined)
            updateSetting(
              'repeatPenalty',
              data.parameters.repeat_penalty as number,
            );
          if (data.parameters.frequency_penalty !== undefined)
            updateSetting(
              'frequencyPenalty',
              data.parameters.frequency_penalty as number,
            );
          if (data.parameters.presence_penalty !== undefined)
            updateSetting(
              'presencePenalty',
              data.parameters.presence_penalty as number,
            );
          if (data.parameters.seed !== undefined)
            updateSetting('seed', data.parameters.seed as number);

          if (data.parameters.n_ctx !== undefined)
            updateSetting('nCtx', data.parameters.n_ctx as number);
          if (data.parameters.n_gpu_layers !== undefined)
            updateSetting('nGpuLayers', data.parameters.n_gpu_layers as number);
          if (data.parameters.n_threads !== undefined)
            updateSetting('nThreads', data.parameters.n_threads as number);
          if (data.parameters.n_batch !== undefined)
            updateSetting('nBatch', data.parameters.n_batch as number);
        }
        setSelectedPresetName(data.name);
        setError(null);
      } else if (lastMessage.type === 'success') {
        fetchPresets();
        setError(null);
      } else if (lastMessage.type === 'error') {
        setError(lastMessage.message || 'An error occurred');
      }
    } catch (err) {
      console.error('❌ Error processing preset message:', err);
      setError(err instanceof Error ? err.message : 'Processing error');
    }
  }, [lastMessage, updateSetting]);

  const fetchPresets = useCallback(async () => {
    try {
      setError(null);
      await sendPayload({ action: 'list_presets' });
    } catch (err) {
      console.error('❌ Failed to fetch presets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch presets');
    }
  }, [sendPayload]);

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
        await sendPayload({ action: 'get_preset', name });
      } catch (err) {
        console.error('❌ Failed to load preset:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preset');
      }
    },
    [sendPayload, presets],
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
        await sendPayload({
          action: 'create_preset',
          preset: {
            name,
            description,
            system_prompt: settings.systemPrompt,
            parameters: getFullParameters(),
          },
        });
        setSelectedPresetName(name);
      } catch (err) {
        console.error('❌ Failed to create preset:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to create preset',
        );
      }
    },
    [settings.systemPrompt, getFullParameters, sendPayload],
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
        await sendPayload({
          action: 'update_preset',
          preset_id: name,
          preset: {
            name,
            description,
            system_prompt: settings.systemPrompt,
            parameters: getFullParameters(),
          },
        });
      } catch (err) {
        console.error('❌ Failed to update preset:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to update preset',
        );
      }
    },
    [settings.systemPrompt, getFullParameters, sendPayload, presets],
  );

  const deletePreset = useCallback(
    async (name: string) => {
      const presetExists = presets.some((p) => p.name === name);
      if (!presetExists) {
        setError(
          `Preset "${name}" not found. It may have been already deleted.`,
        );
        return;
      }

      try {
        setError(null);
        await sendPayload({ action: 'delete_preset', preset_id: name });
        if (selectedPresetName === name) setSelectedPresetName('');
      } catch (err) {
        console.error('❌ Failed to delete preset:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to delete preset',
        );
      }
    },
    [selectedPresetName, sendPayload, presets],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (isConnected) fetchPresets();
  }, [isConnected, fetchPresets]);

  return {
    presets,
    selectedPresetName,
    error: error || wsError,
    loadPreset,
    createPreset,
    updatePreset,
    deletePreset,
    clearError,
  };
};
