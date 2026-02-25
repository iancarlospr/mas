'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChloeSprite } from './chloe-sprite';
import { ChloeSpeech } from './chloe-speech';
import { useChloeReactions } from './chloe-reactions';

/**
 * GhostScan OS — Chloé Screenmate
 * ═══════════════════════════════════════
 *
 * WHAT: The full desktop pet experience. Chloé roams the desktop,
 *       sits on window edges, sleeps after idle, does mischief,
 *       and can be dragged by the user.
 * WHY:  She's the soul of the product — a living character that makes
 *       the retro OS feel inhabited (Plan Sections 4, 8).
 *       Like Microsoft Rover or Bonzi Buddy, but fashion-forward.
 * HOW:  Absolute positioning on the desktop canvas. Smooth CSS transitions
 *       for movement. Idle timer triggers mischief/sleep after 30s.
 *       Drag via pointer events (she reacts: annoyed → amused → cooperates).
 *
 * Performance: Movement uses CSS transform (GPU-composited).
 * No requestAnimationFrame loop — position updates via state + transition.
 */

interface ChloeScreenmateProps {
  /** Bounding container (defaults to viewport) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Initial position */
  initialX?: number;
  initialY?: number;
  /** Whether screenmate is active (disable during scan sequence) */
  active?: boolean;
}

/** Time before Chloé enters idle behaviors (ms) */
const IDLE_TIMEOUT_MS = 30_000;

/** Time between idle actions (ms) */
const IDLE_ACTION_INTERVAL_MS = 12_000;

/** Movement speed — pixels per transition */
const WANDER_RANGE_PX = 120;

/** Drag reaction thresholds */
const DRAG_ANNOYED_COUNT = 2;
const DRAG_AMUSED_COUNT = 5;

export function ChloeScreenmate({
  containerRef,
  initialX = 200,
  initialY = 300,
  active = true,
}: ChloeScreenmateProps) {
  const { state, speech, speechVariant, triggerReaction, dismissSpeech } =
    useChloeReactions();

  /* ── Position state ──────────────────────────────────────── */
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [flipped, setFlipped] = useState(false);

  /* ── Idle timer refs ─────────────────────────────────────── */
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleActionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInteractionRef = useRef(Date.now());

  /* ── Drag state ──────────────────────────────────────────── */
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);
  const dragStartRef = useRef({ x: 0, y: 0 });

  /* ── Reset idle timer on any interaction ─────────────────── */
  const resetIdleTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleActionRef.current) clearInterval(idleActionRef.current);

    if (!active) return;

    /* After IDLE_TIMEOUT_MS of no interaction, start idle behaviors */
    idleTimerRef.current = setTimeout(() => {
      /* First idle action: quip or mischief */
      triggerReaction({ type: 'idle-quip' });

      /* Repeated idle actions every IDLE_ACTION_INTERVAL_MS */
      idleActionRef.current = setInterval(() => {
        const rand = Math.random();
        if (rand < 0.3) {
          triggerReaction({ type: 'mischief' });
        } else if (rand < 0.5) {
          triggerReaction({ type: 'idle-quip' });
        } else {
          /* Wander to a new position */
          setPosition((prev) => {
            const bounds = containerRef?.current?.getBoundingClientRect() ?? {
              width: window.innerWidth,
              height: window.innerHeight,
            };
            const newX = Math.max(
              32,
              Math.min(
                bounds.width - 96,
                prev.x + (Math.random() - 0.5) * WANDER_RANGE_PX * 2,
              ),
            );
            const newY = Math.max(
              64,
              Math.min(
                bounds.height - 128,
                prev.y + (Math.random() - 0.5) * WANDER_RANGE_PX * 2,
              ),
            );
            setFlipped(newX < prev.x);
            return { x: newX, y: newY };
          });
        }
      }, IDLE_ACTION_INTERVAL_MS);
    }, IDLE_TIMEOUT_MS);
  }, [active, containerRef, triggerReaction]);

  /* Start idle timer on mount */
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (idleActionRef.current) clearInterval(idleActionRef.current);
    };
  }, [resetIdleTimer]);

  /* Listen for user interaction anywhere → reset idle */
  useEffect(() => {
    if (!active) return;

    const handler = () => resetIdleTimer();
    window.addEventListener('mousemove', handler, { passive: true });
    window.addEventListener('keydown', handler, { passive: true });
    window.addEventListener('click', handler, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, [active, resetIdleTimer]);

  /* ── Drag handlers ───────────────────────────────────────── */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      dragCountRef.current++;
      resetIdleTimer();

      /* React to being grabbed */
      if (dragCountRef.current <= DRAG_ANNOYED_COUNT) {
        triggerReaction({ type: 'mischief' });
      } else if (dragCountRef.current <= DRAG_AMUSED_COUNT) {
        triggerReaction({ type: 'idle-quip' });
      }
      /* After DRAG_AMUSED_COUNT, she cooperates silently */

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position, resetIdleTimer, triggerReaction],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setPosition({ x: newX, y: newY });
      setFlipped(e.movementX < 0);
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!active) return null;

  return (
    <div
      className="absolute z-chloe pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'left 1.5s ease-in-out, top 1.5s ease-in-out',
        willChange: 'left, top',
      }}
    >
      {/* Speech bubble (above Chloé) */}
      {speech && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-gs-2 pointer-events-auto">
          <ChloeSpeech
            message={speech}
            variant={speechVariant}
            visible
            tailPosition="bottom-left"
            onDismiss={dismissSpeech}
          />
        </div>
      )}

      {/* Chloé sprite (draggable) */}
      <div
        className="pointer-events-auto cursor-ghost"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <ChloeSprite
          state={state}
          size={64}
          glowing
          flipped={flipped}
        />
      </div>
    </div>
  );
}
