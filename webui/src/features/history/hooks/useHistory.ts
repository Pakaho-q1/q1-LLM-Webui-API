import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/services/api.service';
import { useSSE } from '../../../contexts/SSEContext';

interface SessionItem {
  id: string;
  title: string;
  updated_at?: number;
  isOptimistic?: boolean;
}

interface HistoryMessage {
  role: string;
  content: string;
  metadata?: {
    attachments?: Array<{
      file_id?: string;
      name?: string;
      type?: string;
      url?: string;
      is_image?: boolean;
    }>;
  };
}

const LAST_SESSION_KEY = 'v1_last_session_id';

export const useHistory = () => {
  const { setCurrentConversation } = useSSE();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentHistory, setCurrentHistory] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const optimisticCreateIdRef = useRef<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data?: SessionItem[] }>('/sessions', {
        method: 'GET',
      });
      setSessions(Array.isArray(res?.data) ? res.data : []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list sessions');
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (title = 'New Chat') => {
      setLoading(true);
      setError(null);

      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      optimisticCreateIdRef.current = optimisticId;
      setSessions((prev) => [
        {
          id: optimisticId,
          title,
          updated_at: Math.floor(Date.now() / 1000),
          isOptimistic: true,
        },
        ...prev,
      ]);

      try {
        const res = await apiFetch<{ data?: SessionItem }>('/sessions', {
          method: 'POST',
          body: JSON.stringify({ title }),
        });
        const item = res?.data;
        if (!item?.id) {
          throw new Error('Invalid session response');
        }
        setSessions((prev) => {
          const withoutOptimistic = optimisticCreateIdRef.current
            ? prev.filter((s) => s.id !== optimisticCreateIdRef.current)
            : prev;
          if (withoutOptimistic.some((s) => s.id === item.id)) return withoutOptimistic;
          return [item, ...withoutOptimistic];
        });
        optimisticCreateIdRef.current = null;
        setCurrentConversation?.(item.id);
        localStorage.setItem(LAST_SESSION_KEY, item.id);
        setLoading(false);
      } catch (err) {
        setSessions((prev) => prev.filter((s) => s.id !== optimisticId));
        optimisticCreateIdRef.current = null;
        setError(
          err instanceof Error ? err.message : 'Failed to create session',
        );
        setLoading(false);
      }
    },
    [setCurrentConversation],
  );

  const renameSession = useCallback(
    async (conversation_id: string, title: string) => {
      setLoading(true);
      setError(null);

      let previousTitle: string | null = null;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== conversation_id) return s;
          previousTitle = s.title;
          return { ...s, title, isOptimistic: true };
        }),
      );

      try {
        await apiFetch(`/sessions/${encodeURIComponent(conversation_id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversation_id
              ? { ...s, title, isOptimistic: false }
              : s,
          ),
        );
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to rename session',
        );
        setLoading(false);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversation_id
              ? {
                  ...s,
                  title: previousTitle ?? s.title,
                  isOptimistic: false,
                }
              : s,
          ),
        );
      }
    },
    [],
  );

  const deleteSession = useCallback(
    async (conversation_id: string) => {
      setLoading(true);
      setError(null);

      const snapshot = sessions.find((x) => x.id === conversation_id) || null;
      setSessions((prev) => prev.filter((x) => x.id !== conversation_id));
      if (localStorage.getItem(LAST_SESSION_KEY) === conversation_id) {
        localStorage.removeItem(LAST_SESSION_KEY);
      }

      try {
        await apiFetch(`/sessions/${encodeURIComponent(conversation_id)}`, {
          method: 'DELETE',
        });
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete session',
        );
        setLoading(false);
        if (snapshot) {
          setSessions((prev) => [snapshot, ...prev]);
        }
      }
    },
    [sessions],
  );

  const getChatHistory = useCallback(
    async (conversation_id: string): Promise<HistoryMessage[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ data?: HistoryMessage[] }>(
          `/history/${encodeURIComponent(conversation_id)}`,
          { method: 'GET' },
        );
        const history = Array.isArray(res?.data) ? res.data : [];
        setCurrentHistory(history);
        setCurrentConversation?.(conversation_id);
        localStorage.setItem(LAST_SESSION_KEY, conversation_id);
        setLoading(false);
        return history;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to get chat history',
        );
        setLoading(false);
        return [];
      }
    },
    [setCurrentConversation],
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
