'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';
import { MatrixRain } from './matrix-rain';
import { TerminalBoot } from './terminal-boot';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { A22Animation } from '@/components/os/a22-animation';
import { MeanGirlsAnimation } from '@/components/os/meangirls-animation';
import { GhostAnimation } from '@/components/os/ghost-animation';
import { RickRollAnimation } from '@/components/os/rickroll-animation';
import { ProgressBar } from '@/components/os/progress-bar';
import {
  type AnimationPhase,
  type ScanStatus,
  type BootLine,
  PHASE_CONFIGS,
  scanStatusToAnimationPhase,
  moduleCompleteBootLine,
} from '@/lib/scan-sequence-timing';

/**
 * GhostScan OS — Scan Sequence (The Hollywood Hack)
 * ═══════════════════════════════════════════════════
 *
 * WHAT: Full-screen choreographed loading experience that plays during
 *       the 90-second scan. THE most important moment in the product.
 * WHY:  Transforms dead loading time into the most memorable, shareable
 *       moment. Users will screen-record this (Plan Section 5).
 * HOW:  4-phase sequence driven by a state machine:
 *       Phase 0: Black screen → Matrix rain → text → Chloé reveal
 *       Phase 1: Terminal boot (fake system messages + real SSE progress)
 *       Phase 2: ASCII movie (Rick Roll or Chloé animation)
 *       Phase 3: Synthesis reveal → desktop boot
 *
 * CSS-first animations following MSCHF's approach. Canvas only for
 * Matrix rain (procedural). Everything else is CSS keyframes + JS timing.
 */

interface ScanSequenceProps {
  /** Target domain being scanned */
  domain: string;
  /** Current scan status from SSE */
  scanStatus: ScanStatus;
  /** Scan progress 0-100 from SSE */
  progress: number;
  /** Module completion events from SSE: [moduleId, moduleName][] */
  completedModules: Array<{ id: string; name: string }>;
  /** Whether this is a cached scan (abbreviated sequence) */
  isCached?: boolean;
  /** Whether this is the user's first scan ever */
  isFirstScan?: boolean;
  /** Final MarketingIQ score (available when complete) */
  finalScore?: number;
  /** Final score label */
  finalScoreLabel?: string;
  /** Total module count */
  moduleCount?: number;
  /** Callback when sequence finishes and desktop should boot */
  onComplete: () => void;
  /** User's display name (for Matrix intro text) */
  userName?: string;
  /** Pause the sequence (freezes all phase timers) — used for auth gate */
  paused?: boolean;
}

/** Channel rotation for Phase 2 — same sequence as chill.mov TV */
const SCAN_CHANNELS = [
  { name: 'A22', Component: A22Animation, duration: 32 },
  { name: 'MEAN GIRLS', Component: MeanGirlsAnimation, duration: 55 },
  { name: 'CHLOE TV', Component: GhostAnimation, duration: 40 },
  { name: 'RICK FM', Component: RickRollAnimation, duration: 90 },
];

function ScanMovieRotation() {
  const [index, setIndex] = useState(0);
  const channel = SCAN_CHANNELS[index % SCAN_CHANNELS.length]!;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % SCAN_CHANNELS.length);
    }, channel.duration * 1000);
    return () => clearTimeout(timer);
  }, [index, channel.duration]);

  const { Component } = channel;
  return (
    <div className="h-full flex items-center justify-center">
      <Component key={`scan-movie-${index}`} />
    </div>
  );
}

/** Matrix intro text lines (Phase 0) — typed out one at a time */
const INTRO_LINES = [
  '> hello',
  '> knock knock...',
  '> follow the white ghost',
  '> initiating GhostScan™ protocol...',
];

