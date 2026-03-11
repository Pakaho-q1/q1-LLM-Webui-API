import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import {
  Send,
  Paperclip,
  Mic,
  X,
  Image as ImageIcon,
  FileText,
  FileArchive,
  FileCode,
  Film,
  Music,
  Square,
  Loader2,
  MicOff,
} from 'lucide-react';
import { transcribeAudioFile } from '@/services/api.service';

interface FileInfo {
  file: File;
  preview?: string;
}

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

type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

interface VoicePopupProps {
  onClose: () => void;
  onTranscript: (text: string) => void;
}

const VoicePopup: React.FC<VoicePopupProps> = ({ onClose, onTranscript }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('listening');
  const [errorMsg, setErrorMsg] = useState('');
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(28).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const hasAudioRef = useRef(false);
  const SILENCE_MS = 2500;

  useEffect(() => {
    startRecording();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const draw = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const amps = Array.from({ length: 28 }, (_, i) => {
          const idx = Math.floor((i / 28) * data.length);
          return data[idx] / 255;
        });
        setAmplitudes(amps);

        const loudness = amps.reduce((s, a) => s + a, 0) / amps.length;
        if (loudness > 0.03) {
          hasAudioRef.current = true;

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
          }, SILENCE_MS);
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleRecordingStop;
      mr.start(100);

      silenceTimerRef.current = setTimeout(() => {
        if (!hasAudioRef.current) onClose();
        else stopRecording();
      }, SILENCE_MS);
    } catch (err) {
      setVoiceState('error');
      setErrorMsg('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setVoiceState('processing');
    setAmplitudes(Array(28).fill(0));
  };

  const handleRecordingStop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size < 500) {
      onClose();
      return;
    }
    setVoiceState('processing');

    try {
      const transcript = await transcribeAudioFile(blob);

      if (transcript.trim()) {
        onTranscript(transcript.trim());
        setVoiceState('done');
        setTimeout(onClose, 400);
      } else {
        setVoiceState('error');
        setErrorMsg('No speech detected');
        setTimeout(onClose, 1500);
      }
    } catch (err) {
      setVoiceState('error');
      setErrorMsg('Transcription failed');
      setTimeout(onClose, 1800);
    }
  };

  const stateLabel: Record<VoiceState, string> = {
    idle: 'Initializing…',
    listening: 'Listening…',
    processing: 'Transcribing…',
    done: 'Done ✓',
    error: errorMsg || 'Error',
  };

  const stateColor: Record<VoiceState, string> = {
    idle: 'var(--text-tertiary)',
    listening: 'var(--danger)',
    processing: 'var(--accent)',
    done: 'var(--success)',
    error: 'var(--danger)',
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 16px 80px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '28px 24px 24px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={13} />
        </button>

        {/* Mic icon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background:
                voiceState === 'listening'
                  ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
                  : voiceState === 'processing'
                    ? 'var(--accent-subtle)'
                    : 'var(--bg-elevated)',
              border: `2px solid ${stateColor[voiceState]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
              boxShadow:
                voiceState === 'listening'
                  ? '0 0 0 8px color-mix(in srgb, var(--danger) 8%, transparent)'
                  : 'none',
            }}
          >
            {voiceState === 'processing' ? (
              <Loader2
                size={22}
                style={{
                  color: 'var(--accent)',
                  animation: 'spinSlow 1s linear infinite',
                }}
              />
            ) : voiceState === 'error' ? (
              <MicOff size={22} className="text-[var(--danger)]" />
            ) : (
              <Mic size={22} style={{ color: stateColor[voiceState] }} />
            )}
          </div>
        </div>

        {/* Waveform bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            height: 48,
            marginBottom: 16,
          }}
        >
          {amplitudes.map((amp, i) => (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 3,
                background:
                  voiceState === 'listening'
                    ? `color-mix(in srgb, var(--danger) ${30 + amp * 70}%, transparent)`
                    : 'var(--border-strong)',
                height:
                  voiceState === 'processing'
                    ? `${12 + Math.sin(Date.now() / 200 + i) * 8}px`
                    : `${Math.max(4, amp * 44)}px`,
                transition:
                  voiceState === 'listening'
                    ? 'height 0.08s ease'
                    : 'height 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Status label */}
        <div className="text-center">
          <p
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: stateColor[voiceState],
              margin: 0,
            }}
          >
            {stateLabel[voiceState]}
          </p>
          {voiceState === 'listening' && (
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-tertiary)',
                margin: '4px 0 0',
              }}
            >
              Auto-stops after {SILENCE_MS / 1000}s of silence · tap outside to
              cancel
            </p>
          )}
        </div>

        {/* Stop button while listening */}
        {voiceState === 'listening' && (
          <div
            style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}
          >
            <button
              onClick={stopRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                borderRadius: 10,
                background:
                  'color-mix(in srgb, var(--danger) 12%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: '0.83rem',
                cursor: 'pointer',
              }}
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
  onOpenTools,
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
      if (copy[idx].preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
    });
  }, []);

  const handleSend = useCallback(() => {
    if ((!text.trim() && files.length === 0) || isGenerating || disabled)
      return;
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

  const handleStop = useCallback(async () => {
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

  const ICON_BTN_STYLE: React.CSSProperties = {
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
        {/* ── File Preview Strip ─────────────── */}
        {files.length > 0 && (
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
                {/* Image preview */}
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

                {/* Remove button */}
                <button
                  onClick={() => removeFile(idx)}
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
        )}

        {/* ── Main Input Box ─────────────────── */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 4,
            borderRadius: 18,
            padding: '6px 6px 6px 12px',
            background: isGenerating
              ? 'var(--bg-elevated)'
              : 'var(--bg-surface)',
            border: `1.5px solid ${
              isDragging
                ? 'var(--accent)'
                : isFocused
                  ? 'var(--accent)'
                  : isGenerating
                    ? 'color-mix(in srgb, var(--accent) 35%, var(--border))'
                    : 'var(--border)'
            }`,
            boxShadow: isFocused
              ? '0 0 0 3px var(--accent-subtle)'
              : 'var(--shadow-sm)',
            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.2s',
          }}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                borderRadius: 16,
                background:
                  'color-mix(in srgb, var(--accent) 8%, var(--bg-surface))',
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

          {/* Generating overlay on textarea */}
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

          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating || disabled}
            title="Attach file"
            style={ICON_BTN_STYLE}
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
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="hidden"
          />

          {/* Textarea */}
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
                  ? 'Connect a model to start…'
                  : 'Message… (Enter to send, Shift+Enter for new line)'
            }
            className={`custom-scrollbar font-inherit flex-1 resize-none border-none bg-transparent px-2 py-[7px] text-[0.9rem] leading-[1.6] caret-[var(--accent)] transition-colors duration-200 outline-none ${isGenerating ? 'cursor-default text-[var(--text-tertiary)]' : 'cursor-text text-[var(--text-primary)]'} placeholder:text-[var(--text-tertiary)] disabled:opacity-50`}
          />

          {/* Generating indicator inside textarea area */}
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
              <span className="italic">Generating response…</span>
            </div>
          )}

          {/* Right buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              paddingBottom: 2,
              flexShrink: 0,
            }}
          >
            {/* Mic button — only when not generating */}
            {!isGenerating && (
              <button
                onClick={() => setShowVoice(true)}
                disabled={disabled}
                title="Voice input"
                style={{ ...ICON_BTN_STYLE, opacity: disabled ? 0.4 : 1 }}
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

            {/* Send / Stop button */}
            <button
              onClick={isGenerating ? handleStop : handleSend}
              disabled={!isGenerating && (!hasContent || disabled)}
              title={isGenerating ? 'Stop generation' : 'Send message'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                border: 'none',
                cursor:
                  !isGenerating && (!hasContent || disabled)
                    ? 'default'
                    : 'pointer',
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
        </div>

        {/* ── Hint bar ─────────────────────── */}
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
          ) : files.length > 0 ? (
            <span className="text-[0.72rem] text-[var(--text-tertiary)]">
              {files.length} file{files.length > 1 ? 's' : ''} attached
            </span>
          ) : inputTokenCount > 0 || isCountingTokens ? (
            <span className="text-[0.72rem] text-[var(--text-tertiary)]">
              Input: {inputTokenCount.toLocaleString()} tok
              {isCountingTokens ? ' · counting...' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Voice Popup ────────────────────── */}
      {showVoice && (
        <VoicePopup
          onClose={() => setShowVoice(false)}
          onTranscript={(transcript) => {
            setText((prev) => (prev ? prev + ' ' + transcript : transcript));
            onTextChange?.(text ? text + ' ' + transcript : transcript);
          }}
        />
      )}
    </div>
  );
};
