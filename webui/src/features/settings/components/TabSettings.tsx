import React, { useEffect, useMemo, useState } from 'react';
import { useSettings as useSettingsContext } from '@/services/SettingsContext';
import { useSettings as usePresetLogic } from '../hooks/useSettings';
import { useProviderManager } from '../hooks/useProviderManager';
import { Tooltip } from '@/components/ui/Tooltip';
import { Combobox } from '@/components/ui/Combobox';
import { Modal } from '@/components/ui/Modal';
import { X, Save } from 'lucide-react';
import { ProviderName } from '@/types/provider.types';
import { useSystemStore } from '@/services/system.store';

interface SettingSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  tooltip?: string;
}

const SettingSlider: React.FC<SettingSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  tooltip,
}) => (
  <div className="mb-3.5 flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      {tooltip ? (
        <Tooltip content={tooltip} position="right">
          <label className="cursor-help border-b border-dotted border-[var(--border-strong)] text-[0.8rem] font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        </Tooltip>
      ) : (
        <label className="text-[0.8rem] font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-[3px] text-right text-[0.78rem] text-[var(--text-primary)]"
      />
    </div>

    <div className="relative flex h-5 items-center">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded bg-[var(--border-strong)] accent-[var(--accent)]"
      />
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5">
    <h3 className="mb-3.5 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
      {title}
    </h3>
    {children}
  </section>
);