export function ScanSequence({
  domain,
  scanStatus,
  progress,
  completedModules,
  isCached = false,
  isFirstScan = true,
  finalScore,
  finalScoreLabel,
  moduleCount,
  onComplete,
  userName = 'operative',
  paused = false,
}: ScanSequenceProps) {
  /* ── State ───────────────────────────────────────────────── */
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>(0);
  const [introLineIndex, setIntroLineIndex] = useState(0);
  const [showChloe, setShowChloe] = useState(false);
  const [showMatrixRain, setShowMatrixRain] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [sseBootLines, setSseBootLines] = useState<BootLine[]>([]);
  const phaseStartRef = useRef(Date.now());
  const processedModulesRef = useRef(new Set<string>());

  /* ── Phase 0: Matrix Intro ───────────────────────────────── */
  useEffect(() => {
    if (currentPhase !== 0 || paused) return;

    /* Abbreviated sequence for cached scans */
    if (isCached) {
      setCurrentPhase(1);
      return;
    }

    /* Show Matrix rain immediately */
    setShowMatrixRain(true);

    /* Type out intro lines one at a time */
    const lineTimers: ReturnType<typeof setTimeout>[] = [];
    INTRO_LINES.forEach((_, i) => {
      lineTimers.push(
        setTimeout(() => setIntroLineIndex(i + 1), 800 + i * 600),
      );
    });

    /* Show Chloé silhouette after intro text */
    const chloeTimer = setTimeout(() => setShowChloe(true), 2400);

    /* Advance to Phase 1 */
    const advanceTimer = setTimeout(() => {
      setShowMatrixRain(false);
      setCurrentPhase(1);
      phaseStartRef.current = Date.now();
    }, PHASE_CONFIGS[0].minDurationMs);

    return () => {
      lineTimers.forEach(clearTimeout);
      clearTimeout(chloeTimer);
      clearTimeout(advanceTimer);
    };
  }, [currentPhase, isCached, paused]);

  /* ── Phase transitions based on time + SSE status ────────── */
  useEffect(() => {
    if (paused) return;
    if (currentPhase === 'complete' || currentPhase === 'skipped') return;
    if (typeof currentPhase !== 'number') return;

    const ssePhase = scanStatusToAnimationPhase(scanStatus);

    /* Scan complete → skip everything, open the report */
    if (ssePhase === 'complete') {
      soundEffects.play('boot');
      setCurrentPhase('complete');
      onComplete();
      return;
    }

    /* Advance through Phase 0 → 1 → 2 based on time + SSE */
    const phaseConfig = PHASE_CONFIGS[currentPhase];
    if (!phaseConfig) return;

    const elapsed = Date.now() - phaseStartRef.current;
    const sseWantsHigherPhase = typeof ssePhase === 'number' && ssePhase > currentPhase;

    /* Advance if min duration passed AND SSE suggests higher phase */
    if (elapsed >= phaseConfig.minDurationMs && sseWantsHigherPhase) {
      const nextPhase = Math.min(currentPhase + 1, 2) as 0 | 1 | 2;
      setCurrentPhase(nextPhase);
      phaseStartRef.current = Date.now();
    }

    /* Force-advance if max duration exceeded (cap at Phase 2 — movie loops until done) */
    if (elapsed >= phaseConfig.maxDurationMs && currentPhase < 2) {
      const nextPhase = (currentPhase + 1) as 0 | 1 | 2;
      setCurrentPhase(nextPhase);
      phaseStartRef.current = Date.now();
    }
  }, [currentPhase, scanStatus, onComplete]);

  /* ── Inject SSE module completions as boot lines ─────────── */
  useEffect(() => {
    const newLines: BootLine[] = [];
    for (const mod of completedModules) {
      if (!processedModulesRef.current.has(mod.id)) {
        processedModulesRef.current.add(mod.id);
        newLines.push(moduleCompleteBootLine(mod.id, mod.name));
      }
    }
    if (newLines.length > 0) {
      setSseBootLines((prev) => [...prev, ...newLines]);
    }
  }, [completedModules]);

  /* ── Skip handler ────────────────────────────────────────── */
  const handleSkip = useCallback(() => {
    if (scanStatus === 'complete' || scanStatus === 'failed') {
      setIsSkipping(true);
      setCurrentPhase('skipped');
      onComplete();
    }
  }, [scanStatus, onComplete]);

  /* ── ASCII movie selection ───────────────────────────────── */

  /* ── Don't render if sequence is done ────────────────────── */
  if (currentPhase === 'complete' || currentPhase === 'skipped') {
    return null;
  }

  /* ── Render ──────────────────────────────────────────────── */
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-gs-ink overflow-hidden">
      {/* ── Phase 0: Matrix Intro ────────────────────────── */}
      {currentPhase === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Matrix rain background */}
          {showMatrixRain && (
            <div className="absolute inset-0">
              <MatrixRain fontSize={16} fadeOpacity={0.03} speed={0.3} />
            </div>
          )}

          {/* Intro text overlay */}
          <div className="relative z-10 text-center space-y-gs-2">
            {INTRO_LINES.slice(0, introLineIndex).map((line, i) => (
              <div
                key={i}
                className="font-data text-data-lg text-gs-terminal terminal-glow animate-window-open"
              >
                {line.replace('{userName}', userName)}
              </div>
            ))}

            {/* Chloé reveal */}
            {showChloe && (
              <div className="mt-gs-8 animate-window-open">
                <ChloeSprite state="scanning" size={128} glowing />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 1: Terminal Boot ───────────────────────── */}
      {currentPhase === 1 && (
        <div className="absolute inset-0">
          <TerminalBoot
            domain={domain}
            progress={progress}
            isCached={isCached}
            score={finalScore}
            variant="boot"
            className="h-full"
          />
        </div>
      )}

      {/* ── Phase 2: ASCII Movie ─────────────────────────── */}
      {currentPhase === 2 && (
        <div className="absolute inset-0 bg-[#0A0A0A] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ScanMovieRotation />
          </div>
          {/* Progress bar at bottom */}
          <div className="flex-shrink-0 p-gs-2 border-t border-gs-chrome-dark">
            <ProgressBar value={progress} variant="terminal" />
          </div>
        </div>
      )}

      {/* Phase 3 removed — movie plays until scan completes, then report opens */}

      {/* ── Skip Button (always visible, bottom-right) ───── */}
      {(scanStatus === 'complete' || scanStatus === 'failed') && !isSkipping && (
        <button
          className="fixed bottom-gs-4 right-gs-4 z-[1001] bevel-button font-system text-os-sm
                     text-gs-muted hover:text-gs-paper"
          onClick={handleSkip}
        >
          Skip →
        </button>
      )}

      {/* ── Persistent progress indicator (top) ──────────── */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-[1001]">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: 'var(--gs-red)',
          }}
        />
      </div>

    </div>,
    document.body,
  );
}
