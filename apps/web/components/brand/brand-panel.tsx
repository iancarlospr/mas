'use client';

import { cn } from '@/lib/utils';
import { DitherEdge } from '@/components/os/dither';

/* =================================================================
   Brand Panel — Frosted glass exhibit panel with window chrome

   Reusable container for brand book sections. Mimics the managed
   window aesthetic: pink titlebar, traffic light dots, frosted glass
   body, dither edge, grain overlay. No interactivity (decorative).
   ================================================================= */

interface BrandPanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Extra classes on the content area */
  contentClassName?: string;
  /** Show dither edge at top of panel */
  dither?: boolean;
  /** Variant controls the title bar style */
  variant?: 'default' | 'terminal';
}

export function BrandPanel({
  title,
  children,
  className,
  contentClassName,
  dither = true,
  variant = 'default',
}: BrandPanelProps) {
  const isTerminal = variant === 'terminal';

  return (
    <div
      className={cn(
        'relative rounded-gs-lg overflow-hidden',
        'border border-gs-mid/30',
        'shadow-window',
        className,
      )}
      style={{
        background: 'oklch(0.14 0.02 340 / 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
        aria-hidden="true"
      />

      {/* Titlebar */}
      <div
        className="relative flex items-center gap-2 px-3 select-none"
        style={{
          height: 32,
          background: isTerminal ? '#0A0A0A' : 'var(--gs-base)',
          borderBottom: `1px solid ${isTerminal ? 'var(--gs-mid)' : 'oklch(0.72 0.17 340 / 0.3)'}`,
        }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-[6px]">
          <div className="w-[10px] h-[10px] rounded-full" style={{ background: '#FF5F57' }} />
          <div className="w-[10px] h-[10px] rounded-full" style={{ background: '#FEBC2E' }} />
          <div className="w-[10px] h-[10px] rounded-full" style={{ background: '#28C840' }} />
        </div>

        {/* Title */}
        <span
          className="font-data flex-1 text-center truncate"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: isTerminal ? 'var(--gs-terminal)' : 'var(--gs-void)',
          }}
        >
          {title}
        </span>

        {/* Spacer for centering */}
        <div className="w-[54px]" />
      </div>

      {/* Dither edge below titlebar */}
      {dither && (
        <div className="relative h-0">
          <DitherEdge position="bottom" />
        </div>
      )}

      {/* Content */}
      <div className={cn('relative', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
