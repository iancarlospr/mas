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
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, LEGEND_CONFIG } from '@/lib/chart-config';
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
  good: { bg: 'bg-[#06D6A0]/5', text: 'text-[#06D6A0]', border: 'border-[#06D6A0]' },
  'needs-improvement': { bg: 'bg-[#FFD166]/5', text: 'text-[#FFD166]', border: 'border-[#FFD166]' },
  poor: { bg: 'bg-[#EF476F]/5', text: 'text-[#EF476F]', border: 'border-[#EF476F]' },
};

const DEFAULT_RATING = { bg: 'bg-[#06D6A0]/5', text: 'text-[#06D6A0]', border: 'border-[#06D6A0]' };

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
              <div className="text-xs font-heading font-semibold text-muted uppercase tracking-wide mb-1">
                {m.name}
              </div>
              <div className={cn('font-mono text-3xl font-extrabold', compact && 'text-2xl', colors.text)}>
                {m.value}
                <span className="text-sm font-normal text-muted ml-1">{m.unit}</span>
              </div>
              <div
                className={cn(
                  'mt-1 text-[10px] px-2 py-0.5 rounded-full inline-block font-medium',
                  m.rating === 'good' && 'bg-[#06D6A0]/10 text-[#06D6A0]',
                  m.rating === 'needs-improvement' && 'bg-[#FFD166]/10 text-[#FFD166]',
                  m.rating === 'poor' && 'bg-[#EF476F]/10 text-[#EF476F]',
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
            <Bar dataKey="site" name="Your Site" fill="#1A1A2E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="good" name="Good Threshold" fill="#06D6A0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="industry" name="Industry Avg" fill="#94A3B8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
