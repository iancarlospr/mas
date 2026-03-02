'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/os/progress-bar';
import {
  generateBootLines,
  generateSynthesisLines,
  generateCachedBootLines,
  moduleCompleteBootLine,
  type BootLine,
  type BootLineType,
} from '@/lib/scan-sequence-timing';

/**
 * GhostScan OS — Terminal Boot Text
 * ═══════════════════════════════════════
 *
 * WHAT: A scrolling terminal display that shows fake "boot" messages
 *       synced to real SSE scan progress events.
 * WHY:  Phase 1 of the Hollywood Hack loading sequence. Makes the scan
 *       feel like a sophisticated forensic operation, not a loading
 *       spinner (Plan Section 5 Phase 1).
 * HOW:  Pre-generated boot lines appear on a delay schedule. Real SSE
 *       module-complete events inject additional lines. Terminal scrolls
 *       to bottom automatically. CRT green text on black background.
 *
 * Visual: [OK] in green, [!!] in cyan (ghost), [>>] in yellow, [ERR] in red.
 * Font: JetBrains Mono (--font-data) at 13px.
 * Background: --gs-ink with terminal text glow.
 */

/* ── Line type → visual prefix + color ─────────────────────── */

const LINE_PREFIXES: Record<BootLineType, { prefix: string; colorClass: string }> = {
  ok:    { prefix: '[OK]', colorClass: 'text-gs-terminal' },
  info:  { prefix: '    ', colorClass: 'text-gs-muted' },
  ghost: { prefix: '[!!]', colorClass: 'text-gs-red' },
  scan:  { prefix: '[>>]', colorClass: 'text-gs-warning' },
  error: { prefix: '[ERR]', colorClass: 'text-gs-critical' },
};

interface TerminalBootProps {
  /** Target domain being scanned */
  domain: string;
  /** Current scan progress (0-100) */
  progress: number;
  /** Whether this is a cached scan (abbreviated boot) */
  isCached?: boolean;
  /** MarketingIQ score (available at end) */
  score?: number;
  /** Score label (available at end) */
  scoreLabel?: string;
  /** Module count (available at end) */
  moduleCount?: number;
  /** Variant: 'boot' for Phase 1, 'synthesis' for Phase 3 */
  variant?: 'boot' | 'synthesis';
  /** Externally triggered lines (from SSE module-complete events) */
  externalLines?: BootLine[];
  /** Additional CSS classes */
  className?: string;
}

export function TerminalBoot({
  domain,
  progress,
  isCached = false,
  score,
  scoreLabel,
  moduleCount,
  variant = 'boot',
  externalLines = [],
  className,
}: TerminalBootProps) {
  const [visibleLines, setVisibleLines] = useState<BootLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* ── Generate lines based on variant ─────────────────────── */
  const scheduledLines = useRef<BootLine[]>([]);

  useEffect(() => {
    /* Clear previous timers */
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setVisibleLines([]);

    /* Select line set */
    let lines: BootLine[];
    if (isCached && score != null) {
      lines = generateCachedBootLines(domain, score);
    } else if (variant === 'synthesis' && score != null && scoreLabel && moduleCount) {
      lines = generateSynthesisLines(moduleCount, score, scoreLabel);
    } else if (variant === 'synthesis') {
      /* Score not ready yet — show waiting state, not boot fallback */
      lines = [
        { type: 'scan', text: 'Cross-referencing market intelligence...', delayMs: 0 },
        { type: 'ghost', text: 'Chloé is analyzing the data...', delayMs: 1500 },
        { type: 'scan', text: 'Waiting for final results...', delayMs: 3000 },
      ];
    } else {
      lines = generateBootLines(domain);
    }

    scheduledLines.current = lines;

    /* Schedule each line to appear at its delay */
    lines.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, line]);
      }, line.delayMs);
      timersRef.current.push(timer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [domain, isCached, variant, score, scoreLabel, moduleCount]);

  /* ── Inject external SSE lines ───────────────────────────── */
  useEffect(() => {
    if (externalLines.length > 0) {
      setVisibleLines((prev) => [...prev, ...externalLines]);
    }
  }, [externalLines]);

  /* ── Auto-scroll to bottom ───────────────────────────────── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-gs-ink font-data text-data-sm',
        className,
      )}
    >
      {/* Terminal output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-gs-3 space-y-[2px]"
        style={{
          scrollBehavior: 'smooth',
        }}
      >
        {visibleLines.map((line, i) => {
          const config = LINE_PREFIXES[line.type];
          return (
            <div
              key={i}
              className={cn(
                'whitespace-pre font-data text-data-sm leading-relaxed',
                config.colorClass,
                /* Fade-in animation for new lines */
                'animate-window-open',
              )}
              style={{
                textShadow:
                  line.type === 'ghost'
                    ? '0 0 6px var(--gs-red)'
                    : line.type === 'error'
                      ? '0 0 6px var(--gs-critical)'
                      : '0 0 3px var(--gs-terminal)',
              }}
            >
              <span className="font-bold mr-gs-2">{config.prefix}</span>
              {line.text}
            </div>
          );
        })}

        {/* Blinking cursor at the end */}
        <div className="inline-block">
          <span className="text-gs-terminal animate-blink">▌</span>
        </div>
      </div>

      {/* Terminal progress bar at bottom */}
      <div className="p-gs-2 border-t border-gs-chrome-dark">
        <ProgressBar value={progress} variant="terminal" />
      </div>
    </div>
  );
}
