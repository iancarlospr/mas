'use client';

import { cn } from '@/lib/utils';
import { TRAFFIC_LIGHT_COLORS } from '@/lib/chart-config';

interface TrafficLightProps {
  status: 'green' | 'amber' | 'red';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  dotOnly?: boolean;
  pulse?: boolean;
  showIcon?: boolean;
  className?: string;
}

// Backwards-compatible alias for existing consumers using `light` prop
type LegacyTrafficLightProps = {
  light: 'green' | 'yellow' | 'red';
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dotOnly?: boolean;
  pulse?: boolean;
  showIcon?: boolean;
  className?: string;
};

const TL_SIZES = {
  xs: { dot: 8, font: 10, iconSize: 6 },
  sm: { dot: 12, font: 12, iconSize: 8 },
  md: { dot: 16, font: 14, iconSize: 10 },
  lg: { dot: 24, font: 16, iconSize: 14 },
};

const STATUS_MAP: Record<string, string> = {
  green: 'Healthy',
  amber: 'Needs Attention',
  red: 'Critical',
  yellow: 'Needs Attention',
};

function normalizeStatus(s: string): 'green' | 'amber' | 'red' {
  if (s === 'yellow') return 'amber';
  return s as 'green' | 'amber' | 'red';
}

export function TrafficLight(props: TrafficLightProps | LegacyTrafficLightProps) {
  const rawStatus = 'status' in props ? props.status : props.light;
  const status = normalizeStatus(rawStatus);
  const { label, dotOnly = false, pulse = false, showIcon = false, size = 'md', className } = props;
  const s = TL_SIZES[size];
  const color = TRAFFIC_LIGHT_COLORS[status];

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'relative inline-flex items-center justify-center rounded-full flex-shrink-0',
          pulse && 'animate-pulse',
        )}
        style={{
          width: s.dot,
          height: s.dot,
          backgroundColor: color,
          boxShadow: `inset 0 1px 2px rgba(255,255,255,0.3)`,
        }}
      >
        {/* Accessibility icon overlay */}
        {showIcon && (
          <svg
            width={s.iconSize}
            height={s.iconSize}
            viewBox="0 0 12 12"
            fill="none"
            className="traffic-light-icon"
          >
            {status === 'green' && (
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {status === 'amber' && (
              <line x1="3" y1="6" x2="9" y2="6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            )}
            {status === 'red' && (
              <>
                <line x1="3" y1="3" x2="9" y2="9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="3" x2="3" y2="9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        )}
      </span>
      {!dotOnly && label !== undefined && (
        <span
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: s.font,
            fontWeight: 500,
            color: '#1A1A2E',
          }}
        >
          {label ?? STATUS_MAP[status]}
        </span>
      )}
    </div>
  );
}
