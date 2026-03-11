// src/contexts/FetchContext.tsx
import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { apiFetch as apiRequest, ApiError } from '@/services/api.service';
import { useSystemStore } from '@/services/system.store';
import { emitTelemetryEvent } from '@/services/telemetry';

export interface FetchRequestOptions {
  requestKey?: string;
  cancelPrevious?: boolean;
  timeoutMs?: number;
  suppressGlobalError?: boolean;
}

interface FetchContextType {
  apiFetch: <T = unknown>(
    endpoint: string,
    options?: RequestInit,
    requestOptions?: FetchRequestOptions,
  ) => Promise<T>;
  cancelRequest: (requestKey: string) => void;
  cancelAllRequests: () => void;
}

const FetchContext = createContext<FetchContextType | null>(null);

export const FetchProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const requestControllersRef = useRef(new Map<string, AbortController>());

  const beginRequest = useSystemStore((state) => state.beginRequest);
  const endRequest = useSystemStore((state) => state.endRequest);
  const setLastError = useSystemStore((state) => state.setLastError);
  const setAuthRequired = useSystemStore((state) => state.setAuthRequired);
  const setActiveSidebarTab = useSystemStore((state) => state.setActiveSidebarTab);
  const pushToast = useSystemStore((state) => state.pushToast);

  const cancelRequest = useCallback((requestKey: string) => {
    const existing = requestControllersRef.current.get(requestKey);
    if (!existing) return;
    existing.abort(new DOMException('Cancelled by newer request', 'AbortError'));
    requestControllersRef.current.delete(requestKey);
  }, []);

  const cancelAllRequests = useCallback(() => {
    requestControllersRef.current.forEach((controller) =>
      controller.abort(new DOMException('Cancelled', 'AbortError')),
    );
    requestControllersRef.current.clear();
  }, []);

  useEffect(() => () => cancelAllRequests(), [cancelAllRequests]);

  const apiFetch = useCallback(
    async <T = unknown>(
      endpoint: string,
      options: RequestInit = {},
      requestOptions: FetchRequestOptions = {},
    ): Promise<T> => {
      const requestKey = requestOptions.requestKey || endpoint;
      const method = String(options.method || 'GET').toUpperCase();
      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const startedAt = performance.now();
      if (requestOptions.cancelPrevious) {
        cancelRequest(requestKey);
      }

      const controller = new AbortController();
      requestControllersRef.current.set(requestKey, controller);

      const linkedAbort = () =>
        controller.abort(options.signal?.reason || new DOMException('Aborted', 'AbortError'));
      options.signal?.addEventListener('abort', linkedAbort, { once: true });

      beginRequest(requestKey);
      emitTelemetryEvent({
        name: 'request_start',
        request_id: requestId,
        request_key: requestKey,
        endpoint,
        method,
      });
      try {
        const data = await apiRequest<T>(endpoint, {
          ...options,
          signal: controller.signal,
        }, { timeoutMs: requestOptions.timeoutMs });

        emitTelemetryEvent({
          name: 'request_success',
          request_id: requestId,
          request_key: requestKey,
          endpoint,
          method,
          duration_ms: Math.round(performance.now() - startedAt),
        });
        setLastError(null);
        setAuthRequired(false);
        return data;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          emitTelemetryEvent({
            name: 'request_abort',
            request_id: requestId,
            request_key: requestKey,
            endpoint,
            method,
            duration_ms: Math.round(performance.now() - startedAt),
          });
          throw err;
        }

        const normalized = err instanceof Error ? err.message : 'Request failed';
        emitTelemetryEvent({
          name: 'request_error',
          request_id: requestId,
          request_key: requestKey,
          endpoint,
          method,
          duration_ms: Math.round(performance.now() - startedAt),
          error_name: err instanceof Error ? err.name : 'Error',
          error_message: normalized,
        });
        setLastError(normalized);

        if (!(requestOptions.suppressGlobalError ?? false)) {
          pushToast(normalized, 'error', 5000);
        }

        if (err instanceof ApiError && err.status === 401) {
          setAuthRequired(true);
          setActiveSidebarTab('settings');
          if (!(requestOptions.suppressGlobalError ?? false)) {
            pushToast('Unauthorized: please update API key in Settings', 'warning', 6000);
          }
        }

        throw err;
      } finally {
        endRequest(requestKey);
        options.signal?.removeEventListener('abort', linkedAbort);
        if (requestControllersRef.current.get(requestKey) === controller) {
          requestControllersRef.current.delete(requestKey);
        }
      }
    },
    [
      beginRequest,
      cancelRequest,
      endRequest,
      pushToast,
      setActiveSidebarTab,
      setAuthRequired,
      setLastError,
    ],
  );

  return (
    <FetchContext.Provider value={{ apiFetch, cancelRequest, cancelAllRequests }}>
      {children}
    </FetchContext.Provider>
  );
};

export const useFetch = () => {
  const ctx = useContext(FetchContext);
  if (!ctx) throw new Error('useFetch must be used within FetchProvider');
  return ctx;
};