export const TabSettings: React.FC = () => {
  const { settings, updateSetting } = useSettingsContext();
  const providerSupportedChatParams = useSystemStore(
    (state) => state.providerSupportedChatParams,
  );
  const canonicalChatParams = useSystemStore((state) => state.canonicalChatParams);
  const providerFeatures = useSystemStore((state) => state.providerFeatures);
  const {
    current: currentProviderData,
    capabilities,
    isSwitching,
    switchProvider,
    error: providerError,
    clearError: clearProviderError,
  } = useProviderManager();
  const {
    presets,
    error,
    loadPreset,
    createPreset,
    updatePreset,
    deletePreset,
    clearError,
  } = usePresetLogic();

  const [newPresetName, setNewPresetName] = useState('');
  const [selectedDropdown, setSelectedDropdown] = useState('');
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [presetToUpdate, setPresetToUpdate] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>('local');
  const [providerConfigDraft, setProviderConfigDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentProviderData) return;
    setSelectedProvider(currentProviderData.provider);
    const draft: Record<string, string> = {};
    Object.entries(currentProviderData.config || {}).forEach(([key, value]) => {
      if (key === 'has_api_key') return;
      draft[key] = typeof value === 'string' ? value : String(value ?? '');
    });
    setProviderConfigDraft(draft);
  }, [currentProviderData]);

  const activeSchema = useMemo(() => {
    const schema = currentProviderData?.config_schema || capabilities?.config_schema || {};
    return (schema as Record<string, any>)[selectedProvider] || { fields: [], description: '' };
  }, [capabilities?.config_schema, currentProviderData?.config_schema, selectedProvider]);

  const combinedError = providerError || error;
  const supports = (param: string) => providerSupportedChatParams.includes(param);
  const unsupportedCanonicalParams = useMemo(
    () =>
      (canonicalChatParams || []).filter(
        (p) => !providerSupportedChatParams.includes(p),
      ),
    [canonicalChatParams, providerSupportedChatParams],
  );

  return (
    <div className="pb-10">
      {combinedError && (
        <div className="mb-3 flex animate-[fadeIn_0.2s_both] items-center justify-between rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3.5 py-2.5 text-[0.83rem] text-[var(--danger)]">
          <span>{combinedError}</span>
          <button
            onClick={() => {
              clearError();
              clearProviderError();
            }}
            className="text-[var(--danger)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <Section title="Provider">
        <div className="mb-3">
          <Combobox
            className="w-full"
            options={[
              { value: 'local', searchText: 'local', label: <span>Local</span> },
              { value: 'ollama', searchText: 'ollama', label: <span>Ollama</span> },
              { value: 'openai', searchText: 'openai', label: <span>OpenAI</span> },
            ]}
            value={selectedProvider}
            onChange={(value) => setSelectedProvider(value as ProviderName)}
            placeholder="Select provider..."
          />
        </div>
        {activeSchema.description && (
          <p className="mb-3 text-[0.78rem] text-[var(--text-tertiary)]">
            {activeSchema.description}
          </p>
        )}
        {(activeSchema.fields || []).map((field: any) => (
          <div key={field.key} className="mb-2.5">
            <label className="mb-1 block text-[0.78rem] font-medium text-[var(--text-secondary)]">
              {field.key}
              {field.required ? ' *' : ''}
            </label>
            <input
              type={field.type === 'secret' ? 'password' : 'text'}
              value={providerConfigDraft[field.key] ?? ''}
              placeholder={field.default || ''}
              onChange={(e) =>
                setProviderConfigDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[0.83rem] text-[var(--text-primary)]"
            />
          </div>
        ))}
        <button
          onClick={() => switchProvider(selectedProvider, providerConfigDraft)}
          disabled={isSwitching}
          className="mt-1 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[0.8rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSwitching ? 'Applying...' : 'Apply Provider'}
        </button>
        {currentProviderData?.supported_chat_params?.length ? (
          <p className="mt-2 text-[0.75rem] text-[var(--text-tertiary)]">
            Supported chat params: {currentProviderData.supported_chat_params.join(', ')}
          </p>
        ) : null}
        {unsupportedCanonicalParams.length > 0 && (
          <p className="mt-1 text-[0.75rem] text-[var(--warning)]">
            Disabled for this provider: {unsupportedCanonicalParams.join(', ')}
          </p>
        )}
      </Section>

      <Section title="Presets">
        <div className="mb-2.5">
          <Combobox
            className="w-full"
            options={presets.map((p) => ({
              value: p.name,
              searchText: p.name,
              label: (
                <span className="text-[0.83rem] text-[var(--text-primary)]">
                  {p.name}
                </span>
              ),
            }))}
            value={selectedDropdown}
            onChange={setSelectedDropdown}
            placeholder="Search presets…"
          />
        </div>

        <div className="mb-2.5 flex gap-1.5">
          {[
            {
              label: 'Load',
              action: () => selectedDropdown && loadPreset(selectedDropdown),
              className:
                'border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]',
            },
            {
              label: 'Update',
              action: () => setPresetToUpdate(selectedDropdown),
              className:
                'border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]',
            },
            {
              label: 'Delete',
              action: () => setPresetToDelete(selectedDropdown),
              className:
                'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]',
            },
          ].map(({ label, action, className }) => (
            <button
              key={label}
              onClick={action}
              disabled={!selectedDropdown}
              className={`flex-1 rounded-lg border py-1.5 text-[0.78rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New preset name…"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              newPresetName.trim() &&
              (createPreset(newPresetName, ''), setNewPresetName(''))
            }
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-[7px] text-[0.8rem] text-[var(--text-primary)]"
          />
          <button
            onClick={() => {
              if (newPresetName.trim()) {
                createPreset(newPresetName, '');
                setNewPresetName('');
              }
            }}
            disabled={!newPresetName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-[7px] text-[0.78rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} /> Save
          </button>
        </div>
      </Section>

      <Modal
        isOpen={!!presetToDelete}
        onClose={() => setPresetToDelete(null)}
        onConfirm={async () => {
          if (presetToDelete) {
            await deletePreset(presetToDelete);
            setPresetToDelete(null);
          }
        }}
        title="Delete Preset"
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-[0.875rem] text-[var(--text-secondary)]">
          Delete preset{' '}
          <strong className="text-[var(--text-primary)]">
            "{presetToDelete}"
          </strong>
          ?
        </p>
      </Modal>

      <Modal
        isOpen={!!presetToUpdate}
        onClose={() => setPresetToUpdate(null)}
        onConfirm={async () => {
          if (presetToUpdate) {
            await updatePreset(presetToUpdate, '');
            setPresetToUpdate(null);
          }
        }}
        title="Update Preset"
        confirmText="Update"
        confirmVariant="primary"
      >
        <p className="text-[0.875rem] text-[var(--text-secondary)]">
          Update{' '}
          <strong className="text-[var(--text-primary)]">
            "{presetToUpdate}"
          </strong>{' '}
          with current settings?
        </p>
      </Modal>

      <Section title="System Prompt">
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSetting('systemPrompt', e.target.value)}
          rows={4}
          className="custom-scrollbar min-h-[90px] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-[0.83rem] text-[var(--text-primary)]"
        />
      </Section>

      <Section title="Sampling">
        {supports('temperature') && (
          <SettingSlider
            label="Temperature"
            value={settings.temperature}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('temperature', v)}
            tooltip="Randomness: lower=focused, higher=creative"
          />
        )}
        {supports('max_tokens') && (
          <SettingSlider
            label="Max Tokens"
            value={settings.maxTokens}
            min={128}
            max={8192}
            step={128}
            onChange={(v) => updateSetting('maxTokens', v)}
            tooltip="Maximum tokens to generate per response"
          />
        )}
        {supports('top_p') && (
          <SettingSlider
            label="Top P"
            value={settings.topP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSetting('topP', v)}
            tooltip="Nucleus sampling threshold"
          />
        )}
        {supports('top_k') && (
          <SettingSlider
            label="Top K"
            value={settings.topK}
            min={0}
            max={100}
            step={1}
            onChange={(v) => updateSetting('topK', v)}
            tooltip="Limit vocabulary to top K tokens"
          />
        )}
      </Section>

      <Section title="Penalties">
        {supports('min_p') && (
          <SettingSlider
            label="Min P"
            value={settings.minP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSetting('minP', v)}
            tooltip="Minimum probability relative to top token"
          />
        )}
        {supports('repeat_penalty') && (
          <SettingSlider
            label="Repeat Penalty"
            value={settings.repeatPenalty}
            min={1}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('repeatPenalty', v)}
            tooltip="Discourage repeating same phrases"
          />
        )}
        {supports('presence_penalty') && (
          <SettingSlider
            label="Presence Penalty"
            value={settings.presencePenalty}
            min={-2}
            max={2}
            step={0.1}
            onChange={(v) => updateSetting('presencePenalty', v)}
            tooltip="Encourage talking about new topics"
          />
        )}
        {supports('frequency_penalty') && (
          <SettingSlider
            label="Frequency Penalty"
            value={settings.frequencyPenalty}
            min={-2}
            max={2}
            step={0.1}
            onChange={(v) => updateSetting('frequencyPenalty', v)}
            tooltip="Reduce repetition by frequency"
          />
        )}
      </Section>

      {providerFeatures.local_model_lifecycle && (
      <Section title="Hardware (Requires Reload)">
        <p className="-mt-1.5 mb-3 text-[0.76rem] text-[var(--text-tertiary)]">
          Changes take effect after model reload.
        </p>
        <SettingSlider
          label="Context Size (n_ctx)"
          value={settings.nCtx}
          min={512}
          max={32768}
          step={512}
          onChange={(v) => updateSetting('nCtx', v)}
          tooltip="Max tokens the model can remember (affects VRAM)"
        />
        <SettingSlider
          label="GPU Layers (-1 = All)"
          value={settings.nGpuLayers}
          min={-1}
          max={100}
          step={1}
          onChange={(v) => updateSetting('nGpuLayers', v)}
          tooltip="Layers to offload to GPU (-1 = all)"
        />
        <SettingSlider
          label="CPU Threads"
          value={settings.nThreads}
          min={1}
          max={32}
          step={1}
          onChange={(v) => updateSetting('nThreads', v)}
          tooltip="Number of CPU threads for generation"
        />
        <SettingSlider
          label="Batch Size (n_batch)"
          value={settings.nBatch}
          min={128}
          max={2048}
          step={128}
          onChange={(v) => updateSetting('nBatch', v)}
          tooltip="Tokens to process in parallel"
        />
      </Section>
      )}
    </div>
  );
};
