'use client';

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TRAFFIC_SOURCE_COLORS, CHART_PALETTE, TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from '@/lib/chart-config';
import { formatters } from '@/lib/chart-config';

interface TrafficSource {
  source: string;
  percentage: number;
  visits: number;
}

interface TrafficSourcesDonutProps {
  data: TrafficSource[];
  height?: number;
  compact?: boolean;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: TrafficSource }> }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]!;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{entry.payload.source}</p>
      <p style={TOOLTIP_ITEM_STYLE}>
        <span style={{ color: '#FAFBFC', fontFamily: '"JetBrains Mono", monospace' }}>
          {entry.payload.percentage}%
        </span>
        {' · '}
        {formatters.thousands(entry.payload.visits)} visits
      </p>
    </div>
  );
}

export function TrafficSourcesDonut({ data, height = 200, compact = false }: TrafficSourcesDonutProps) {
  const totalVisits = data.reduce((sum, d) => sum + d.visits, 0);

  return (
    <div
      role="img"
      aria-label={`Traffic sources: ${data.map(d => `${d.source} ${d.percentage}%`).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="visits"
            nameKey="source"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="95%"
            animationBegin={200}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={TRAFFIC_SOURCE_COLORS[entry.source] ?? CHART_PALETTE[index % CHART_PALETTE.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          {!compact && (
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontFamily: '"Inter", sans-serif',
                fontSize: '12px',
                color: '#64748B',
                paddingTop: '16px',
              }}
            />
          )}
          {/* Center text */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: compact ? 20 : 28,
              fontWeight: 700,
              fill: '#1A1A2E',
            }}
          >
            {formatters.thousands(totalVisits)}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
