import { create } from 'zustand';
import { ChatMessage } from '@/features/chat/types/chat.types';

export interface Attachment {
  url: string;
  type: string;
  name?: string;
  file?: File;
}

export interface InternalMessage extends ChatMessage {
  id: string;
  attachments?: Attachment[];
  isTyping?: boolean;
}

interface ChatStoreState {
  messages: InternalMessage[];
  isGenerating: boolean;
  chatError: string | null;
  setMessages: (messages: InternalMessage[]) => void;
  pushMessage: (message: InternalMessage) => void;
  appendAssistantChunk: (chunk: string, id?: string) => void;
  setGenerating: (value: boolean) => void;
  setChatError: (value: string | null) => void;
  stopAssistantTyping: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [],
  isGenerating: false,
  chatError: null,
  setMessages: (messages) => set({ messages }),
  pushMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  appendAssistantChunk: (chunk, id) =>
    set((state) => {
      const copy = [...state.messages];
      const last = copy[copy.length - 1];

      if (last?.role === 'assistant') {
        copy[copy.length - 1] = {
          ...last,
          content: last.content + chunk,
          isTyping: true,
        };
      } else {
        copy.push({
          id:
            id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          content: chunk,
          isTyping: true,
        });
      }

      return { messages: copy };
    }),
  setGenerating: (value) => set({ isGenerating: value }),
  setChatError: (value) => set({ chatError: value }),
  stopAssistantTyping: () =>
    set((state) => {
      const copy = [...state.messages];
      const last = copy[copy.length - 1];
      if (last?.role === 'assistant') {
        copy[copy.length - 1] = { ...last, isTyping: false };
      }
      return { messages: copy };
    }),
  clearMessages: () =>
    set({ messages: [], chatError: null, isGenerating: false }),
}));
