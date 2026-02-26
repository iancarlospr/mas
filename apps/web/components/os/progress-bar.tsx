'use client';

import { cn } from '@/lib/utils';

/* =================================================================
   Chloe's Bedroom OS — Progress Bar

   Modern gradient fill with dithered leading edge.
   Also a terminal-style variant using block characters.
   ================================================================= */

interface ProgressBarProps {
  value: number;
  variant?: 'default' | 'terminal' | 'ghost';
  showLabel?: boolean;
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
    sm: 'h-[6px]',
    md: 'h-[10px]',
    lg: 'h-[14px]',
  }[size];

  return (
    <div className={cn('flex items-center gap-gs-2', className)}>
      <div className={cn('flex-1 bg-gs-void/60 rounded-full overflow-hidden border border-gs-mid/30', sizeClass)}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedValue}%`,
            background: variant === 'ghost'
              ? 'linear-gradient(90deg, var(--gs-mid), var(--gs-base))'
              : 'linear-gradient(90deg, var(--gs-mid), var(--gs-base))',
          }}
        />
      </div>

      {showLabel && (
        <span className="font-data text-data-xs text-gs-mid min-w-[36px] text-right">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}

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
    '\u2588'.repeat(filledBlocks) + '\u2591'.repeat(emptyBlocks);

  return (
    <div className={cn('font-data text-data-sm', className)}>
      <span className="text-gs-terminal">[</span>
      <span className="text-gs-terminal">{bar}</span>
      <span className="text-gs-terminal">]</span>
      <span className="text-gs-mid ml-gs-2">{Math.round(value)}%</span>
    </div>
  );
}
