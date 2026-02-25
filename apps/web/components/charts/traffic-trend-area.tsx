'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { AlphaTooltip } from './alpha-tooltip';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, OKLCH, formatters } from '@/lib/chart-config';

interface TrafficTrendPoint {
  month: string;
  visits: number;
  previousYear?: number;
}

interface TrafficTrendAreaProps {
  data: TrafficTrendPoint[];
  height?: number;
  compact?: boolean;
  showPreviousYear?: boolean;
}

export function TrafficTrendArea({
  data,
  height = 240,
  compact = false,
  showPreviousYear = false,
}: TrafficTrendAreaProps) {
  const avg = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.visits, 0) / data.length)
    : 0;

  return (
    <div
      role="img"
      aria-label={`Traffic trend over ${data.length} months. Average: ${formatters.thousands(avg)} visits.`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={compact ? CHART_MARGINS.bento : CHART_MARGINS.standard}
        >
          <defs>
            <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OKLCH.black} stopOpacity={0.2} />
              <stop offset="100%" stopColor={OKLCH.black} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            dataKey="month"
            {...AXIS_STYLE}
            tick={{ ...AXIS_STYLE.tick, fontSize: compact ? 10 : 12 }}
          />
          <YAxis
            {...AXIS_STYLE}
            tickFormatter={formatters.thousands}
            width={compact ? 40 : 60}
          />
          <Tooltip content={<AlphaTooltip formatter={(v) => formatters.thousands(v as number)} />} />
          <ReferenceLine
            y={avg}
            stroke={OKLCH.midLight}
            strokeDasharray="3 3"
            label={compact ? undefined : {
              value: `Avg: ${formatters.thousands(avg)}`,
              position: 'right',
              style: { fontFamily: 'var(--font-data)', fontSize: 11, fill: OKLCH.midLight },
            }}
          />
          {showPreviousYear && (
            <Area
              type="monotone"
              dataKey="previousYear"
              stroke={OKLCH.midLight}
              strokeDasharray="4 4"
              fill="none"
              strokeWidth={1.5}
              animationDuration={1200}
              animationEasing="ease-in-out"
              name="Previous Year"
            />
          )}
          <Area
            type="monotone"
            dataKey="visits"
            stroke={OKLCH.black}
            strokeWidth={2}
            fill="url(#trafficGradient)"
            animationDuration={1200}
            animationEasing="ease-in-out"
            activeDot={{ r: 5, fill: OKLCH.black, stroke: OKLCH.white, strokeWidth: 2 }}
            name="Visits"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
