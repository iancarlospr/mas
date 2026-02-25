'use client';

import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Progress Bar

   Win95-style segmented progress bar with sunken track
   and Chloé gradient fill. Also a terminal-style variant
   using block characters.
   ═══════════════════════════════════════════════════════════════ */

interface ProgressBarProps {
  /** Progress value 0-100 */
  value: number;
  /** Visual variant */
  variant?: 'default' | 'terminal' | 'ghost';
  /** Show percentage label */
  showLabel?: boolean;
  /** Height */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  value,
  variant = 'default',
  showLabel = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  if (variant === 'terminal') {
    return <TerminalProgress value={clampedValue} className={className} />;
  }

  const sizeClass = {
    sm: 'h-[12px]',
    md: 'h-[18px]',
    lg: 'h-[24px]',
  }[size];

  return (
    <div className={cn('flex items-center gap-gs-2', className)}>
      <div className={cn('bevel-sunken flex-1 bg-gs-white relative', sizeClass)}>
        {/* Segmented fill blocks (Win95 style) */}
        <div
          className="absolute inset-[2px] flex gap-px overflow-hidden"
          style={{ width: `calc(${clampedValue}% - 4px)` }}
        >
          {Array.from({ length: Math.ceil(clampedValue / 3) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-shrink-0 w-[8px] h-full',
                variant === 'ghost'
                  ? 'bg-gs-cyan'
                  : 'bg-gs-mid-dark',
              )}
              style={
                variant === 'ghost'
                  ? { background: 'var(--gs-gradient)' }
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {showLabel && (
        <span className="font-data text-data-xs text-gs-mid-dark min-w-[36px] text-right">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}

/** Terminal-style progress using block characters */
function TerminalProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const totalBlocks = 30;
  const filledBlocks = Math.round((value / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  const bar =
    '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    <div className={cn('font-data text-data-sm', className)}>
      <span className="text-gs-terminal">[</span>
      <span className="text-gs-terminal">{bar}</span>
      <span className="text-gs-terminal">]</span>
      <span className="text-gs-mid-light ml-gs-2">{Math.round(value)}%</span>
    </div>
  );
}
