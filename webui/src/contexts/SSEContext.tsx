import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { API_BASE } from '../services/api.service';
import { useQueryClient } from '@tanstack/react-query';
import { historyKey, sessionsKey, setHistoryCache } from '@/services/dataClient';
import { useSystemStore } from '@/services/system.store';

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}
export { ConnectionState };

interface SSEContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  error: string | null;
  currentConversation: string | null;
  setCurrentConversation?: (id: string | null) => void;
  subscribeToChat: (callback: (msg: any) => void) => () => void;
  retry: () => void;
}

const SSEContext = createContext<SSEContextType | null>(null);

const CLIENT_ID_KEY = 'v1_client_id';
function getOrCreateClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
const CLIENT_ID = getOrCreateClientId();

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

const normalizeIncoming = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data.choices)) {
    const choice = data.choices[0];
    const deltaContent = choice?.delta?.content;
    const finishReason = choice?.finish_reason;

    if (typeof deltaContent === 'string' && deltaContent.length > 0) {
      return {
        type: 'chunk',
        content: deltaContent,
        id: data.id,
        requestId: data.request_id,
        raw: data,
      };
    }

    if (finishReason) {
      return {
        type: 'done',
        finish_reason: finishReason,
        id: data.id,
        requestId: data.request_id,
        raw: data,
      };
    }
  }

  return data;
};

export const SSEProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED,
  );
  const [error, setError] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<string | null>(
    null,
  );

  const esRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const chatListenersRef = useRef<Set<(msg: any) => void>>(new Set());
  const setModelStatus = useSystemStore((state) => state.setModelStatus);
  const queryClient = useQueryClient();

  const notifyChatListeners = (data: any) => {
    chatListenersRef.current.forEach((cb) => cb(data));
  };

  const subscribeToChat = useCallback((cb: (msg: any) => void) => {
    chatListenersRef.current.add(cb);
    return () => chatListenersRef.current.delete(cb);
  }, []);

  const processIncoming = useCallback((data: any) => {
    if (data?.type === 'model_status' && data?.data) {
      const d = data.data as any;
      setModelStatus(
        {
          currentModel: d.name || d.model || '',
          isModelRunning: Boolean(d.running),
          isModelLoading:
            typeof d.loading === 'boolean'
              ? Boolean(d.loading)
              : Boolean(d.running) === false && Boolean(d.name || d.model),
        },
        {
          source: 'sse',
          timestamp: Date.now(),
          requestId: d.request_id || data.request_id,
        },
      );
    }

    if ((data?.type === 'status' || data?.type === 'info') && data?.message) {
      const lower = String(data.message).toLowerCase();
      if (lower.includes('loading')) {
        setModelStatus({ isModelLoading: true }, { source: 'sse', timestamp: Date.now() });
      }
      if (lower.includes('loaded') || lower.includes('unloaded') || lower.includes('error')) {
        setModelStatus(
          {
          isModelLoading: false,
          isModelRunning: lower.includes('loaded')
            ? true
            : lower.includes('unloaded')
              ? false
              : undefined,
          },
          { source: 'sse', timestamp: Date.now() },
        );
      }
    }

    if (data.type === 'session_deleted') {
      setCurrentConversation((prev) =>
        prev === data.conversation_id ? null : prev,
      );
      if (data.conversation_id) {
        queryClient.invalidateQueries({ queryKey: historyKey(data.conversation_id) });
      }
      queryClient.invalidateQueries({ queryKey: sessionsKey });
    }
    if (data.type === 'session_created' && data.data?.id) {
      setCurrentConversation(data.data.id);
      queryClient.invalidateQueries({ queryKey: sessionsKey });
    }
    if (data.type === 'chat_history' && data.conversation_id) {
      setCurrentConversation(data.conversation_id);
      if (Array.isArray(data.data)) {
        setHistoryCache(queryClient, data.conversation_id, data.data);
      } else {
        queryClient.invalidateQueries({ queryKey: historyKey(data.conversation_id) });
      }
    }

    const chatTypes = ['chunk', 'done', 'error', 'status'];
    if (chatTypes.includes(data.type)) notifyChatListeners(data);
    if (data.choices && Array.isArray(data.choices)) notifyChatListeners(data);
  }, [queryClient, setModelStatus]);

  const connect = useCallback(() => {
    if (esRef.current) return;
    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    try {
      const es = new EventSource(`${API_BASE}/sse/stream?client_id=${CLIENT_ID}`);

      es.onopen = () => {
        setIsConnected(true);
        setConnectionState(ConnectionState.CONNECTED);
        reconnectAttemptsRef.current = 0;
        setError(null);
      };

      es.onmessage = (ev: MessageEvent) => {
        try {
          if (ev.data === '[DONE]') {
            notifyChatListeners('[DONE]');
            return;
          }
          const data = normalizeIncoming(JSON.parse(ev.data));
          processIncoming(data);
        } catch {
          // ignore malformed event payloads
        }
      };

      const namedEvents = [
        'chunk',
        'done',
        'status',
        'error',
        'sessions_list',
        'session_created',
        'session_renamed',
        'session_deleted',
        'chat_history',
        'models_list',
        'model_status',
        'hf_files',
        'download_status',
        'token_count',
        'presets',
        'preset_data',
        'success',
      ];

      namedEvents.forEach((evt) => {
        es.addEventListener(evt, (event: MessageEvent) => {
          try {
            if ((event as any).data === '[DONE]') {
              notifyChatListeners('[DONE]');
              return;
            }
            const data = normalizeIncoming(JSON.parse((event as any).data));
            processIncoming(data);
          } catch {
            // ignore malformed event payloads
          }
        });
      });

      es.addEventListener('error', () => {
        setConnectionState(ConnectionState.ERROR);
        setIsConnected(false);
        setError('SSE connection error');
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1);
          setTimeout(() => {
            esRef.current?.close();
            esRef.current = null;
            connect();
          }, delay);
        }
      });

      esRef.current = es;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionState(ConnectionState.ERROR);
    }
  }, [processIncoming]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  const retry = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    esRef.current?.close();
    esRef.current = null;
    connect();
  }, [connect]);

  const value: SSEContextType = {
    isConnected,
    connectionState,
    error,
    currentConversation,
    setCurrentConversation,
    subscribeToChat,
    retry,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
};

export const useSSE = (): SSEContextType => {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSE must be used within SSEProvider');
  return ctx;
};
