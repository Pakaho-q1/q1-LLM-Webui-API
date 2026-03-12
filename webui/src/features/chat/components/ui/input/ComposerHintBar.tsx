import React from 'react';

interface ComposerHintBarProps {
  isGenerating?: boolean;
  fileCount: number;
  inputTokenCount: number;
  isCountingTokens?: boolean;
}

export const ComposerHintBar: React.FC<ComposerHintBarProps> = ({
  isGenerating,
  fileCount,
  inputTokenCount,
  isCountingTokens,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: 14,
    }}
  >
    {isGenerating ? (
      <span
        style={{
          fontSize: '0.72rem',
          color: 'var(--danger)',
          opacity: 0.7,
          animation: 'fadeIn 0.2s both',
        }}
      >
        Click ■ to stop generation
      </span>
    ) : fileCount > 0 ? (
      <span className="text-[0.72rem] text-[var(--text-tertiary)]">
        {fileCount} file{fileCount > 1 ? 's' : ''} attached
      </span>
    ) : inputTokenCount > 0 || isCountingTokens ? (
      <span className="text-[0.72rem] text-[var(--text-tertiary)]">
        Input: {inputTokenCount.toLocaleString()} tok
        {isCountingTokens ? ' · counting...' : ''}
      </span>
    ) : null}
  </div>
);

