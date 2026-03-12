import React from 'react';
import { Check, Copy, Edit2, RefreshCw, Trash2 } from 'lucide-react';
import { IconActionButton } from '@/components/ui/IconActionButton';
import { Message } from '../types';

interface MessageActionsProps {
  msg: Message;
  isUser: boolean;
  isAssistant: boolean;
  copiedText: string | null;
  onCopy: () => void;
  onStartEdit?: () => void;
  onRetry?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  msg,
  isUser,
  isAssistant,
  copiedText,
  onCopy,
  onStartEdit,
  onRetry,
  onDelete,
}) => (
  <div className={`mt-2 flex flex-wrap gap-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
    <IconActionButton
      onClick={onCopy}
      title="Copy message"
      icon={copiedText?.startsWith('message:') ? <Check size={12} /> : <Copy size={12} />}
    />
    {onStartEdit && (
      <IconActionButton
        onClick={onStartEdit}
        title="Edit message"
        icon={<Edit2 size={12} />}
      />
    )}
    {onRetry && isAssistant && (
      <IconActionButton
        onClick={() => onRetry(msg)}
        title="Regenerate response"
        icon={<RefreshCw size={12} />}
      />
    )}
    {onDelete && (
      <IconActionButton
        onClick={() => onDelete(msg)}
        title="Delete message"
        icon={<Trash2 size={12} />}
      />
    )}
  </div>
);

