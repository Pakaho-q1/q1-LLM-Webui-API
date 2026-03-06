// src/types/chat.types.ts

// ==========================================
// 💬 ส่วนของการแชท (Chat)
// ==========================================
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ==========================================
// ⚙️ ส่วนของการตั้งค่าและ Preset (Settings)
// ==========================================
export interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  n_ctx?: number;
  n_gpu_layers?: number;
  // อนุญาตให้มีคีย์อื่นๆ เพิ่มเติมได้ในอนาคต โดยไม่ฟ้อง Error
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

// ==========================================
// 💾 ส่วนของการจัดการโมเดล (Models)
// ==========================================
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

// ==========================================
// 🔌 ส่วนของการรับส่งข้อมูลผ่าน SSE
// ==========================================
export interface WsResponse {
  type: // Chat-related messages
    | 'chunk'
    | 'done'
    | 'info'
    | 'success'
    | 'error'
    | 'status'

    // Session/History-related messages
    | 'sessions_list' // 🟢 When backend sends list of sessions
    | 'session_created' // 🟢 When a new session is created
    | 'session_renamed' // 🟢 When a session is renamed
    | 'session_deleted' // 🟢 When a session is deleted
    | 'chat_history' // 🟢 When chat history is retrieved

    // Model-related messages
    | 'token_count'
    | 'model_status'
    | 'models_list'
    | 'hf_files'
    | 'download_status'

    // Preset-related messages
    | 'presets' // For preset list
    | 'preset_data'; // For full preset data

  content?: string;
  message?: string;
  conversation_id?: string; // 🟢 For session messages
  data?: unknown; // ใช้ unknown เพื่อบังคับให้เราต้องระบุ Type ก่อนนำไปใช้เสมอ
}
