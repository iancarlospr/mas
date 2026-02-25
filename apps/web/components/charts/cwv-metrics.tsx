'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { AlphaTooltip } from './alpha-tooltip';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, LEGEND_CONFIG, RESOLVED_COLORS } from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface CWVMetric {
  name: string;
  value: number;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  goodThreshold: number;
  industryAvg?: number;
}

interface CWVMetricsProps {
  metrics: CWVMetric[];
  showChart?: boolean;
  compact?: boolean;
  height?: number;
  className?: string;
}

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  good: { bg: 'bg-gs-terminal/5', text: 'text-gs-terminal', border: 'border-gs-terminal' },
  'needs-improvement': { bg: 'bg-gs-warning/5', text: 'text-gs-warning', border: 'border-gs-warning' },
  poor: { bg: 'bg-gs-critical/5', text: 'text-gs-critical', border: 'border-gs-critical' },
};

const DEFAULT_RATING = { bg: 'bg-gs-terminal/5', text: 'text-gs-terminal', border: 'border-gs-terminal' };

export function CWVMetrics({
  metrics,
  showChart = true,
  compact = false,
  height = 240,
  className,
}: CWVMetricsProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Metric Cards */}
      <div className={cn('grid gap-3 mb-4', compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3')}>
        {metrics.map((m) => {
          const colors = RATING_COLORS[m.rating] ?? DEFAULT_RATING;
          return (
            <div
              key={m.name}
              className={cn(
                'rounded-xl border p-4 text-center transition-shadow hover:shadow-sm',
                colors.bg,
                colors.border,
                'border-opacity-30',
              )}
            >
              <div className="text-xs font-system font-semibold text-muted uppercase tracking-wide mb-1">
                {m.name}
              </div>
              <div className={cn('font-mono text-3xl font-extrabold', compact && 'text-2xl', colors.text)}>
                {m.value}
                <span className="text-sm font-normal text-muted ml-1">{m.unit}</span>
              </div>
              <div
                className={cn(
                  'mt-1 text-[10px] px-2 py-0.5 rounded-full inline-block font-medium',
                  m.rating === 'good' && 'bg-gs-terminal/10 text-gs-terminal',
                  m.rating === 'needs-improvement' && 'bg-gs-warning/10 text-gs-warning',
                  m.rating === 'poor' && 'bg-gs-critical/10 text-gs-critical',
                )}
              >
                {m.rating === 'needs-improvement' ? 'Needs Improvement' : m.rating.charAt(0).toUpperCase() + m.rating.slice(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Bar Chart */}
      {showChart && (
        <ChartContainer height={height}>
          <BarChart
            data={metrics.map((m) => ({
              name: m.name,
              site: m.value,
              good: m.goodThreshold,
              industry: m.industryAvg ?? 0,
            }))}
            margin={CHART_MARGINS.standard}
          >
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="name" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip content={<AlphaTooltip />} />
            <Legend {...LEGEND_CONFIG} />
            <Bar dataKey="site" name="Your Site" fill={RESOLVED_COLORS.ink} radius={[4, 4, 0, 0]} />
            <Bar dataKey="good" name="Good Threshold" fill={RESOLVED_COLORS.terminal} radius={[4, 4, 0, 0]} />
            <Bar dataKey="industry" name="Industry Avg" fill={RESOLVED_COLORS.chrome} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
