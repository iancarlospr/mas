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
  Label,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, CHART_PALETTE, RESOLVED_COLORS, QUADRANT_COLORS } from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface RemediationTask {
  task: string;
  impact: number;
  effort: number;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface RemediationScatterProps {
  data: RemediationTask[];
  height?: number;
  className?: string;
}

const PRIORITY_SIZE: Record<string, number> = {
  critical: 200,
  high: 140,
  medium: 80,
  low: 50,
};

const QUADRANT_LABELS = [
  { x: 2.5, y: 8, text: 'Quick Wins', color: QUADRANT_COLORS.quickWins },
  { x: 7.5, y: 8, text: 'Strategic', color: QUADRANT_COLORS.strategic },
  { x: 2.5, y: 2, text: 'Fill-Ins', color: QUADRANT_COLORS.lowPriority },
  { x: 7.5, y: 2, text: 'Deprioritize', color: QUADRANT_COLORS.avoid },
];

export function RemediationScatter({
  data,
  height = 360,
  className,
}: RemediationScatterProps) {
  // Assign colors by category
  const categories = [...new Set(data.map((d) => d.category))];
  const catColor = Object.fromEntries(
    categories.map((c, i) => [c, CHART_PALETTE[i % CHART_PALETTE.length]]),
  );

  const scatterData = data.map((d) => ({
    x: d.effort,
    y: d.impact,
    z: PRIORITY_SIZE[d.priority] ?? 80,
    name: d.task,
    category: d.category,
    priority: d.priority,
    fill: catColor[d.category],
  }));

  return (
    <div className={cn('w-full', className)}>
      <ChartContainer height={height}>
        <ScatterChart margin={CHART_MARGINS.withLegend}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 10]}
            {...AXIS_STYLE}
          >
            <Label
              value="Implementation Effort →"
              position="insideBottom"
              offset={-10}
              style={{ fontSize: 11, fill: RESOLVED_COLORS.muted, fontFamily: 'var(--font-data)' }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 10]}
            {...AXIS_STYLE}
          >
            <Label
              value="← Business Impact"
              angle={-90}
              position="insideLeft"
              offset={15}
              style={{ fontSize: 11, fill: RESOLVED_COLORS.muted, fontFamily: 'var(--font-data)' }}
            />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[50, 200]} />

          {/* Quadrant dividers */}
          <ReferenceLine x={5} stroke={RESOLVED_COLORS.chromeLight} strokeDasharray="6 3" />
          <ReferenceLine y={5} stroke={RESOLVED_COLORS.chromeLight} strokeDasharray="6 3" />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as (typeof scatterData)[0];
              return (
                <div className="bg-gs-ink text-white rounded-lg px-4 py-3 shadow-lg text-xs max-w-[240px]">
                  <div className="font-system font-bold text-sm mb-1">{d.name}</div>
                  <div className="text-gs-muted">
                    Impact: <span className="text-white font-mono">{d.y}/10</span>
                  </div>
                  <div className="text-gs-muted">
                    Effort: <span className="text-white font-mono">{d.x}/10</span>
                  </div>
                  <div className="text-gs-muted">
                    Priority:{' '}
                    <span
                      className={cn(
                        'font-mono',
                        d.priority === 'critical' && 'text-gs-critical',
                        d.priority === 'high' && 'text-gs-warning',
                        d.priority === 'medium' && 'text-gs-terminal',
                        d.priority === 'low' && 'text-gs-muted',
                      )}
                    >
                      {d.priority}
                    </span>
                  </div>
                  <div className="text-gs-muted">Category: <span className="text-white">{d.category}</span></div>
                </div>
              );
            }}
          />

          <Scatter data={scatterData} />
        </ScatterChart>
      </ChartContainer>

      {/* Quadrant legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-[10px]">
        {QUADRANT_LABELS.map((q) => (
          <div key={q.text} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: q.color }} />
            <span className="text-muted">{q.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
