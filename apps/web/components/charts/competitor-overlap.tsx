'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, CHART_PALETTE, RESOLVED_COLORS } from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface CompetitorData {
  competitor: string;
  sharedKeywords: number;
  uniqueKeywords: number;
  overlapPercentage: number;
}

interface CompetitorOverlapProps {
  data: CompetitorData[];
  height?: number;
  className?: string;
}

export function CompetitorOverlap({
  data,
  height = 300,
  className,
}: CompetitorOverlapProps) {
  const scatterData = data.map((d, i) => ({
    x: d.uniqueKeywords,
    y: d.sharedKeywords,
    z: d.overlapPercentage,
    name: d.competitor,
    fill: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  return (
    <div className={cn('w-full', className)}>
      <ChartContainer height={height}>
        <ScatterChart margin={CHART_MARGINS.standard}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            type="number"
            dataKey="x"
            name="Competitor Unique Keywords"
            {...AXIS_STYLE}
            label={{
              value: 'Competitor Unique Keywords',
              position: 'insideBottom',
              offset: -5,
              fontSize: 11,
              fill: RESOLVED_COLORS.muted,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Shared Keywords"
            {...AXIS_STYLE}
            label={{
              value: 'Shared Keywords',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fontSize: 11,
              fill: RESOLVED_COLORS.muted,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[80, 400]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as (typeof scatterData)[0];
              return (
                <div className="bg-gs-ink text-white rounded-lg px-4 py-3 shadow-lg text-xs">
                  <div className="font-system font-bold text-sm mb-1">{d.name}</div>
                  <div className="text-gs-muted">
                    Shared: <span className="text-white font-mono">{d.y}</span>
                  </div>
                  <div className="text-gs-muted">
                    Their Unique: <span className="text-white font-mono">{d.x}</span>
                  </div>
                  <div className="text-gs-muted">
                    Overlap: <span className="text-white font-mono">{d.z}%</span>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={scatterData} />
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}
