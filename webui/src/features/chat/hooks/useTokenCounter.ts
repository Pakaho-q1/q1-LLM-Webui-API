import { useState, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/services/api.service';

const DEBOUNCE_DELAY = 300;

export const useTokenCounter = () => {
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isCountingTokens, setIsCountingTokens] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastRequestIdRef = useRef(0);

  const countTokens = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return async (text: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!text.trim()) {
        setTokenCount(0);
        setIsCountingTokens(false);
        return;
      }

      setIsCountingTokens(true);
      setError(null);
      const requestId = ++lastRequestIdRef.current;

      timeoutId = setTimeout(async () => {
        try {
          const res = await apiFetch<{ data?: number }>('/api/tokens/count', {
            method: 'POST',
            body: JSON.stringify({ text }),
          });
          if (requestId !== lastRequestIdRef.current) return;
          setTokenCount(Number(res?.data || 0));
          setIsCountingTokens(false);
          setError(null);
        } catch (err) {
          if (requestId !== lastRequestIdRef.current) return;
          setError(err instanceof Error ? err.message : 'Failed to count tokens');
          setIsCountingTokens(false);
        }
      }, DEBOUNCE_DELAY);
    };
  }, []);

  const resetTokenCount = useCallback(() => {
    setTokenCount(0);
    setError(null);
    setIsCountingTokens(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    tokenCount,
    isCountingTokens,
    error,
    countTokens,
    resetTokenCount,
    clearError,
  };
};
