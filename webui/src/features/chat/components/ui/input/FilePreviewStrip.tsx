import React from 'react';
import {
  X,
  Image as ImageIcon,
  FileText,
  FileArchive,
  FileCode,
  Film,
  Music,
} from 'lucide-react';
import { FileInfo } from './types';

function getFileIcon(file: File) {
  const t = file.type;
  if (t.startsWith('image/'))
    return <ImageIcon size={15} className="text-blue-500" />;
  if (t.startsWith('video/'))
    return <Film size={15} className="text-violet-500" />;
  if (t.startsWith('audio/'))
    return <Music size={15} className="text-pink-500" />;
  if (t === 'application/pdf')
    return <FileText size={15} className="text-red-500" />;
  if (
    t.includes('zip') ||
    t.includes('tar') ||
    t.includes('rar') ||
    t.includes('7z')
  )
    return <FileArchive size={15} className="text-amber-500" />;
  if (
    t.includes('javascript') ||
    t.includes('typescript') ||
    t.includes('python') ||
    t.includes('json') ||
    t.includes('xml') ||
    t.includes('html') ||
    t.includes('css')
  )
    return <FileCode size={15} className="text-emerald-500" />;
  return <FileText size={15} className="text-[var(--text-tertiary)]" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FilePreviewStripProps {
  files: FileInfo[];
  disabled?: boolean;
  isGenerating?: boolean;
  onRemoveFile: (index: number) => void;
}

export const FilePreviewStrip: React.FC<FilePreviewStripProps> = ({
  files,
  disabled,
  isGenerating,
  onRemoveFile,
}) => {
  if (files.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        animation: 'fadeIn 0.18s both',
      }}
    >
      {files.map((fi, idx) => (
        <div
          key={idx}
          style={{
            position: 'relative',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
            animation: 'scaleIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          {fi.preview ? (
            <div style={{ width: 72, height: 72, position: 'relative' }}>
              <img
                src={fi.preview}
                alt={fi.file.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '2px 4px',
                  background: 'rgba(0,0,0,0.55)',
                  fontSize: '0.6rem',
                  color: '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fi.file.name}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                maxWidth: 200,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getFileIcon(fi.file)}
              </div>
              <div className="min-w-0">
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fi.file.name}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-tertiary)',
                    marginTop: 1,
                  }}
                >
                  {formatBytes(fi.file.size)}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => onRemoveFile(idx)}
            disabled={isGenerating || disabled}
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
};

