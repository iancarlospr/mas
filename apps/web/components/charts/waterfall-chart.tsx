'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RESOURCE_COLORS, RESOLVED_COLORS } from '@/lib/chart-config';

interface WaterfallEntry {
  label: string;
  type: string;
  domain: string;
  startTime: number;
  duration: number;
  size: number;
  timing?: {
    dns: number;
    connect: number;
    ssl: number;
    ttfb: number;
    download: number;
  };
}

interface WaterfallChartProps {
  data: WaterfallEntry[];
  maxEntries?: number;
  showTimingBreakdown?: boolean;
  milestones?: Array<{ label: string; time: number; color: string }>;
  rowHeight?: number;
  interactive?: boolean;
  className?: string;
}

const TIMING_COLORS: Record<string, string> = {
  dns: RESOLVED_COLORS.chrome,
  connect: RESOLVED_COLORS.warning,
  ssl: RESOLVED_COLORS.red,
  ttfb: RESOLVED_COLORS.ink,
  download: RESOLVED_COLORS.terminal,
};

const LABEL_COL = 200;
const RIGHT_PAD = 60;

export function WaterfallChart({
  data,
  maxEntries = 50,
  showTimingBreakdown = false,
  milestones = [],
  rowHeight = 24,
  interactive = false,
  className,
}: WaterfallChartProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showCount, setShowCount] = useState(maxEntries);

  const entries = data.slice(0, showCount);
  const hasMore = data.length > showCount;

  const maxTime = useMemo(() => {
    let t = 0;
    for (const e of data) {
      t = Math.max(t, e.startTime + e.duration);
    }
    for (const m of milestones) {
      t = Math.max(t, m.time);
    }
    return t || 1;
  }, [data, milestones]);

  const gap = 4;
  const chartHeight = entries.length * (rowHeight + gap) + 40;
  const timeAxisY = entries.length * (rowHeight + gap) + 8;

  // Grid lines every ~100ms
  const gridInterval = maxTime > 5000 ? 1000 : maxTime > 1000 ? 500 : 100;
  const gridLines: number[] = [];
  for (let t = gridInterval; t <= maxTime; t += gridInterval) {
    gridLines.push(t);
  }

  function timeToX(ms: number): number {
    return LABEL_COL + (ms / maxTime) * (100 - ((LABEL_COL + RIGHT_PAD) / 10));
  }

  // Use percentage-based positioning
  function timeToPct(ms: number): number {
    const usableWidth = 100 - 5; // 5% right padding
    const labelPct = 25; // ~25% for labels
    return labelPct + (ms / maxTime) * (usableWidth - labelPct);
  }

  function durationToPct(ms: number): number {
    const usableWidth = 100 - 5;
    const labelPct = 25;
    return (ms / maxTime) * (usableWidth - labelPct);
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        width="100%"
        viewBox={`0 0 1000 ${chartHeight}`}
        role="img"
        aria-label={`Performance waterfall chart showing ${entries.length} resources over ${Math.round(maxTime)}ms`}
      >
        {/* Grid lines */}
        {gridLines.map((t) => {
          const x = 250 + (t / maxTime) * 700;
          return (
            <g key={`grid-${t}`}>
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={timeAxisY}
                stroke={RESOLVED_COLORS.chromeLight}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={x}
                y={timeAxisY + 16}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--font-data)"
                fill={RESOLVED_COLORS.chrome}
              >
                {t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`}
              </text>
            </g>
          );
        })}

        {/* Milestone lines */}
        {milestones.map((m, i) => {
          const x = 250 + (m.time / maxTime) * 700;
          return (
            <g key={`milestone-${i}`}>
              <motion.line
                x1={x}
                y1={0}
                x2={x}
                y2={timeAxisY}
                stroke={m.color}
                strokeWidth={2}
                strokeDasharray="6 3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              />
              <text
                x={x}
                y={-4}
                textAnchor="middle"
                fontSize={9}
                fontFamily="var(--font-data)"
                fontWeight={500}
                fill={m.color}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Rows */}
        {entries.map((entry, i) => {
          const y = i * (rowHeight + gap);
          const barStart = 250 + (entry.startTime / maxTime) * 700;
          const barWidth = Math.max(2, (entry.duration / maxTime) * 700);
          const typeKey = (entry.type ?? 'other').toLowerCase() as keyof typeof RESOURCE_COLORS;
          const barColor =
            RESOURCE_COLORS[typeKey] ?? RESOLVED_COLORS.chrome;
          const isHovered = hoveredRow === i;

          return (
            <motion.g
              key={`row-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              onMouseEnter={() => interactive && setHoveredRow(i)}
              onMouseLeave={() => interactive && setHoveredRow(null)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              {/* Row background on hover */}
              {isHovered && (
                <rect
                  x={0}
                  y={y - 2}
                  width={1000}
                  height={rowHeight + 4}
                  fill={RESOLVED_COLORS.paper}
                  rx={4}
                />
              )}

              {/* Label */}
              <text
                x={8}
                y={y + rowHeight / 2 + 4}
                fontSize={11}
                fontFamily="var(--font-data)"
                fill={isHovered ? RESOLVED_COLORS.ink : RESOLVED_COLORS.muted}
              >
                {entry.label.length > 35
                  ? entry.label.slice(0, 35) + '...'
                  : entry.label}
              </text>

              {/* Bar */}
              {showTimingBreakdown && entry.timing ? (
                <g>
                  {renderTimingSegments(entry.timing, barStart, y, rowHeight, barWidth, maxTime)}
                </g>
              ) : (
                <motion.rect
                  x={barStart}
                  y={y}
                  width={barWidth}
                  height={rowHeight}
                  rx={3}
                  fill={barColor}
                  initial={{ width: 0 }}
                  animate={{ width: barWidth }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                />
              )}

              {/* Duration label */}
              <text
                x={barStart + barWidth + 6}
                y={y + rowHeight / 2 + 4}
                fontSize={10}
                fontFamily="var(--font-data)"
                fill={RESOLVED_COLORS.muted}
              >
                {entry.duration >= 1000
                  ? `${(entry.duration / 1000).toFixed(2)}s`
                  : `${Math.round(entry.duration)}ms`}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* Show More button */}
      {hasMore && (
        <button
          onClick={() => setShowCount((c) => Math.min(c + 20, data.length))}
          className="mt-2 text-xs text-gs-red hover:underline"
        >
          Show {Math.min(20, data.length - showCount)} more resources ({data.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}

function renderTimingSegments(
  timing: NonNullable<WaterfallEntry['timing']>,
  startX: number,
  y: number,
  h: number,
  totalWidth: number,
  _maxTime: number,
) {
  const total = timing.dns + timing.connect + timing.ssl + timing.ttfb + timing.download;
  if (total === 0) return null;

  const phases = [
    { key: 'dns', value: timing.dns },
    { key: 'connect', value: timing.connect },
    { key: 'ssl', value: timing.ssl },
    { key: 'ttfb', value: timing.ttfb },
    { key: 'download', value: timing.download },
  ];

  let currentX = startX;
  return phases.map((phase) => {
    const w = (phase.value / total) * totalWidth;
    const x = currentX;
    currentX += w;
    if (w < 0.5) return null;
    return (
      <rect
        key={phase.key}
        x={x}
        y={y}
        width={w}
        height={h}
        fill={TIMING_COLORS[phase.key]}
        rx={phase.key === 'dns' ? 3 : 0}
      />
    );
  });
}
