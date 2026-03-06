// types.ts
export interface Attachment {
  url: string;
  type: string;
  name?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  isTyping?: boolean;
  attachments?: Attachment[];
}

export interface MessageBubbleProps {
  msg: Message;
  onEdit?: (msg: Message) => void;
  onRetry?: (msg: Message) => void;
}
