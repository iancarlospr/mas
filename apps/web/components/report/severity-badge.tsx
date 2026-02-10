'use client';

import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import type { Severity } from '@marketing-alpha/types';

/** Finding severity badge — PRD-cont-4 Section 5.5 */
interface SeverityBadgeProps {
  severity: Severity;
}

const STYLES = {
  critical: { bg: '#EF476F', text: '#FFFFFF', label: 'CRITICAL', Icon: AlertTriangle },
  warning:  { bg: '#FFD166', text: '#1A1A2E', label: 'WARNING', Icon: AlertCircle },
  info:     { bg: '#0F3460', text: '#FFFFFF', label: 'INFO', Icon: Info },
  positive: { bg: '#06D6A0', text: '#1A1A2E', label: 'POSITIVE', Icon: CheckCircle },
} as const;

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const s = STYLES[severity];
  const { Icon } = s;

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      <Icon size={12} />
      {s.label}
    </span>
  );
}
