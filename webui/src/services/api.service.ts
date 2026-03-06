import { ModelItem } from '../types/chat.types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const API_KEY_STORAGE_KEYS = [
  'v1_llm_api_key',
  'llm_api_key',
  'openai_api_key',
];

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

export class ApiError extends Error {
  status: number;
  endpoint: string;
  payload: unknown;

  constructor(message: string, status: number, endpoint: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

export const readRuntimeApiKey = (): string => {
  if (typeof window === 'undefined') return API_KEY;
  for (const key of API_KEY_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value && value.trim()) return value.trim();
  }
  return API_KEY;
};

export const getApiHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(readRuntimeApiKey() ? { Authorization: `Bearer ${readRuntimeApiKey()}` } : {}),
});

const safeParseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return null;

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
};

const timeoutError = (endpoint: string, timeoutMs: number) =>
  new ApiError(`Request timeout after ${timeoutMs}ms`, 408, endpoint);

export const apiFetch = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  cfg: { timeoutMs?: number } = {},
): Promise<T> => {
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(timeoutError(endpoint, timeoutMs)), timeoutMs);

  const linkedAbort = () => {
    controller.abort(options.signal?.reason || new DOMException('Aborted', 'AbortError'));
  };
  options.signal?.addEventListener('abort', linkedAbort, { once: true });

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...getApiHeaders(),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const payload = await safeParseResponse(response);
    if (!response.ok) {
      const fromPayload =
        typeof payload === 'object' && payload !== null
          ? ((payload as any).message || (payload as any).error || (payload as any).detail)
          : payload;
      const message = typeof fromPayload === 'string' && fromPayload.trim()
        ? fromPayload
        : `HTTP ${response.status} on ${endpoint}`;
      throw new ApiError(message, response.status, endpoint, payload);
    }

    return payload as T;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', linkedAbort);
  }
};

export const fetchModels = async (): Promise<ModelItem[]> => {
  const payload = await apiFetch<{ data?: any[] }>('/v1/models', { method: 'GET' });
  if (!Array.isArray(payload?.data)) return [];

  return payload.data.map((item: any) => ({
    name: item.id,
    size_str: item.owned_by || '-',
    quant: item.object || 'model',
  }));
};
