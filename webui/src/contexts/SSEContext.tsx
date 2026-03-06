import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { WS_URL, API_BASE } from '../services/api.service';
import { WsResponse } from '../types/chat.types';

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

interface SSEContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  error: string | null;
  lastMessage: any | null;
  currentConversation: string | null;

  sendPayload: (payload: Record<string, unknown>) => Promise<any>;
  sendForm: (endpoint: string, formData: FormData) => Promise<any>;
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
const genRequestId = () =>
  `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

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
        raw: data,
      };
    }

    if (finishReason) {
      return {
        type: 'done',
        finish_reason: finishReason,
        id: data.id,
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
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<string | null>(
    null,
  );

  const esRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const chatListenersRef = useRef<Set<(msg: any) => void>>(new Set());

  const notifyChatListeners = (data: any) => {
    chatListenersRef.current.forEach((cb) => cb(data));
  };

  const subscribeToChat = useCallback((cb: (msg: any) => void) => {
    chatListenersRef.current.add(cb);
    return () => chatListenersRef.current.delete(cb);
  }, []);

  const connect = useCallback(() => {
    if (esRef.current) return;
    setConnectionState(ConnectionState.CONNECTING);
    setError(null);

    try {
      const es = new EventSource(
        `${API_BASE}/sse/stream?client_id=${CLIENT_ID}`,
      );

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
        } catch {}
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
        es.addEventListener(evt, (ev: MessageEvent) => {
          try {
            if ((ev as any).data === '[DONE]') {
              notifyChatListeners('[DONE]');
              return;
            }
            const data = normalizeIncoming(JSON.parse((ev as any).data));
            processIncoming(data);
          } catch {}
        });
      });

      es.addEventListener('error', () => {
        setConnectionState(ConnectionState.ERROR);
        setIsConnected(false);
        setError('SSE connection error');
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay =
            RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1);
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
  }, []);

  const processIncoming = (data: any) => {
    setLastMessage(data);

    if (data.type === 'session_deleted') {
      setCurrentConversation((prev) =>
        prev === data.conversation_id ? null : prev,
      );
    }
    if (data.type === 'session_created' && data.data?.id) {
      setCurrentConversation(data.data.id);
    }
    if (data.type === 'chat_history' && data.conversation_id) {
      setCurrentConversation(data.conversation_id);
    }

    const chatTypes = ['chunk', 'done', 'error', 'status'];
    if (chatTypes.includes(data.type)) notifyChatListeners(data);

    if (data.choices && Array.isArray(data.choices)) notifyChatListeners(data);
  };

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  const sendPayload = useCallback(
    async (payload: Record<string, unknown>): Promise<any> => {
      const action = (payload.action as string) || '';

      try {
        if (action === 'chat_completion') {
          const req: any = {
            ...payload,
            stream: true,
            client_id: CLIENT_ID,
          };
          if (!req.request_id) req.request_id = genRequestId();
          delete req.action;

          const resp = await fetch(`${API_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          });
          if (!resp.ok)
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          return resp.json();
        }

        const resp = await fetch(`${API_BASE}/api/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, client_id: CLIENT_ID }),
        });
        return resp.json();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Send failed';
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const sendForm = useCallback(
    async (endpoint: string, formData: FormData): Promise<any> => {
      formData.set('client_id', CLIENT_ID);

      try {
        const resp = await fetch(`${API_BASE}/api/${endpoint}`, {
          method: 'POST',

          body: formData,
        });
        if (!resp.ok)
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        return resp.json();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `sendForm(${endpoint}) failed`;
        setError(msg);
        throw err;
      }
    },
    [],
  );

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
    lastMessage,
    currentConversation,
    sendPayload,
    sendForm,
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
