import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { FilePreviewStrip } from './input/FilePreviewStrip';
import { VoicePopup } from './input/VoicePopup';
import { FileInfo } from './input/types';
import { ComposerShell } from './input/ComposerShell';
import { ComposerToolbar } from './input/ComposerToolbar';
import { ComposerHintBar } from './input/ComposerHintBar';

interface ChatInputProps {
  onSend: (text: string, files: File[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  initialText?: string;
  onTextChange?: (text: string) => void;
  onOpenTools?: () => void;
  inputTokenCount?: number;
  isCountingTokens?: boolean;
}

export const ChatInputGemini: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  disabled,
  isGenerating,
  initialText,
  onTextChange,
  onOpenTools: _onOpenTools,
  inputTokenCount = 0,
  isCountingTokens = false,
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialText !== undefined) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, [files]);

  const addFiles = useCallback((incoming: File[]) => {
    const infos: FileInfo[] = incoming.map((file) => ({
      file,
      preview: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
    }));
    setFiles((prev) => [...prev, ...infos]);
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      if (copy[idx].preview) URL.revokeObjectURL(copy[idx].preview as string);
      copy.splice(idx, 1);
      return copy;
    });
  }, []);

  const handleSend = useCallback(() => {
    if ((!text.trim() && files.length === 0) || isGenerating || disabled) return;

    onSend(
      text,
      files.map((f) => f.file),
    );

    setText('');
    onTextChange?.('');
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 350);
  }, [text, files, isGenerating, disabled, onSend, onTextChange]);

  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    onTextChange?.(v);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((c) => c + 1);
    if (!disabled && !isGenerating) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return Math.max(0, next);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setDragCounter(0);
    if (disabled || isGenerating) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const hasContent = text.trim().length > 0 || files.length > 0;

  return (
    <div
      style={{
        width: '100%',
        flexShrink: 0,
        padding: '10px 16px 14px',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          maxWidth: '768px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <FilePreviewStrip
          files={files}
          disabled={disabled}
          isGenerating={isGenerating}
          onRemoveFile={removeFile}
        />

        <ComposerShell
          isDragging={isDragging}
          isFocused={isFocused}
          isGenerating={isGenerating}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <TextareaAutosize
            minRows={1}
            maxRows={7}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            readOnly={isGenerating}
            placeholder={
              isGenerating
                ? ''
                : disabled
                  ? 'Connect a model to start...'
                  : 'Message... (Enter to send, Shift+Enter for new line)'
            }
            className={`custom-scrollbar font-inherit flex-1 resize-none border-none bg-transparent px-2 py-[7px] text-[0.9rem] leading-[1.6] caret-[var(--accent)] transition-colors duration-200 outline-none ${isGenerating ? 'cursor-default text-[var(--text-tertiary)]' : 'cursor-text text-[var(--text-primary)]'} placeholder:text-[var(--text-tertiary)] disabled:opacity-50`}
          />

          {isGenerating && (
            <div
              style={{
                position: 'absolute',
                left: 52,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--text-tertiary)',
                fontSize: '0.83rem',
                pointerEvents: 'none',
                zIndex: 6,
                animation: 'fadeIn 0.2s both',
              }}
            >
              <div className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <span className="italic">Generating response...</span>
            </div>
          )}

          <ComposerToolbar
            disabled={disabled}
            isGenerating={isGenerating}
            hasContent={hasContent}
            justSent={justSent}
            fileInputRef={fileInputRef}
            onAttachClick={() => fileInputRef.current?.click()}
            onFileChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            onMicClick={() => setShowVoice(true)}
            onSend={handleSend}
            onStop={handleStop}
          />
        </ComposerShell>

        <ComposerHintBar
          isGenerating={isGenerating}
          fileCount={files.length}
          inputTokenCount={inputTokenCount}
          isCountingTokens={isCountingTokens}
        />
      </div>

      {showVoice && (
        <VoicePopup
          onClose={() => setShowVoice(false)}
          onTranscript={(transcript) => {
            setText((prev) => {
              const next = prev ? `${prev} ${transcript}` : transcript;
              onTextChange?.(next);
              return next;
            });
          }}
        />
      )}
    </div>
  );
};
