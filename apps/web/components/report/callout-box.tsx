'use client';

import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

/** Callout box variants — PRD-cont-4 Section 10.3 */
interface CalloutBoxProps {
  type: 'critical' | 'warning' | 'info' | 'positive';
  title?: string;
  children: React.ReactNode;
}

const CALLOUT_STYLES = {
  critical: { border: '#EF476F', bg: '#FFF5F7', Icon: AlertTriangle, iconColor: '#EF476F' },
  warning:  { border: '#FFD166', bg: '#FFFBEB', Icon: AlertCircle, iconColor: '#FFD166' },
  info:     { border: '#0F3460', bg: '#F0F4FF', Icon: Info, iconColor: '#0F3460' },
  positive: { border: '#06D6A0', bg: '#F0FFF4', Icon: CheckCircle, iconColor: '#06D6A0' },
} as const;

export function CalloutBox({ type, title, children }: CalloutBoxProps) {
  const s = CALLOUT_STYLES[type];
  const { Icon } = s;

  return (
    <div
      className="rounded-r-lg"
      style={{
        borderLeft: `4px solid ${s.border}`,
        background: s.bg,
        padding: '20px 24px',
      }}
    >
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <Icon size={16} color={s.iconColor} />
          <span
            className="font-heading font-700 text-sm"
            style={{ color: s.iconColor }}
          >
            {title}
          </span>
        </div>
      )}
      <div className="text-sm leading-relaxed" style={{ fontFamily: '"Inter", sans-serif', color: '#1A1A2E' }}>
        {children}
      </div>
    </div>
  );
}
