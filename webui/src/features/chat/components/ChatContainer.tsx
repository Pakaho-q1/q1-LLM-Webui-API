// src/features/chat/components/ChatContainer.tsx
import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { useSettings } from '@/services/SettingsContext';
import { ChatMessagesGemini } from './ui/ChatMessagesGemini';
import { ChatInputGemini } from './ui/ChatInputGemini';
import { IdleScreen } from './ui/IdleScreen'; // เพิ่มการ Import จาก Component ที่แยก
import { X } from 'lucide-react';

export const ChatContainer: React.FC = () => {
  const {
    isConnected,
    messages,
    isGenerating,
    error,
    sendMessage,
    stopGeneration,
    clearError,
  } = useChat();

  const { settings } = useSettings();
  const [editText, setEditText] = useState('');

  const handleSendMessage = (text: string, files: File[] = []) => {
    sendMessage(
      text,
      files,
      {
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        top_p: settings.topP,
        top_k: settings.topK,
      },
      settings.systemPrompt,
    );
  };

  const handleRetry = (msg: any) => handleSendMessage(msg.content || '');
  const handleEdit = (msg: any) => setEditText(msg.content || '');

  // ตัดสินใจว่าจะโชว์หน้า Idle หรือไม่
  // กฎ: ถ้าไม่มีข้อความ และ 'ไม่ได้กำลังประมวลผลอยู่' ให้แสดงหน้า Idle
  const shouldShowIdle = messages.length === 0 && !isGenerating;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-base)]">
      {error && (
        <div className="flex shrink-0 animate-[fadeIn_0.2s_both] items-center justify-between border-b border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-2.5 text-sm text-[var(--danger)]">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="icon-btn h-6 w-6 text-[var(--danger)]"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {shouldShowIdle ? (
        <div className="flex-1 overflow-y-auto">
          <IdleScreen onQuickPrompt={(text) => setEditText(text)} />
        </div>
      ) : (
        <ChatMessagesGemini
          messages={messages.map((m) => ({
            id: undefined,
            role: m.role as any,
            content: m.content as string,
            attachments: (m as any).attachments,
            isTyping: (m as any).isTyping,
          }))}
          onEdit={handleEdit}
          onRetry={handleRetry}
        />
      )}

      <ChatInputGemini
        onSend={(text, files) => handleSendMessage(text, files)}
        onStop={stopGeneration}
        disabled={!isConnected}
        isGenerating={isGenerating}
        initialText={editText}
        onTextChange={setEditText}
        onOpenTools={() => {}}
      />
    </div>
  );
};
