import { ChatStreamMetrics, ModelItem } from '../types/chat.types';
import {
  ProviderCapabilitiesResponse,
  ProviderCurrentResponse,
  ProviderSetPayload,
  ProviderSetResponse,
} from '../types/provider.types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const API_KEY_STORAGE_KEYS = [
  'v1_llm_api_key',
  'llm_api_key',
  'openai_api_key',
];

const API_KEY = import.meta.env.VITE_LLM_API_KEY || '';

export interface OpenAIContentPartText {
  type: 'text';
  text: string;
}

export interface OpenAIContentPartImage {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | (OpenAIContentPartText | OpenAIContentPartImage)[];
}

export interface OpenAIChatCompletionRequest {
  model?: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  request_id?: string;
  [key: string]: unknown;
}

export interface OpenAIFileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
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

export const getApiHeaders = (includeJsonContentType = true): HeadersInit => ({
  ...(includeJsonContentType ? { 'Content-Type': 'application/json' } : {}),
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

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...getApiHeaders(!isFormData),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const payload = await safeParseResponse(response);
    if (!response.ok) {
      const fromPayload =
        typeof payload === 'object' && payload !== null
          ? ((payload as any).message || (payload as any).error?.message || (payload as any).error || (payload as any).detail)
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

export const uploadOpenAIFile = async (
  file: File,
  purpose = 'user_data',
  signal?: AbortSignal,
): Promise<OpenAIFileObject> => {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('purpose', purpose);

  return apiFetch<OpenAIFileObject>('/v1/files', {
    method: 'POST',
    body: fd,
    signal,
  });
};

export const transcribeAudioFile = async (
  file: Blob | File,
  model = 'gpt-4o-mini-transcribe',
  signal?: AbortSignal,
): Promise<string> => {
  const fd = new FormData();
  const actualFile = file instanceof File ? file : new File([file], 'audio.webm', { type: file.type || 'audio/webm' });
  fd.append('file', actualFile, actualFile.name);
  fd.append('model', model);

  const payload = await apiFetch<{ text?: string }>('/v1/audio/transcriptions', {
    method: 'POST',
    body: fd,
    signal,
  });

  return payload?.text || '';
};

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const streamOpenAIChatCompletion = async (
  request: OpenAIChatCompletionRequest,
  opts: {
    signal?: AbortSignal;
    onDelta: (chunk: string) => void;
    onMetrics?: (metrics: ChatStreamMetrics) => void;
    onStatus?: (status: string) => void;
    onDone?: () => void;
    onWarnings?: (warnings: { unsupportedParams: string[]; invalidParams: string[] }) => void;
  },
): Promise<void> => {
  const response = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: getApiHeaders(true),
    body: JSON.stringify({ ...request, stream: true }),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    const payload = await safeParseResponse(response);
    const message =
      typeof payload === 'object' && payload !== null
        ? ((payload as any).error?.message || (payload as any).message || (payload as any).detail)
        : payload;
    throw new ApiError(
      typeof message === 'string' ? message : `HTTP ${response.status} on /v1/chat/completions`,
      response.status,
      '/v1/chat/completions',
      payload,
    );
  }

  const unsupportedRaw = response.headers.get('X-Unsupported-Params') || '';
  const invalidRaw = response.headers.get('X-Invalid-Params') || '';
  const splitCsv = (value: string) =>
    value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const headerWarnings = {
    unsupportedParams: splitCsv(unsupportedRaw),
    invalidParams: splitCsv(invalidRaw),
  };
  if (headerWarnings.unsupportedParams.length > 0 || headerWarnings.invalidParams.length > 0) {
    opts.onWarnings?.(headerWarnings);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoningOpen = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const line = event
        .split('\n')
        .map((x) => x.trim())
        .find((x) => x.startsWith('data:'));
      if (!line) continue;

      const raw = line.slice(5).trim();
      if (!raw) continue;
      if (raw === '[DONE]') {
        opts.onDone?.();
        return;
      }

      try {
        const payload = JSON.parse(raw);
        if (payload?.error?.message) {
          throw new ApiError(payload.error.message, 500, '/v1/chat/completions', payload);
        }
        if (payload?.type === 'status' && typeof payload?.message === 'string') {
          opts.onStatus?.(payload.message);
          continue;
        }
        if (payload?.metrics && typeof payload.metrics === 'object') {
          opts.onMetrics?.(payload.metrics as ChatStreamMetrics);
        }

        const delta = payload?.choices?.[0]?.delta ?? {};
        const reasoningChunk = delta.reasoning ?? delta.thinking ?? delta.thought;
        const contentChunk = delta.content;

        if (typeof reasoningChunk === 'string' && reasoningChunk.length > 0) {
          if (!reasoningOpen) {
            reasoningOpen = true;
            opts.onDelta(`<thinking>${reasoningChunk}`);
          } else {
            opts.onDelta(reasoningChunk);
          }
        }

        if (typeof contentChunk === 'string' && contentChunk.length > 0) {
          if (reasoningOpen) {
            reasoningOpen = false;
            opts.onDelta(`</thinking>${contentChunk}`);
          } else {
            opts.onDelta(contentChunk);
          }
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
  }

  if (reasoningOpen) {
    opts.onDelta('</thinking>');
  }
  opts.onDone?.();
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

export const fetchProviderCurrent = async (): Promise<ProviderCurrentResponse> =>
  apiFetch<ProviderCurrentResponse>('/api/provider/current', { method: 'GET' });

export const updateProviderCurrent = async (
  payload: ProviderSetPayload,
): Promise<ProviderSetResponse> =>
  apiFetch<ProviderSetResponse>('/api/provider/current', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const fetchProviderCapabilities = async (): Promise<ProviderCapabilitiesResponse> =>
  apiFetch<ProviderCapabilitiesResponse>('/api/providers/capabilities', { method: 'GET' });
