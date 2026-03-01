'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* =================================================================
   Chloe's Bedroom OS — Modern Input

   Rounded border with pink focus ring + backdrop blur.
   ================================================================= */

interface BevelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export const BevelInput = forwardRef<HTMLInputElement, BevelInputProps>(
  function BevelInput({ className, fullWidth, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'bg-gs-void/60 border border-gs-mid rounded-lg px-gs-3 py-gs-2',
          'font-data text-data-base text-white',
          'placeholder:text-gs-mid',
          'caret-white',
          'focus:outline-none focus:border-gs-base focus:ring-1 focus:ring-gs-base/30',
          'disabled:opacity-40 disabled:cursor-default',
          'min-h-[34px] transition-colors',
          'backdrop-blur-sm',
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      />
    );
  },
);
