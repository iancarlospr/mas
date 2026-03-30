'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { AlphaTooltip } from './alpha-tooltip';
import { RESOLVED_COLORS, AXIS_STYLE, GRID_STYLE, CHART_MARGINS, TRAFFIC_LIGHT_COLORS } from '@/lib/chart-config';
import type { CategoryScore, ScoreCategory } from '@marketing-alpha/types';

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  analytics_measurement: 'Analytics',
  paid_media: 'Paid Media',
  performance_experience: 'Performance',
  security_compliance: 'Compliance',
  martech_infrastructure: 'MarTech',
  seo_content: 'SEO',
  market_intelligence: 'Market Intelligence',
  brand_presence: 'Brand Presence',
};

interface CategoryScoresBarProps {
  categories: CategoryScore[];
  height?: number;
  compact?: boolean;
}

function getBarColor(light: 'green' | 'yellow' | 'red'): string {
  if (light === 'green') return TRAFFIC_LIGHT_COLORS.green;
  if (light === 'yellow') return TRAFFIC_LIGHT_COLORS.amber;
  return TRAFFIC_LIGHT_COLORS.red;
}

export function CategoryScoresBar({ categories, height = 240, compact = false }: CategoryScoresBarProps) {
  const data = categories.map((cat) => ({
    name: CATEGORY_LABELS[cat.category],
    score: Math.round(cat.score),
    light: cat.light,
  }));

  return (
    <div
      role="img"
      aria-label={`Category scores: ${data.map(d => `${d.name} ${d.score}`).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={compact ? CHART_MARGINS.bento : CHART_MARGINS.wideLabel}
        >
          <CartesianGrid {...GRID_STYLE} horizontal={false} vertical />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            {...AXIS_STYLE}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={compact ? 80 : 110}
            tick={{
              ...AXIS_STYLE.tick,
              fontWeight: 600,
              fontFamily: 'var(--font-system)',
              fontSize: 13,
              fill: RESOLVED_COLORS.ink,
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<AlphaTooltip />} cursor={{ fill: 'oklch(0.15 0.01 80 / 0.03)' }} />
          <Bar
            dataKey="score"
            radius={[0, 4, 4, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.light)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
