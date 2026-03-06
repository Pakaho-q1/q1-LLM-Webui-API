import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSSE } from '../../../contexts/SSEContext';

const DEBOUNCE_DELAY = 300;

export const useTokenCounter = () => {
  const { isConnected, sendPayload, lastMessage, error: wsError } = useSSE();

  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isCountingTokens, setIsCountingTokens] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    try {
      if (
        lastMessage.type === 'token_count' &&
        lastMessage.data !== undefined
      ) {
        setTokenCount(lastMessage.data as number);
        setIsCountingTokens(false);
        setError(null);
      } else if (
        lastMessage.type === 'error' &&
        lastMessage.message?.includes('token')
      ) {
        setError(lastMessage.message || 'Token counting failed');
        setIsCountingTokens(false);
      }
    } catch (err) {
      console.error('❌ Error processing token count:', err);
      setError(err instanceof Error ? err.message : 'Processing error');
      setIsCountingTokens(false);
    }
  }, [lastMessage]);

  const countTokens = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return async (text: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!text.trim() || !isConnected) {
        setTokenCount(0);
        return;
      }

      setIsCountingTokens(true);
      setError(null);

      timeoutId = setTimeout(async () => {
        try {
          await sendPayload({
            action: 'count_tokens',
            text,
          });
        } catch (err) {
          console.error('❌ Failed to count tokens:', err);
          setError(
            err instanceof Error ? err.message : 'Failed to count tokens',
          );
          setIsCountingTokens(false);
        }
      }, DEBOUNCE_DELAY);
    };
  }, [isConnected, sendPayload]);

  const resetTokenCount = useCallback(() => {
    setTokenCount(0);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    tokenCount,
    isCountingTokens,
    error: error || wsError,
    countTokens,
    resetTokenCount,
    clearError,
  };
};
