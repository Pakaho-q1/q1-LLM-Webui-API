import React from 'react';
import { BookOpen, Clock3, Gauge, Sparkles } from 'lucide-react';
import { MetricChip } from '@/components/ui/MetricChip';
import { Message } from '../types';

interface MessageMetricsProps {
  msg: Message;
  currentModel?: string;
}

const formatNumber = (value?: number) => Number(value || 0).toLocaleString();
const formatMsAsSeconds = (value?: number) => `${((value || 0) / 1000).toFixed(1)}s`;
const formatSpeed = (value?: number) => `${Number(value || 0).toFixed(2)} t/s`;

export const MessageMetrics: React.FC<MessageMetricsProps> = ({
  msg,
  currentModel,
}) => {
  const metrics = msg.metrics || {};
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-[var(--text-secondary)]">
      <MetricChip icon={<Sparkles size={11} />} value={currentModel || 'assistant'} />
      <MetricChip
        title={`Prompt tokens: ${formatNumber(metrics.prompt_tokens)}`}
        icon={<BookOpen size={11} />}
        value={formatNumber(metrics.prompt_tokens)}
      />
      <MetricChip
        title={`Prompt processing time: ${formatMsAsSeconds(metrics.prompt_processing_time_ms)}`}
        icon={<Clock3 size={11} />}
        value={formatMsAsSeconds(metrics.prompt_processing_time_ms)}
      />
      <MetricChip
        title={`Prompt processing speed: ${formatSpeed(metrics.prompt_tokens_per_sec)}`}
        icon={<Gauge size={11} />}
        value={formatSpeed(metrics.prompt_tokens_per_sec)}
      />
      <MetricChip
        title={`Generated tokens: ${formatNumber(metrics.generated_tokens)}`}
        icon={<Sparkles size={11} />}
        value={formatNumber(metrics.generated_tokens)}
      />
      <MetricChip
        title={`Generation time: ${formatMsAsSeconds(metrics.generation_time_ms)}`}
        icon={<Clock3 size={11} />}
        value={formatMsAsSeconds(metrics.generation_time_ms)}
      />
      <MetricChip
        title={`Generation speed: ${formatSpeed(metrics.generation_tokens_per_sec)}`}
        icon={<Gauge size={11} />}
        value={formatSpeed(metrics.generation_tokens_per_sec)}
      />
    </div>
  );
};

