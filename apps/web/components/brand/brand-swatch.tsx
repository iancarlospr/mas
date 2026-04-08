'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* =================================================================
   Brand Swatch — Interactive color swatch with copy-to-clipboard
   ================================================================= */

interface BrandSwatchProps {
  name: string;
  cssVar: string;
  oklch?: string;
  hex: string;
  /** Whether this is a dark color (use light text) */
  dark?: boolean;
  /** Functional color — renders smaller */
  functional?: boolean;
  className?: string;
}

export function BrandSwatch({
  name,
  cssVar,
  oklch,
  hex,
  dark = true,
  functional = false,
  className,
}: BrandSwatchProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cssVar);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may not be available
    }
  }, [cssVar]);

  const textColor = dark ? 'var(--gs-light)' : 'var(--gs-void)';
  const mutedColor = dark ? 'rgba(255,240,250,0.5)' : 'rgba(8,8,8,0.5)';

  return (
    <motion.button
      onClick={handleCopy}
      className={cn(
        'relative group text-left rounded-gs overflow-hidden border border-gs-mid/20',
        'transition-shadow duration-300',
        functional ? 'p-3' : 'p-4',
        className,
      )}
      style={{ background: hex }}
      whileHover={{
        scale: 1.03,
        boxShadow: `0 0 24px ${hex}44, 0 0 48px ${hex}22`,
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Copy toast */}
      {copied && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute top-2 right-2 font-data px-2 py-0.5 rounded-full"
          style={{
            fontSize: 10,
            background: 'var(--gs-void)',
            color: 'var(--gs-base)',
            border: '1px solid var(--gs-base)',
          }}
        >
          Copied
        </motion.div>
      )}

      {/* Token name */}
      <div
        className="font-data font-bold"
        style={{ fontSize: functional ? 11 : 13, color: textColor }}
      >
        {name}
      </div>

      {/* CSS variable */}
      <div
        className="font-data mt-1"
        style={{ fontSize: 10, color: mutedColor, letterSpacing: '0.02em' }}
      >
        {cssVar}
      </div>

      {/* OKLCH value */}
      {oklch && (
        <div
          className="font-data mt-0.5"
          style={{ fontSize: 10, color: mutedColor }}
        >
          {oklch}
        </div>
      )}

      {/* Hex value */}
      <div
        className="font-data mt-0.5 uppercase"
        style={{ fontSize: 10, color: mutedColor }}
      >
        {hex}
      </div>

      {/* Click hint */}
      <div
        className="font-data mt-2 opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ fontSize: 9, color: textColor }}
      >
        Click to copy
      </div>
    </motion.button>
  );
}
