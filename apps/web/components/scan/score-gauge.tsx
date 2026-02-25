'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getMarketingIQLabel } from '@marketing-alpha/types';
import { getScoreTierColor } from '@/lib/chart-config';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  animate?: boolean;
  duration?: number;
  color?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; delta: number };
  className?: string;
}

const GAUGE_SIZES = {
  sm: { diameter: 120, strokeWidth: 8, fontSize: 28, labelSize: 10 },
  md: { diameter: 200, strokeWidth: 10, fontSize: 44, labelSize: 13 },
  lg: { diameter: 280, strokeWidth: 12, fontSize: 56, labelSize: 14 },
  xl: { diameter: 400, strokeWidth: 14, fontSize: 72, labelSize: 16 },
};

// 240° arc: from 150° to 390° (leaving 120° gap at bottom)
const START_ANGLE = 150;
const END_ANGLE = 390;
const ARC_DEGREES = END_ANGLE - START_ANGLE; // 240°

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function ScoreGauge({
  score,
  size = 'md',
  label,
  animate = true,
  duration = 2000,
  color,
  trend,
  className,
}: ScoreGaugeProps) {
  const s = GAUGE_SIZES[size];
  const r = (s.diameter - s.strokeWidth) / 2;
  const cx = s.diameter / 2;
  const cy = s.diameter / 2;
  const tierColor = color ?? getScoreTierColor(score);
  const mqLabel = label ?? 'MarketingIQ';
  const iqLabel = getMarketingIQLabel(score);

  // Background track: full 240° arc
  const bgArc = describeArc(cx, cy, r, START_ANGLE, END_ANGLE);

  // Calculate total arc length for dasharray
  const arcLengthFull = (ARC_DEGREES / 360) * 2 * Math.PI * r;

  // Animation refs
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  // Animated score count-up
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

  const spring = useSpring(0, { duration, bounce: 0 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    if (isInView) {
      spring.set(score);
    }
  }, [isInView, score, spring, animate]);

  useEffect(() => {
    const unsub = rounded.on('change', (v) => setDisplayScore(v));
    return unsub;
  }, [rounded]);

  // Progress arc fraction
  const progressFraction = animate && isInView ? score / 100 : animate ? 0 : score / 100;
  const progressEndAngle = START_ANGLE + ARC_DEGREES * (score / 100);
  const progressArc = score > 0 ? describeArc(cx, cy, r, START_ANGLE, progressEndAngle) : '';

  // Glow effect for high scores
  const showGlow = score >= 80;

  return (
    <div
      ref={ref}
      className={cn('inline-flex flex-col items-center', className)}
      role="img"
      aria-label={`MarketingIQ score: ${score} out of 100. ${iqLabel}.`}
    >
      <svg
        width={s.diameter}
        height={s.diameter}
        viewBox={`0 0 ${s.diameter} ${s.diameter}`}
      >
        {/* Glow filter for 80+ scores */}
        {showGlow && (
          <defs>
            <filter id={`glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}

        {/* Background track */}
        <path
          d={bgArc}
          fill="none"
          style={{ stroke: 'var(--gs-near-white)' }}
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        {progressArc && (
          <motion.path
            d={bgArc}
            fill="none"
            stroke={tierColor}
            strokeWidth={s.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLengthFull}
            initial={{ strokeDashoffset: arcLengthFull }}
            animate={
              isInView || !animate
                ? { strokeDashoffset: arcLengthFull * (1 - score / 100) }
                : { strokeDashoffset: arcLengthFull }
            }
            transition={
              animate
                ? { duration: 2, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }
                : { duration: 0 }
            }
            filter={showGlow ? `url(#glow-${size})` : undefined}
          />
        )}

        {/* Score text */}
        <text
          x={cx}
          y={cy - (trend ? 4 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: s.fontSize,
            fontWeight: 800,
            fill: tierColor,
          }}
        >
          {displayScore}
        </text>

        {/* Label below score */}
        <text
          x={cx}
          y={cy + s.fontSize / 2 + 6}
          textAnchor="middle"
          dominantBaseline="hanging"
          style={{
            fontFamily: 'var(--font-system), monospace',
            fontSize: s.labelSize,
            fontWeight: 600,
            fill: 'var(--gs-mid)',
          }}
        >
          {mqLabel}
        </text>
      </svg>

      {/* IQ Label below gauge */}
      <span
        className="font-system font-bold mt-1"
        style={{ fontSize: s.labelSize, color: tierColor }}
      >
        {iqLabel}
      </span>

      {/* Trend indicator */}
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <span
            style={{
              fontSize: s.labelSize - 2,
              color:
                trend.direction === 'up'
                  ? 'var(--gs-terminal)'
                  : trend.direction === 'down'
                    ? 'var(--gs-critical)'
                    : 'var(--gs-mid)',
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: s.labelSize - 2,
              color: 'var(--gs-mid)',
            }}
          >
            {trend.delta > 0 ? '+' : ''}
            {trend.delta}
          </span>
        </div>
      )}
    </div>
  );
}
