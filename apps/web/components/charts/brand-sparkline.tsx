'use client';

import { LineChart, Line, YAxis } from 'recharts';
import { ChartContainer } from './chart-container';
import { cn } from '@/lib/utils';
import { OKLCH } from '@/lib/chart-config';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SparklineData {
  month: string;
  volume: number;
}

interface BrandSparklineProps {
  data: SparklineData[];
  currentVolume?: number;
  trendPercent?: number;
  className?: string;
}

export function BrandSparkline({
  data,
  currentVolume,
  trendPercent,
  className,
}: BrandSparklineProps) {
  const latestVolume = currentVolume ?? data[data.length - 1]?.volume ?? 0;
  const trend =
    trendPercent != null
      ? trendPercent > 0
        ? 'up'
        : trendPercent < 0
          ? 'down'
          : 'flat'
      : 'flat';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-shrink-0">
        <div className="font-mono text-2xl font-bold text-primary">
          {latestVolume >= 1000
            ? `${(latestVolume / 1000).toFixed(1)}K`
            : latestVolume}
        </div>
        {trendPercent != null && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-gs-terminal',
              trend === 'down' && 'text-gs-critical',
              trend === 'flat' && 'text-gs-mid-light',
            )}
          >
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'flat' && <Minus className="w-3 h-3" />}
            {trendPercent > 0 ? '+' : ''}
            {trendPercent}%
          </div>
        )}
      </div>
      <div className="flex-1" style={{ height: 40, width: 120 }}>
        <ChartContainer height={40} minHeight={40}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis type="number" domain={['dataMin', 'dataMax']} hide />
            <Line
              type="monotone"
              dataKey="volume"
              stroke={OKLCH.black}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 3,
                fill: OKLCH.black,
                stroke: 'white',
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
