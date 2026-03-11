import type { QueryClient } from '@tanstack/react-query';

export const STALE_TIME_MS = 1000 * 60 * 5;

export const sessionsKey = ['sessions'] as const;
export const historyKey = (conversationId: string) =>
  ['history', conversationId] as const;
export const localModelsKey = ['models', 'local'] as const;
export const downloadsKey = ['models', 'downloads'] as const;
export const hfKey = (repo: string) => ['models', 'hf', repo] as const;
export const modelStatusKey = ['models', 'status'] as const;
export const providerCurrentKey = ['provider', 'current'] as const;
export const providerCapabilitiesKey = ['provider', 'capabilities'] as const;
export const presetsKey = ['presets'] as const;
export const presetKey = (name: string) => ['presets', name] as const;

export const getHistoryCache = <T = unknown>(
  queryClient: QueryClient,
  conversationId: string,
): T | undefined => queryClient.getQueryData<T>(historyKey(conversationId));

export const setHistoryCache = <T = unknown>(
  queryClient: QueryClient,
  conversationId: string,
  data: T,
) => queryClient.setQueryData(historyKey(conversationId), data);

export const isHistoryFresh = (
  queryClient: QueryClient,
  conversationId: string,
  staleTimeMs: number = STALE_TIME_MS,
): boolean => {
  const state = queryClient.getQueryState(historyKey(conversationId));
  const updatedAt = state?.dataUpdatedAt ?? 0;
  if (!updatedAt) return false;
  return Date.now() - updatedAt < staleTimeMs;
};
