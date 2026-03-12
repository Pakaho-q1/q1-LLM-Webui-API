import React from 'react';
import { Paperclip } from 'lucide-react';

interface ComposerShellProps {
  isDragging: boolean;
  isFocused: boolean;
  isGenerating?: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}

export const ComposerShell: React.FC<ComposerShellProps> = ({
  isDragging,
  isFocused,
  isGenerating,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  children,
}) => (
  <div
    onDragEnter={onDragEnter}
    onDragLeave={onDragLeave}
    onDragOver={onDragOver}
    onDrop={onDrop}
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-end',
      gap: 4,
      borderRadius: 18,
      padding: '6px 6px 6px 12px',
      background: isGenerating ? 'var(--bg-elevated)' : 'var(--bg-surface)',
      border: `1.5px solid ${
        isDragging
          ? 'var(--accent)'
          : isFocused
            ? 'var(--accent)'
            : isGenerating
              ? 'color-mix(in srgb, var(--accent) 35%, var(--border))'
              : 'var(--border)'
      }`,
      boxShadow: isFocused ? '0 0 0 3px var(--accent-subtle)' : 'var(--shadow-sm)',
      transition: 'border-color 0.15s, box-shadow 0.15s, background 0.2s',
    }}
  >
    {isDragging && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          borderRadius: 16,
          background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-surface))',
          border: '2px dashed var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--accent)',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        <Paperclip size={17} /> Drop files to attach
      </div>
    )}

    {isGenerating && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          zIndex: 5,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      />
    )}

    {children}
  </div>
);

