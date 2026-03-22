'use client';

import { cn } from '@/lib/utils';

/* =================================================================
   Chloé's Bedroom OS — Dither Components

   Reusable CSS dither edge/overlay components.
   2px checkerboard pattern using repeating-conic-gradient.
   ================================================================= */

interface DitherEdgeProps {
  position: 'top' | 'bottom';
  className?: string;
}

/** Dither edge — a 4px tall checkerboard strip at top or bottom */
export function DitherEdge({ position, className }: DitherEdgeProps) {
  return (
    <div
      className={cn(
        'absolute left-0 right-0 h-1 pointer-events-none',
        position === 'top' ? 'top-0 -translate-y-full' : 'bottom-0 translate-y-full',
        className,
      )}
      style={{
        background: `repeating-conic-gradient(
          var(--gs-deep) 0% 25%,
          transparent 0% 50%
        ) 0 0 / 2px 2px`,
        opacity: 0.6,
      }}
      aria-hidden="true"
    />
  );
}

interface DitherOverlayProps {
  className?: string;
  opacity?: number;
}

/** Dither overlay — full area checkerboard for loading/skeleton states */
export function DitherOverlay({ className, opacity = 0.15 }: DitherOverlayProps) {
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        background: `repeating-conic-gradient(
          var(--gs-deep) 0% 25%,
          transparent 0% 50%
        ) 0 0 / 2px 2px`,
        opacity,
      }}
      aria-hidden="true"
    />
  );
}
