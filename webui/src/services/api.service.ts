import { ModelItem } from '../types/chat.types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';

const API_KEY = import.meta.env.VITE_LLM_API_KEY || '';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  [key: string]: unknown;
}

export const getApiHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
});

export const fetchModels = async (): Promise<ModelItem[]> => {
  const response = await fetch(`${API_BASE}/v1/models`, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Invalid API key');
    }
    throw new Error('Failed to fetch models');
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.data)) return [];

  return payload.data.map((item: any) => ({
    name: item.id,
    size_str: item.owned_by || '-',
    quant: item.object || 'model',
  }));
};
