'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ChartContainer } from './chart-container';
import { AlphaTooltip } from './alpha-tooltip';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, ANIMATION_CONFIG, COOKIE_CATEGORY_COLORS, RESOLVED_COLORS } from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface CookieCategoryData {
  category: string;
  count: number;
}

interface CookieAuditBarProps {
  data: CookieCategoryData[];
  height?: number;
  className?: string;
}

/** Map display-cased category names to the centralized color dict */
const COOKIE_COLORS: Record<string, string> = {
  Necessary: COOKIE_CATEGORY_COLORS.essential ?? RESOLVED_COLORS.terminal,
  Analytics: COOKIE_CATEGORY_COLORS.analytics ?? RESOLVED_COLORS.warning,
  Marketing: COOKIE_CATEGORY_COLORS.advertising ?? RESOLVED_COLORS.critical,
  Functional: COOKIE_CATEGORY_COLORS.functional ?? RESOLVED_COLORS.red,
  Unknown: COOKIE_CATEGORY_COLORS.unknown ?? RESOLVED_COLORS.chrome,
};

export function CookieAuditBar({ data, height = 240, className }: CookieAuditBarProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-lg font-bold text-primary">{total}</span>
        <span className="text-xs text-muted">total cookies</span>
      </div>
      <ChartContainer height={height}>
        <BarChart data={data} margin={CHART_MARGINS.standard}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="category" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} allowDecimals={false} />
          <Tooltip content={<AlphaTooltip />} />
          <Bar
            dataKey="count"
            name="Cookies"
            radius={[4, 4, 0, 0]}
            {...ANIMATION_CONFIG}
          >
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={COOKIE_COLORS[entry.category] ?? RESOLVED_COLORS.chrome}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
