'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Chloé Speech Bubble
 * ═══════════════════════════════════════
 *
 * WHAT: A retro pixel-style speech bubble that appears above/beside Chloé.
 * WHY:  Chloé communicates with personality — never generic system messages.
 *       The speech bubble is how she delivers her "High-Fashion Cuntiness"
 *       tone directly to the user (Plan Section 4, Target Audience).
 * HOW:  CSS-only bubble with bevel border, personality font (Permanent Marker),
 *       and a pixel-art tail pointing toward Chloé. Auto-dismisses after
 *       a configurable duration. Three visual variants: normal, alert, ghost.
 *
 * Typography: Uses --font-personality (Permanent Marker) per Plan Section 2.
 * Colors: Body uses --gs-white, border uses --gs-mid, variants use accent colors.
 */

export type SpeechVariant = 'normal' | 'alert' | 'ghost';

export interface ChloeSpeechProps {
  /** The message Chloé is saying */
  message: string;
  /** Visual variant — affects border/accent color */
  variant?: SpeechVariant;
  /** Auto-dismiss after this many ms (0 = never dismiss) */
  autoDismissMs?: number;
  /** Position of the tail/pointer */
  tailPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Whether the bubble is currently visible */
  visible?: boolean;
  /** Callback when bubble is dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/** Variant-specific border colors */
const VARIANT_STYLES: Record<SpeechVariant, { border: string; glow: string }> = {
  normal: {
    border: 'var(--gs-mid)',
    glow: 'none',
  },
  alert: {
    border: 'var(--gs-critical)',
    glow: '0 0 8px oklch(0.55 0.15 25 / 0.3)',
  },
  ghost: {
    border: 'var(--gs-cyan)',
    glow: '0 0 12px oklch(0.82 0.12 192 / 0.2)',
  },
};

export function ChloeSpeech({
  message,
  variant = 'normal',
  autoDismissMs = 5000,
  tailPosition = 'bottom-left',
  visible = true,
  onDismiss,
  className,
}: ChloeSpeechProps) {
  const [isShowing, setIsShowing] = useState(visible);

  /* Auto-dismiss timer */
  useEffect(() => {
    setIsShowing(visible);

    if (!visible || autoDismissMs <= 0) return;

    const timer = setTimeout(() => {
      setIsShowing(false);
      onDismiss?.();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, onDismiss]);

  if (!isShowing) return null;

  const style = VARIANT_STYLES[variant];

  /* Tail position CSS */
  const tailIsBottom = tailPosition.startsWith('bottom');
  const tailIsLeft = tailPosition.endsWith('left');

  return (
    <div
      className={cn(
        'relative inline-block max-w-[240px]',
        /* Entry animation */
        'animate-window-open',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/* Bubble body */}
      <div
        className="relative px-gs-3 py-gs-2 font-personality text-chloe leading-snug"
        style={{
          background: 'var(--gs-white)',
          border: `2px solid ${style.border}`,
          boxShadow: `
            inset 1px 1px 0 var(--gs-white),
            inset -1px -1px 0 var(--gs-near-white),
            2px 2px 0 var(--gs-mid),
            ${style.glow}
          `,
          color: 'var(--gs-black)',
          imageRendering: 'pixelated',
        }}
      >
        {message}
      </div>

      {/* Pixel-art speech tail (8x8 triangle made of two stacked rectangles) */}
      <div
        className="absolute"
        style={{
          [tailIsBottom ? 'bottom' : 'top']: '-8px',
          [tailIsLeft ? 'left' : 'right']: '16px',
          width: 0,
          height: 0,
          /* CSS triangle via borders */
          ...(tailIsBottom
            ? {
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `8px solid ${style.border}`,
              }
            : {
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: `8px solid ${style.border}`,
              }),
        }}
      />
      {/* Inner tail (white fill, 1px inset) */}
      <div
        className="absolute"
        style={{
          [tailIsBottom ? 'bottom' : 'top']: '-6px',
          [tailIsLeft ? 'left' : 'right']: '18px',
          width: 0,
          height: 0,
          ...(tailIsBottom
            ? {
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '6px solid var(--gs-white)',
              }
            : {
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderBottom: '6px solid var(--gs-white)',
              }),
        }}
      />
    </div>
  );
}

/**
 * Convenience wrapper: Shows a speech bubble that types out letter by letter.
 * Used for dramatic moments (scan complete, critical finding).
 */
export function ChloeTypingBubble({
  message,
  typingSpeedMs = 30,
  ...props
}: ChloeSpeechProps & { typingSpeedMs?: number }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!props.visible) {
      setDisplayed('');
      return;
    }

    let i = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      i++;
      if (i <= message.length) {
        setDisplayed(message.slice(0, i));
      } else {
        clearInterval(interval);
      }
    }, typingSpeedMs);

    return () => clearInterval(interval);
  }, [message, typingSpeedMs, props.visible]);

  return (
    <ChloeSpeech
      {...props}
      message={displayed + (displayed.length < message.length ? '▌' : '')}
    />
  );
}
