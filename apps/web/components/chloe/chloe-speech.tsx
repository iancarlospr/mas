'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chloe's Bedroom OS — Chloe Speech Bubble
 * ==========================================
 *
 * Frosted glass speech bubble with pink accent border.
 * Personality font (Permanent Marker) for the message.
 */

export type SpeechVariant = 'normal' | 'alert' | 'ghost';

export interface ChloeSpeechProps {
  message: string;
  variant?: SpeechVariant;
  autoDismissMs?: number;
  tailPosition?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  visible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<SpeechVariant, { border: string; glow: string }> = {
  normal: {
    border: 'var(--gs-mid)',
    glow: 'none',
  },
  alert: {
    border: 'var(--gs-critical)',
    glow: '0 0 12px oklch(0.55 0.15 25 / 0.3)',
  },
  ghost: {
    border: 'var(--gs-base)',
    glow: '0 0 16px oklch(0.82 0.15 340 / 0.2)',
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

  const tailIsBottom = tailPosition.startsWith('bottom');
  const tailIsLeft = tailPosition.endsWith('left');

  return (
    <div
      className={cn(
        'relative inline-block max-w-[240px]',
        'animate-window-open',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {/* Bubble body — frosted glass */}
      <div
        className="relative px-gs-3 py-gs-2 font-personality text-chloe leading-snug rounded-lg backdrop-blur-md"
        style={{
          background: 'oklch(0.20 0.06 340 / 0.85)',
          border: `1px solid ${style.border}`,
          boxShadow: `
            0 4px 16px oklch(0.10 0.05 340 / 0.4),
            ${style.glow}
          `,
          color: 'var(--gs-light)',
        }}
      >
        {message}
      </div>

      {/* Speech tail */}
      <div
        className="absolute"
        style={{
          [tailIsBottom ? 'bottom' : 'top']: '-8px',
          [tailIsLeft ? 'left' : 'right']: '16px',
          width: 0,
          height: 0,
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
      {/* Inner tail (dark fill) */}
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
                borderTop: '6px solid oklch(0.20 0.06 340 / 0.85)',
              }
            : {
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderBottom: '6px solid oklch(0.20 0.06 340 / 0.85)',
              }),
        }}
      />
    </div>
  );
}

/**
 * Typing bubble — types out letter by letter.
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
      message={displayed + (displayed.length < message.length ? '\u258C' : '')}
    />
  );
}
