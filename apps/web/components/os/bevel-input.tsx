'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Bevel Input

   Win95-style sunken text input with monospace font
   and blinking cursor aesthetic.
   ═══════════════════════════════════════════════════════════════ */

interface BevelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Use full width */
  fullWidth?: boolean;
}

export const BevelInput = forwardRef<HTMLInputElement, BevelInputProps>(
  function BevelInput({ className, fullWidth, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'bevel-sunken bg-gs-white px-gs-2 py-gs-1',
          'font-data text-data-base text-gs-black',
          'placeholder:text-gs-mid-light',
          'focus:outline-none',
          'disabled:bg-gs-light disabled:text-gs-mid disabled:cursor-default',
          'min-h-[24px]',
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      />
    );
  },
);
