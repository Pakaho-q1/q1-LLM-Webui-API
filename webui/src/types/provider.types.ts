export type ProviderName = 'local' | 'ollama' | 'openai';

export interface ProviderFeatures {
  local_model_lifecycle: boolean;
  model_downloads: boolean;
  multimodal: boolean;
}

export interface ProviderConfigField {
  key: string;
  type: 'string' | 'secret';
  required: boolean;
  default?: string;
}

export interface ProviderConfigSchemaItem {
  fields: ProviderConfigField[];
  description: string;
}

export interface ProviderCurrentResponse {
  provider: ProviderName;
  model: string;
  supported_chat_params: string[];
  features: ProviderFeatures;
  config: Record<string, unknown>;
  config_schema: Record<ProviderName, ProviderConfigSchemaItem>;
}

export interface ProviderSetPayload {
  provider: ProviderName;
  config: Record<string, unknown>;
}

export interface ProviderSetResponse {
  status: 'ok';
  data: {
    provider: ProviderName;
    model: string;
    supported_chat_params: string[];
    features: ProviderFeatures;
    config: Record<string, unknown>;
  };
}

export interface ProviderCapabilitiesResponse {
  current_provider: ProviderName;
  current: {
    provider: ProviderName;
    supported_chat_params: string[];
    features: ProviderFeatures;
  };
  canonical_chat_params: string[];
  providers: Record<
    ProviderName,
    {
      provider: ProviderName;
      supported_chat_params: string[];
      features: ProviderFeatures;
    }
  >;
  config_schema: Record<ProviderName, ProviderConfigSchemaItem>;
}
