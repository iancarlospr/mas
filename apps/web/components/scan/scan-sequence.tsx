'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';
import { MatrixRain } from './matrix-rain';
import { AsciiPlayer } from './ascii-player';
import { TerminalBoot } from './terminal-boot';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { ChloeTypingBubble } from '@/components/chloe/chloe-speech';
import {
  type AnimationPhase,
  type ScanStatus,
  type BootLine,
  PHASE_CONFIGS,
  scanStatusToAnimationPhase,
  selectAsciiMovie,
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
}

/** Matrix intro text lines (Phase 0) — typed out one at a time */
const INTRO_LINES = [
  '> hello, {userName}',
  '> knock knock...',
  '> follow the white rabbit',
  '> initiating GhostScan protocol...',
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
    if (currentPhase !== 0) return;

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
  }, [currentPhase, isCached]);

  /* ── Phase transitions based on time + SSE status ────────── */
  useEffect(() => {
    if (currentPhase === 'complete' || currentPhase === 'skipped') return;
    if (typeof currentPhase !== 'number') return;

    const ssePhase = scanStatusToAnimationPhase(scanStatus);

    /* If scan is complete, go to reveal then complete */
    if (ssePhase === 'complete') {
      if (currentPhase < 3) {
        setCurrentPhase(3);
        phaseStartRef.current = Date.now();

        /* After synthesis reveal, trigger complete */
        soundEffects.play('boot');
        setTimeout(() => {
          setCurrentPhase('complete');
          onComplete();
        }, finalScore != null ? 11000 : 3000);
      }
      return;
    }

    /* Check if we should advance based on time + SSE phase */
    const phaseConfig = PHASE_CONFIGS[currentPhase];
    if (!phaseConfig) return;

    const elapsed = Date.now() - phaseStartRef.current;
    const sseWantsHigherPhase = typeof ssePhase === 'number' && ssePhase > currentPhase;

    /* Advance if min duration passed AND SSE suggests higher phase */
    if (elapsed >= phaseConfig.minDurationMs && sseWantsHigherPhase) {
      const nextPhase = Math.min(currentPhase + 1, 3) as 0 | 1 | 2 | 3;
      setCurrentPhase(nextPhase);
      phaseStartRef.current = Date.now();
    }

    /* Force-advance if max duration exceeded */
    if (elapsed >= phaseConfig.maxDurationMs && currentPhase < 3) {
      const nextPhase = (currentPhase + 1) as 0 | 1 | 2 | 3;
      setCurrentPhase(nextPhase);
      phaseStartRef.current = Date.now();
    }
  }, [currentPhase, scanStatus, finalScore, onComplete]);

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
  const asciiMovie = useRef(selectAsciiMovie(isFirstScan));

  /* ── Don't render if sequence is done ────────────────────── */
  if (currentPhase === 'complete' || currentPhase === 'skipped') {
    return null;
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[1000] bg-gs-ink overflow-hidden">
      {/* ── Phase 0: Matrix Intro ────────────────────────── */}
      {currentPhase === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Matrix rain background */}
          {showMatrixRain && (
            <div className="absolute inset-0">
              <MatrixRain fontSize={16} fadeOpacity={0.04} speed={1.2} />
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
            externalLines={sseBootLines}
            className="h-full"
          />
        </div>
      )}

      {/* ── Phase 2: ASCII Movie ─────────────────────────── */}
      {currentPhase === 2 && (
        <div className="absolute inset-0 flex">
          {/* ASCII movie (main area) */}
          <div className="flex-1 flex items-center justify-center bg-gs-ink p-gs-4">
            <AsciiPlayer
              moviePath={asciiMovie.current.path}
              autoPlay
              loop={asciiMovie.current.loop}
              showSshHint
              className="max-w-[700px]"
            />
          </div>

          {/* Side terminal showing real module progress */}
          <div className="w-[300px] border-l border-gs-chrome-dark">
            <TerminalBoot
              domain={domain}
              progress={progress}
              variant="boot"
              externalLines={sseBootLines}
              className="h-full"
            />
          </div>

          {/* Chloé watching the movie */}
          <div className="absolute bottom-gs-8 left-gs-8 animate-ghost-float">
            <ChloeSprite state="idle" size={64} glowing />
          </div>
        </div>
      )}

      {/* ── Phase 3: Synthesis Reveal ────────────────────── */}
      {currentPhase === 3 && (
        <div className="absolute inset-0">
          <TerminalBoot
            domain={domain}
            progress={progress}
            variant="synthesis"
            score={finalScore}
            scoreLabel={finalScoreLabel}
            moduleCount={moduleCount}
            className="h-full"
          />

          {/* Chloé celebrating */}
          {finalScore != null && (
            <div className="absolute bottom-gs-16 right-gs-16">
              <ChloeSprite state="celebrating" size={128} glowing />
              <ChloeTypingBubble
                message={`MarketingIQ™: ${finalScore}. ${finalScoreLabel ?? 'Interesting.'}`}
                visible
                variant="ghost"
                tailPosition="bottom-right"
                autoDismissMs={8000}
              />
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
