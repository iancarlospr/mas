'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { AlphaTooltip } from './alpha-tooltip';
import { AXIS_STYLE, GRID_STYLE, CHART_MARGINS, LEGEND_CONFIG, RESOLVED_COLORS } from '@/lib/chart-config';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface ConsentState {
  state: 'before' | 'accept' | 'reject';
  cookies: number;
  requests: number;
  pixels: number;
}

interface ConsentTimelineProps {
  states: ConsentState[];
  compliant?: boolean;
  height?: number;
  className?: string;
}

const STATE_LABELS: Record<string, string> = {
  before: 'Before Consent',
  accept: 'After Accept',
  reject: 'After Reject',
};

export function ConsentTimeline({
  states,
  compliant,
  height = 280,
  className,
}: ConsentTimelineProps) {
  const chartData = states.map((s) => ({
    state: STATE_LABELS[s.state] ?? s.state,
    Cookies: s.cookies,
    Requests: s.requests,
    Pixels: s.pixels,
  }));

  // Calculate deltas for before→accept
  const before = states.find((s) => s.state === 'before');
  const accept = states.find((s) => s.state === 'accept');
  const reject = states.find((s) => s.state === 'reject');

  return (
    <div className={cn('w-full', className)}>
      {/* Compliance badge */}
      {compliant != null && (
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4',
            compliant
              ? 'bg-gs-terminal/10 text-gs-terminal'
              : 'bg-gs-critical/10 text-gs-critical',
          )}
        >
          {compliant ? (
            <Check className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          {compliant ? 'GDPR Compliant' : 'Violations Detected'}
        </div>
      )}

      {/* Delta summary row */}
      {before && accept && reject && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          {(['cookies', 'requests', 'pixels'] as const).map((key) => {
            const b = before[key];
            const a = accept[key];
            const r = reject[key];
            const deltaAccept = a - b;
            const deltaReject = r - b;
            return (
              <div key={key} className="text-xs">
                <div className="font-system font-semibold text-muted uppercase tracking-wide mb-1">
                  {key}
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="font-mono text-sm font-bold text-primary">{b}</span>
                  <ArrowRight className="w-3 h-3 text-muted" />
                  <span className="font-mono text-sm font-bold text-primary">{a}</span>
                  {deltaAccept !== 0 && (
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        deltaAccept > 0 ? 'text-gs-critical' : 'text-gs-terminal',
                      )}
                    >
                      ({deltaAccept > 0 ? '+' : ''}{deltaAccept})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grouped bar chart */}
      <ChartContainer height={height}>
        <BarChart data={chartData} margin={CHART_MARGINS.standard}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="state" {...AXIS_STYLE} />
          <YAxis {...AXIS_STYLE} allowDecimals={false} />
          <Tooltip content={<AlphaTooltip />} />
          <Legend {...LEGEND_CONFIG} />
          <Bar dataKey="Cookies" fill={RESOLVED_COLORS.warning} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Requests" fill={RESOLVED_COLORS.ink} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Pixels" fill={RESOLVED_COLORS.critical} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
