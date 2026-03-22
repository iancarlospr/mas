'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* =================================================================
   Chloé's Bedroom OS — Modern Input

   Rounded border with pink focus ring + backdrop blur.
   ================================================================= */

interface BevelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export const BevelInput = forwardRef<HTMLInputElement, BevelInputProps>(
  function BevelInput({ className, fullWidth, style, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'bg-gs-light/90 border border-gs-mid rounded-lg px-gs-3 py-gs-2',
          'font-data',
          'placeholder:text-gs-mid',
          'select-text',
          'focus:outline-none focus:border-gs-base focus:ring-1 focus:ring-gs-base/30',
          'disabled:opacity-40 disabled:cursor-default',
          'min-h-[34px] transition-colors',
          fullWidth && 'w-full',
          className,
        )}
        style={{ color: 'var(--gs-void)', caretColor: 'currentColor', ...style }}
        {...props}
      />
    );
  },
);
