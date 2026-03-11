import React from 'react';
import { MessageBubble } from './MessageBubble';
import { useSmartScroll } from '../../hooks/useSmartScroll';
import { Message } from './types';
import { ArrowDown } from 'lucide-react';

interface ChatMessagesProps {
  messages: Message[];
  onEdit?: (msg: Message, nextContent?: string) => void;
  onRetry?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onDeleteChat?: () => void;
}

export const ChatMessagesGemini: React.FC<ChatMessagesProps> = ({
  messages,
  onEdit,
  onRetry,
  onDelete,
  onDeleteChat,
}) => {
  const { scrollRef, showNewMessageButton, handleScrollToBottomClick } =
    useSmartScroll(messages);

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="custom-scrollbar h-full w-full overflow-y-auto py-6"
      >
        <div className="mx-auto flex w-full max-w-[768px] flex-col gap-1 px-4">
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              msg={msg}
              onEdit={onEdit}
              onRetry={onRetry}
              onDelete={onDelete}
              onDeleteChat={onDeleteChat}
              animIndex={index}
            />
          ))}
        </div>
      </div>

      {showNewMessageButton && (
        <button
          onClick={handleScrollToBottomClick}
          className="absolute bottom-4 right-6 flex animate-[scaleIn_0.18s_cubic-bezier(0.16,1,0.3,1)_both] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--shadow-md)] transition-all"
        >
          <ArrowDown size={14} className="text-[var(--accent)]" />
          New messages
        </button>
      )}
    </div>
  );
};
