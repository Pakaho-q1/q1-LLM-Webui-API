import { useRef, useEffect, useState, useCallback } from 'react';
import { Message } from '../components/ui/types';

export const useSmartScroll = (messages: Message[]) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  const [showNewMessageButton, setShowNewMessageButton] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    setIsStreaming(true);

    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
    }

    streamingTimeoutRef.current = setTimeout(() => {
      setIsStreaming(false);
    }, 1500);

    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    };
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 30;

      setIsUserAtBottom(isAtBottom);

      if (isAtBottom) {
        setShowNewMessageButton(false);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isUserAtBottom && isStreaming) {
      scrollToBottom('auto');
    } else if (!isUserAtBottom && isStreaming) {
      setShowNewMessageButton(true);
    }
  }, [messages, isUserAtBottom, isStreaming, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !el.firstElementChild) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isUserAtBottom && isStreaming) {
        scrollToBottom('auto');
      }
    });

    resizeObserver.observe(el.firstElementChild);
    return () => resizeObserver.disconnect();
  }, [isUserAtBottom, isStreaming, scrollToBottom]);

  const handleScrollToBottomClick = () => {
    setIsUserAtBottom(true);
    setShowNewMessageButton(false);
    scrollToBottom('smooth');
  };

  return {
    scrollRef,
    showNewMessageButton,
    handleScrollToBottomClick,
  };
};
