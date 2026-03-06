export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  n_ctx?: number;
  n_gpu_layers?: number;

  [key: string]: unknown;
}

export interface PresetData {
  name: string;
  description: string;
  system_prompt: string;
  parameters: ModelParameters;
}

export interface PresetListItem {
  name: string;
  description: string;
}

export interface ModelItem {
  name: string;
  size_str: string;
  quant: string;
}

export interface HfFile {
  name: string;
  url: string;
  quant: string;
  size_str: string;
}

export interface WsResponse {
  type:
    | 'chunk'
    | 'done'
    | 'info'
    | 'success'
    | 'error'
    | 'status'
    | 'sessions_list'
    | 'session_created'
    | 'session_renamed'
    | 'session_deleted'
    | 'chat_history'
    | 'token_count'
    | 'model_status'
    | 'models_list'
    | 'hf_files'
    | 'download_status'
    | 'presets'
    | 'preset_data';

  content?: string;
  message?: string;
  conversation_id?: string;
  data?: unknown;
}
export interface SessionItem {
  id: string;
  title: string;
  updated_at?: number;
}

export interface HistoryMessage {
  role: ChatRole;
  content: string;
}
