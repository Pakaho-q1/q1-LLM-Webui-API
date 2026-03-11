import { logger } from './logger';

type TelemetryEventName =
  | 'request_start'
  | 'request_success'
  | 'request_error'
  | 'request_abort'
  | 'provider_switch_start'
  | 'provider_switch_success'
  | 'provider_switch_error'
  | 'chat_stream_start'
  | 'chat_stream_done'
  | 'chat_stream_error';

interface TelemetryEventBase {
  name: TelemetryEventName;
  timestamp: string;
}

export interface RequestStartEvent extends TelemetryEventBase {
  name: 'request_start';
  request_id: string;
  request_key: string;
  endpoint: string;
  method: string;
}

export interface RequestSuccessEvent extends TelemetryEventBase {
  name: 'request_success';
  request_id: string;
  request_key: string;
  endpoint: string;
  method: string;
  duration_ms: number;
}

export interface RequestErrorEvent extends TelemetryEventBase {
  name: 'request_error';
  request_id: string;
  request_key: string;
  endpoint: string;
  method: string;
  duration_ms: number;
  error_name: string;
  error_message: string;
}

export interface RequestAbortEvent extends TelemetryEventBase {
  name: 'request_abort';
  request_id: string;
  request_key: string;
  endpoint: string;
  method: string;
  duration_ms: number;
}

export interface ProviderSwitchStartEvent extends TelemetryEventBase {
  name: 'provider_switch_start';
  target_provider: string;
  has_config: boolean;
}

export interface ProviderSwitchSuccessEvent extends TelemetryEventBase {
  name: 'provider_switch_success';
  target_provider: string;
  duration_ms: number;
}

export interface ProviderSwitchErrorEvent extends TelemetryEventBase {
  name: 'provider_switch_error';
  target_provider: string;
  duration_ms: number;
  error_name: string;
  error_message: string;
}

export interface ChatStreamStartEvent extends TelemetryEventBase {
  name: 'chat_stream_start';
  request_id: string;
  conversation_id: string;
  provider: string;
  model?: string;
}

export interface ChatStreamDoneEvent extends TelemetryEventBase {
  name: 'chat_stream_done';
  request_id: string;
  conversation_id: string;
  provider: string;
  duration_ms: number;
  chunks: number;
  chars: number;
}

export interface ChatStreamErrorEvent extends TelemetryEventBase {
  name: 'chat_stream_error';
  request_id: string;
  conversation_id: string;
  provider: string;
  duration_ms: number;
  error_name: string;
  error_message: string;
}

export type TelemetryEvent =
  | RequestStartEvent
  | RequestSuccessEvent
  | RequestErrorEvent
  | RequestAbortEvent
  | ProviderSwitchStartEvent
  | ProviderSwitchSuccessEvent
  | ProviderSwitchErrorEvent
  | ChatStreamStartEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

declare global {
  interface Window {
    __LLM_WEBUI_TELEMETRY__?: (event: TelemetryEvent) => void;
  }
}

const TELEMETRY_BUFFER_LIMIT = 200;
const telemetryBuffer: TelemetryEvent[] = [];

const nextTimestamp = () => new Date().toISOString();

export const emitTelemetryEvent = (event: Omit<TelemetryEvent, 'timestamp'>): void => {
  const normalized = {
    ...event,
    timestamp: nextTimestamp(),
  } as TelemetryEvent;

  telemetryBuffer.push(normalized);
  if (telemetryBuffer.length > TELEMETRY_BUFFER_LIMIT) {
    telemetryBuffer.shift();
  }

  try {
    window.__LLM_WEBUI_TELEMETRY__?.(normalized);
  } catch (err) {
    logger.warn('Telemetry', 'External telemetry handler failed', err);
  }

  logger.debug('Telemetry', normalized.name, normalized);
};

export const getTelemetrySnapshot = (): TelemetryEvent[] => [...telemetryBuffer];

