import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSSE } from '../../../contexts/SSEContext';
import { historyKey, sessionsKey } from '@/services/dataClient';
import { useFetch } from '@/contexts/FetchContext';

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
const SESSIONS_KEY = sessionsKey;
const HISTORY_KEY = historyKey;

const extractErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export const useHistory = () => {
  const { setCurrentConversation } = useSSE();
  const { apiFetch } = useFetch();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const res = await apiFetch<{ data?: SessionItem[] }>('/sessions', {
        method: 'GET',
      });
      return Array.isArray(res?.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiFetch<{ data?: SessionItem }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      if (!res?.data?.id) {
        throw new Error('Invalid session response');
      }
      return res.data;
    },
    onMutate: async (title: string) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const optimisticId = `optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const optimisticItem: SessionItem = {
        id: optimisticId,
        title,
        updated_at: Math.floor(Date.now() / 1000),
        isOptimistic: true,
      };
      const previous = queryClient.getQueryData<SessionItem[]>(SESSIONS_KEY);
      queryClient.setQueryData<SessionItem[]>(SESSIONS_KEY, (old) => [
        optimisticItem,
        ...(old ?? []),
      ]);
      return { previous, optimisticId };
    },
    onSuccess: (item, _title, ctx) => {
      queryClient.setQueryData<SessionItem[]>(SESSIONS_KEY, (old) => {
        const filtered = (old ?? []).filter(
          (s) => s.id !== ctx?.optimisticId,
        );
        if (filtered.some((s) => s.id === item.id)) return filtered;
        return [item, ...filtered];
      });
      setCurrentConversation?.(item.id);
      localStorage.setItem(LAST_SESSION_KEY, item.id);
    },
    onError: (err, _title, ctx) => {
      queryClient.setQueryData(SESSIONS_KEY, ctx?.previous ?? []);
      throw err;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: async (args: { conversationId: string; title: string }) =>
      apiFetch(`/sessions/${encodeURIComponent(args.conversationId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: args.title }),
      }),
    onMutate: async ({ conversationId, title }) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueryData<SessionItem[]>(SESSIONS_KEY);
      queryClient.setQueryData<SessionItem[]>(SESSIONS_KEY, (old) =>
        (old ?? []).map((s) =>
          s.id === conversationId
            ? { ...s, title, isOptimistic: true }
            : s,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(SESSIONS_KEY, ctx?.previous ?? []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (conversationId: string) =>
      apiFetch(`/sessions/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (conversationId: string) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueryData<SessionItem[]>(SESSIONS_KEY);
      queryClient.setQueryData<SessionItem[]>(SESSIONS_KEY, (old) =>
        (old ?? []).filter((s) => s.id !== conversationId),
      );
      if (localStorage.getItem(LAST_SESSION_KEY) === conversationId) {
        localStorage.removeItem(LAST_SESSION_KEY);
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(SESSIONS_KEY, ctx?.previous ?? []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const getChatHistoryMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiFetch<{ data?: HistoryMessage[] }>(
        `/history/${encodeURIComponent(conversationId)}`,
        { method: 'GET' },
      );
      return Array.isArray(res?.data) ? res.data : [];
    },
    onSuccess: (history, conversationId) => {
      queryClient.setQueryData(HISTORY_KEY(conversationId), history);
      setCurrentConversation?.(conversationId);
      localStorage.setItem(LAST_SESSION_KEY, conversationId);
    },
  });

  const getChatHistory = useCallback(
    async (conversationId: string): Promise<HistoryMessage[]> => {
      try {
        return await getChatHistoryMutation.mutateAsync(conversationId);
      } catch (err) {
        if (localStorage.getItem(LAST_SESSION_KEY) === conversationId) {
          localStorage.removeItem(LAST_SESSION_KEY);
        }
        throw err;
      }
    },
    [getChatHistoryMutation],
  );

  const createSession = useCallback(
    async (title = 'New Chat') => {
      try {
        return await createSessionMutation.mutateAsync(title);
      } catch (err) {
        setCurrentConversation?.(null);
        throw err;
      }
    },
    [createSessionMutation, setCurrentConversation],
  );

  const renameSession = useCallback(
    async (conversationId: string, title: string) => {
      await renameSessionMutation.mutateAsync({ conversationId, title });
    },
    [renameSessionMutation],
  );

  const deleteSession = useCallback(
    async (conversationId: string) => {
      await deleteSessionMutation.mutateAsync(conversationId);
    },
    [deleteSessionMutation],
  );

  const error = useMemo(() => {
    if (sessionsQuery.error) {
      return extractErrorMessage(sessionsQuery.error, 'Failed to list sessions');
    }
    if (createSessionMutation.error) {
      return extractErrorMessage(
        createSessionMutation.error,
        'Failed to create session',
      );
    }
    if (renameSessionMutation.error) {
      return extractErrorMessage(
        renameSessionMutation.error,
        'Failed to rename session',
      );
    }
    if (deleteSessionMutation.error) {
      return extractErrorMessage(
        deleteSessionMutation.error,
        'Failed to delete session',
      );
    }
    if (getChatHistoryMutation.error) {
      return extractErrorMessage(
        getChatHistoryMutation.error,
        'Failed to get chat history',
      );
    }
    return null;
  }, [
    createSessionMutation.error,
    deleteSessionMutation.error,
    getChatHistoryMutation.error,
    renameSessionMutation.error,
    sessionsQuery.error,
  ]);

  return {
    sessions: sessionsQuery.data ?? [],
    currentHistory: [],
    loading:
      sessionsQuery.isFetching ||
      createSessionMutation.isPending ||
      renameSessionMutation.isPending ||
      deleteSessionMutation.isPending ||
      getChatHistoryMutation.isPending,
    error,
    createSession,
    renameSession,
    deleteSession,
    getChatHistory,
    lastSessionKey: LAST_SESSION_KEY,
  };
};

export type { SessionItem, HistoryMessage };
