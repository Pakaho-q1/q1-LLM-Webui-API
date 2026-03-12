import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Square, X } from 'lucide-react';
import { transcribeAudioFile } from '@/services/api.service';

type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

interface VoicePopupProps {
  onClose: () => void;
  onTranscript: (text: string) => void;
}

export const VoicePopup: React.FC<VoicePopupProps> = ({
  onClose,
  onTranscript,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('listening');
  const [errorMsg, setErrorMsg] = useState('');
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(28).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const hasAudioRef = useRef(false);
  const SILENCE_MS = 2500;

  useEffect(() => {
    void startRecording();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) void audioContextRef.current.close();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
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
    } catch {
      setVoiceState('error');
      setErrorMsg('Transcription failed');
      setTimeout(onClose, 1800);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
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
      mr.onstop = () => {
        void handleRecordingStop();
      };
      mr.start(100);

      silenceTimerRef.current = setTimeout(() => {
        if (!hasAudioRef.current) onClose();
        else stopRecording();
      }, SILENCE_MS);
    } catch {
      setVoiceState('error');
      setErrorMsg('Microphone access denied');
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

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
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
              <Loader2 size={22} style={{ color: 'var(--accent)', animation: 'spinSlow 1s linear infinite' }} />
            ) : voiceState === 'error' ? (
              <MicOff size={22} className="text-[var(--danger)]" />
            ) : (
              <Mic size={22} style={{ color: stateColor[voiceState] }} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 48, marginBottom: 16 }}>
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

        <div className="text-center">
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: stateColor[voiceState], margin: 0 }}>
            {stateLabel[voiceState]}
          </p>
          {voiceState === 'listening' && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
              Auto-stops after {SILENCE_MS / 1000}s of silence · tap outside to cancel
            </p>
          )}
        </div>

        {voiceState === 'listening' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={stopRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
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

