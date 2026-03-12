import React from 'react';
import { Mic, Paperclip, Send, Square } from 'lucide-react';

interface ComposerToolbarProps {
  disabled?: boolean;
  isGenerating?: boolean;
  hasContent: boolean;
  justSent: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAttachClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMicClick: () => void;
  onSend: () => void;
  onStop: () => void;
}

export const ComposerToolbar: React.FC<ComposerToolbarProps> = ({
  disabled,
  isGenerating,
  hasContent,
  justSent,
  fileInputRef,
  onAttachClick,
  onFileChange,
  onMicClick,
  onSend,
  onStop,
}) => {
  const iconButtonStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
    transition: 'color 0.12s, background 0.12s',
  };

  return (
    <>
      <button
        onClick={onAttachClick}
        disabled={isGenerating || disabled}
        title="Attach file"
        style={iconButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Paperclip size={17} />
      </button>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          paddingBottom: 2,
          flexShrink: 0,
        }}
      >
        {!isGenerating && (
          <button
            onClick={onMicClick}
            disabled={disabled}
            title="Voice input"
            style={{ ...iconButtonStyle, opacity: disabled ? 0.4 : 1 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ec4899';
              e.currentTarget.style.background =
                'color-mix(in srgb, #ec4899 10%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Mic size={17} />
          </button>
        )}

        <button
          onClick={isGenerating ? onStop : onSend}
          disabled={!isGenerating && (!hasContent || disabled)}
          title={isGenerating ? 'Stop generation' : 'Send message'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            border: 'none',
            cursor:
              !isGenerating && (!hasContent || disabled) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isGenerating
              ? 'color-mix(in srgb, var(--danger) 90%, transparent)'
              : hasContent && !disabled
                ? 'var(--accent)'
                : 'var(--bg-input)',
            color:
              isGenerating || (hasContent && !disabled)
                ? '#fff'
                : 'var(--text-tertiary)',
            boxShadow: isGenerating
              ? '0 2px 8px color-mix(in srgb, var(--danger) 35%, transparent)'
              : hasContent && !disabled
                ? '0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent)'
                : 'none',
            transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
            transform: justSent ? 'scale(0.86)' : 'scale(1)',
            opacity: !isGenerating && (!hasContent || disabled) ? 0.35 : 1,
            flexShrink: 0,
          }}
        >
          {isGenerating ? (
            <Square size={13} fill="currentColor" />
          ) : (
            <Send size={14} className="ml-px" />
          )}
        </button>
      </div>
    </>
  );
};

