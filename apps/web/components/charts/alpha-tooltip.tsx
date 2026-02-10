'use client';

import type { TooltipProps } from 'recharts';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from '@/lib/chart-config';

export function AlphaTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      {payload.map((entry, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            ...TOOLTIP_ITEM_STYLE,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: entry.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span>{entry.name}: </span>
          <span
            style={{
              color: '#FAFBFC',
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 500,
            }}
          >
            {formatter
              ? (formatter as (value: number | undefined, name: string | undefined, entry: unknown, index: number, payload: unknown[]) => string)(entry.value, entry.name, entry, index, payload)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
