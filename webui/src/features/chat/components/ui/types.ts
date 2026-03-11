// types.ts
export interface Attachment {
  url: string;
  type: string;
  name?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  isTyping?: boolean;
  attachments?: Attachment[];
  metrics?: {
    prompt_tokens?: number;
    prompt_processing_time_ms?: number;
    prompt_tokens_per_sec?: number;
    generated_tokens?: number;
    generation_time_ms?: number;
    generation_tokens_per_sec?: number;
    total_time_ms?: number;
  };
}

export interface MessageBubbleProps {
  msg: Message;
  onEdit?: (msg: Message, nextContent?: string) => void;
  onRetry?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  onDeleteChat?: () => void;
}
