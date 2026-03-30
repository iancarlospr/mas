'use client';

import { cn } from '@/lib/utils';
import { CATEGORY_BADGE_COLORS, STATUS_COLORS } from '@/lib/chart-config';
import type { Signal } from '@marketing-alpha/types';

interface SignalBadgeProps {
  signal?: Signal;
  name?: string;
  category?: string;
  confidence?: number;
  status?: 'active' | 'inactive' | 'degraded';
  showConfidence?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SignalBadge({
  signal,
  name: nameProp,
  category: categoryProp,
  confidence: confidenceProp,
  status,
  showConfidence = false,
  onClick,
  className,
}: SignalBadgeProps) {
  const name = nameProp ?? signal?.name ?? '';
  const category = categoryProp ?? signal?.category ?? 'other';
  const confidence = confidenceProp ?? (signal?.confidence ?? 0);
  const catColor = CATEGORY_BADGE_COLORS[category] ?? CATEGORY_BADGE_COLORS.other;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        className,
      )}
      style={{
        border: `1px solid ${catColor}30`,
        backgroundColor: `${catColor}08`,
        color: '#1A1A2E',
      }}
      title={signal?.evidence ? `${signal.evidence} (${Math.round(confidence * 100)}% confidence)` : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Status dot */}
      {status && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
      )}

      {/* Name */}
      <span style={{ fontFamily: '"Inter", sans-serif', fontWeight: 500 }}>{name}</span>

      {/* Confidence indicator */}
      {showConfidence && confidence > 0 && (
        <span
          className="inline-flex items-center"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '10px',
            color: '#64748B',
          }}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
