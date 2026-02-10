'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, LEGEND_CONFIG, formatters } from '@/lib/chart-config';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from '@/lib/chart-config';

interface ROICategory {
  category: string;
  wastedSpend: number;
  missedRevenue: number;
  inefficiencyCost: number;
}

interface ROIImpactBarProps {
  data: ROICategory[];
  height?: number;
  compact?: boolean;
}

function ROITooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, ...TOOLTIP_ITEM_STYLE }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block', flexShrink: 0 }} />
          <span>{entry.name}: </span>
          <span style={{ color: '#FAFBFC', fontFamily: '"JetBrains Mono", monospace' }}>
            {formatters.currency(entry.value)}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4, ...TOOLTIP_ITEM_STYLE }}>
        <span style={{ color: '#FAFBFC', fontWeight: 600 }}>Total: {formatters.currency(total)}</span>
      </div>
    </div>
  );
}

export function ROIImpactBar({ data, height = 300, compact = false }: ROIImpactBarProps) {
  const grandTotal = data.reduce((s, d) => s + d.wastedSpend + d.missedRevenue + d.inefficiencyCost, 0);

  return (
    <div
      role="img"
      aria-label={`ROI impact analysis. Total estimated impact: ${formatters.currency(grandTotal)}`}
    >
      {/* Grand total callout */}
      {!compact && (
        <div className="text-center mb-4">
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 13, color: '#64748B' }}>
            Estimated Total Impact
          </span>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 800, color: '#EF476F' }}>
            {formatters.currency(grandTotal)}
            <span style={{ fontSize: 14, fontWeight: 400, color: '#94A3B8' }}>/mo</span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={compact ? CHART_MARGINS.bento : CHART_MARGINS.wideLabel}
        >
          <CartesianGrid {...GRID_STYLE} horizontal={false} vertical />
          <XAxis
            type="number"
            {...AXIS_STYLE}
            tickFormatter={formatters.currency}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={compact ? 80 : 120}
            tick={{ ...AXIS_STYLE.tick, fontWeight: 500, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ROITooltip />} cursor={{ fill: 'rgba(26,26,46,0.03)' }} />
          {!compact && (
            <Legend {...LEGEND_CONFIG} />
          )}
          <Bar dataKey="wastedSpend" name="Wasted Spend" stackId="a" fill="#EF476F" radius={[0, 0, 0, 0]} animationDuration={800} />
          <Bar dataKey="missedRevenue" name="Missed Revenue" stackId="a" fill="#FFD166" animationDuration={800} />
          <Bar dataKey="inefficiencyCost" name="Inefficiency Cost" stackId="a" fill="#94A3B8" radius={[0, 4, 4, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
