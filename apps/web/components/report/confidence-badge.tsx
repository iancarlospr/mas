'use client';

import { CheckCircle, Info, HelpCircle } from 'lucide-react';
import type { Confidence } from '@marketing-alpha/types';

/** Confidence pill badges — PRD-cont-4 Section 10.6 */
interface ConfidenceBadgeProps {
  level: Confidence;
}

const BADGE_STYLES = {
  high:   { bg: '#06D6A0', text: '#FFFFFF', label: 'High Confidence', Icon: CheckCircle },
  medium: { bg: '#FFD166', text: '#1A1A2E', label: 'Medium Confidence', Icon: Info },
  low:    { bg: '#94A3B8', text: '#FFFFFF', label: 'Low Confidence — Estimated', Icon: HelpCircle },
} as const;

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const s = BADGE_STYLES[level];
  const { Icon } = s;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{
        background: s.bg,
        color: s.text,
        padding: '2px 10px',
        fontFamily: '"Inter", sans-serif',
        fontWeight: 500,
        fontSize: '0.7rem',
      }}
    >
      <Icon size={12} />
      {s.label}
    </span>
  );
}
