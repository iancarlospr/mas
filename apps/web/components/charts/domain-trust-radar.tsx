'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { LEGEND_CONFIG, ANIMATION_CONFIG, RESOLVED_COLORS, getScoreTierColor } from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface TrustMetric {
  dimension: string;
  value: number;
  benchmark: number;
}

interface DomainTrustRadarProps {
  trustScore: number;
  metrics: TrustMetric[];
  height?: number;
  showBadge?: boolean;
  className?: string;
}

export function DomainTrustRadar({
  trustScore,
  metrics,
  height = 300,
  showBadge = true,
  className,
}: DomainTrustRadarProps) {
  const tierColor = getScoreTierColor(trustScore);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start gap-4">
        {/* Score Badge */}
        {showBadge && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-mono text-xl font-bold"
              style={{ backgroundColor: tierColor }}
            >
              {trustScore}
            </div>
            <span className="text-[10px] text-muted mt-1 font-medium">Domain Trust</span>
          </div>
        )}

        {/* Radar Chart */}
        <div className="flex-1">
          <ChartContainer height={height}>
            <RadarChart data={metrics} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid
                gridType="polygon"
                strokeDasharray="3 3"
                stroke={RESOLVED_COLORS.chromeLight}
              />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{
                  fontSize: 11,
                  fill: RESOLVED_COLORS.muted,
                  fontFamily: 'var(--font-data)',
                }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: RESOLVED_COLORS.chrome }}
              />
              <Radar
                name="Your Domain"
                dataKey="value"
                stroke={RESOLVED_COLORS.ink}
                fill={RESOLVED_COLORS.ink}
                fillOpacity={0.3}
                {...ANIMATION_CONFIG}
              />
              <Radar
                name="Benchmark"
                dataKey="benchmark"
                stroke={RESOLVED_COLORS.terminal}
                strokeDasharray="4 3"
                fill={RESOLVED_COLORS.terminal}
                fillOpacity={0.15}
                {...ANIMATION_CONFIG}
              />
              <Legend {...LEGEND_CONFIG} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const dim = payload[0]?.payload?.dimension;
                  return (
                    <div className="bg-gs-ink text-white rounded-lg px-4 py-3 shadow-lg text-xs">
                      <div className="font-system font-bold text-sm mb-1">{dim}</div>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-gs-muted">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: p.color }}
                          />
                          <span>{p.name}:</span>
                          <span className="text-white font-mono">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}
