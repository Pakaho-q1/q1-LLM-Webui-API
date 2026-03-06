import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '../../../contexts/SSEContext';

interface SessionItem {
  id: string;
  title: string;
  updated_at?: number;
}

interface HistoryMessage {
  role: string;
  content: string;
}

const LAST_SESSION_KEY = 'v1_last_session_id';

export const useHistory = () => {
  const { sendPayload, lastMessage, setCurrentConversation } = useSSE();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentHistory, setCurrentHistory] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const t = lastMessage.type;

      if (t === 'sessions_list' && Array.isArray(lastMessage.data)) {
        const list = lastMessage.data as SessionItem[];
        setSessions(list);
        setLoading(false);
        setError(null);

        const savedId = localStorage.getItem(LAST_SESSION_KEY);
        if (savedId && list.some((s) => s.id === savedId)) {
        }
      } else if (t === 'session_created' && lastMessage.data) {
        const item = lastMessage.data as SessionItem;

        setSessions((prev) => {
          if (prev.some((s) => s.id === item.id)) return prev;
          return [item, ...prev];
        });
        setLoading(false);
        setCurrentConversation?.(item.id);
        localStorage.setItem(LAST_SESSION_KEY, item.id);
      } else if (t === 'session_renamed') {
        const data = lastMessage.data as any;
        if (data?.id && data?.title) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === data.id ? { ...s, title: data.title } : s,
            ),
          );
        }
        fetchSessions();
        setLoading(false);
      } else if (t === 'session_deleted') {
        const data = lastMessage.data as Record<string, any> | undefined;
        const convId =
          lastMessage.conversation_id || data?.id || data?.conversation_id;
        if (convId) {
          setSessions((prev) => prev.filter((x) => x.id !== convId));

          if (localStorage.getItem(LAST_SESSION_KEY) === convId) {
            localStorage.removeItem(LAST_SESSION_KEY);
          }
        }
        setLoading(false);
      } else if (t === 'chat_history' && lastMessage.conversation_id) {
        setCurrentHistory(lastMessage.data as HistoryMessage[]);
        setLoading(false);
        setCurrentConversation?.(lastMessage.conversation_id as string);
        localStorage.setItem(
          LAST_SESSION_KEY,
          lastMessage.conversation_id as string,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Processing history message failed',
      );
      setLoading(false);
    }
  }, [lastMessage]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await sendPayload({ action: 'list_sessions' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list sessions');
      setLoading(false);
    }
  }, [sendPayload]);

  const createSession = useCallback(
    async (title = 'New Chat') => {
      setLoading(true);
      setError(null);
      try {
        await sendPayload({ action: 'create_session', title });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create session',
        );
        setLoading(false);
      }
    },
    [sendPayload],
  );

  const renameSession = useCallback(
    async (conversation_id: string, title: string) => {
      setLoading(true);
      setError(null);

      setSessions((prev) =>
        prev.map((s) => (s.id === conversation_id ? { ...s, title } : s)),
      );
      try {
        await sendPayload({ action: 'rename_session', conversation_id, title });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to rename session',
        );
        setLoading(false);
        fetchSessions();
      }
    },
    [sendPayload],
  );

  const deleteSession = useCallback(
    async (conversation_id: string) => {
      setLoading(true);
      setError(null);

      setSessions((prev) => prev.filter((x) => x.id !== conversation_id));
      if (localStorage.getItem(LAST_SESSION_KEY) === conversation_id) {
        localStorage.removeItem(LAST_SESSION_KEY);
      }
      try {
        await sendPayload({ action: 'delete_session', conversation_id });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete session',
        );
        setLoading(false);
        fetchSessions();
      }
    },
    [sendPayload],
  );

  const getChatHistory = useCallback(
    async (conversation_id: string) => {
      setLoading(true);
      setError(null);
      try {
        await sendPayload({ action: 'get_chat_history', conversation_id });
        setCurrentConversation?.(conversation_id);
        localStorage.setItem(LAST_SESSION_KEY, conversation_id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to get chat history',
        );
        setLoading(false);
      }
    },
    [sendPayload],
  );

  return {
    sessions,
    currentHistory,
    loading,
    error,
    fetchSessions,
    createSession,
    renameSession,
    deleteSession,
    getChatHistory,
    lastSessionKey: LAST_SESSION_KEY,
  };
};

export type { SessionItem, HistoryMessage };
