import { create } from 'zustand';
import { ChatMessage, ChatStreamMetrics } from '@/types/chat.types';

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
  removeMessageById: (id: string) => void;
  updateMessageById: (id: string, patch: Partial<InternalMessage>) => void;
  truncateFromMessage: (id: string) => void;
  appendAssistantChunk: (chunk: string, id?: string) => void;
  updateAssistantMetrics: (metrics: ChatStreamMetrics, id?: string) => void;
  setGenerating: (value: boolean) => void;
  setChatError: (value: string | null) => void;
  stopAssistantTyping: (id?: string) => void;
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
  removeMessageById: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
  updateMessageById: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  truncateFromMessage: (id) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx < 0) return state;
      return {
        messages: state.messages.slice(0, idx),
      };
    }),
  appendAssistantChunk: (chunk, id) =>
    set((state) => {
      const copy = [...state.messages];
      const targetIndex =
        typeof id === 'string'
          ? copy.findIndex((m) => m.id === id && m.role === 'assistant')
          : -1;

      if (targetIndex >= 0) {
        const target = copy[targetIndex];
        copy[targetIndex] = {
          ...target,
          content: (target.content || '') + chunk,
          isTyping: true,
        };
      } else {
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last,
            content: last.content + chunk,
            isTyping: true,
          };
        } else {
          copy.push({
            id: id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content: chunk,
            isTyping: true,
          });
        }
      }

      return { messages: copy };
    }),
  updateAssistantMetrics: (metrics, id) =>
    set((state) => {
      const copy = [...state.messages];
      if (copy.length === 0) return { messages: copy };

      const targetIndex =
        typeof id === 'string'
          ? copy.findIndex((m) => m.id === id && m.role === 'assistant')
          : [...copy].reverse().findIndex((m) => m.role === 'assistant');

      if (targetIndex < 0) return { messages: copy };

      const realIndex =
        typeof id === 'string' ? targetIndex : copy.length - 1 - targetIndex;
      const target = copy[realIndex];
      copy[realIndex] = {
        ...target,
        metrics: {
          ...(target.metrics || {}),
          ...metrics,
        },
      };

      return { messages: copy };
    }),
  setGenerating: (value) => set({ isGenerating: value }),
  setChatError: (value) => set({ chatError: value }),
  stopAssistantTyping: (id) =>
    set((state) => {
      const copy = [...state.messages];
      if (typeof id === 'string') {
        const targetIndex = copy.findIndex(
          (m) => m.id === id && m.role === 'assistant',
        );
        if (targetIndex >= 0) {
          copy[targetIndex] = { ...copy[targetIndex], isTyping: false };
          return { messages: copy };
        }
      }
      const last = copy[copy.length - 1];
      if (last?.role === 'assistant') {
        copy[copy.length - 1] = { ...last, isTyping: false };
      }
      return { messages: copy };
    }),
  clearMessages: () => set({ messages: [], chatError: null, isGenerating: false }),
}));
