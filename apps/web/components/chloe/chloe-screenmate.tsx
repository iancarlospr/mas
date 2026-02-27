'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChloeSprite } from './chloe-sprite';
import { useChloeReactions } from './chloe-reactions';
import { useWindowManager } from '@/lib/window-manager';

/**
 * Chloe's Bedroom OS — Chloe Screenmate
 * ========================================
 *
 * The living desktop pet. Chloe roams the desktop, sits on window
 * title bars, peeks around edges, sleeps after idle, does mischief,
 * reacts to window opens/closes, and can be dragged.
 *
 * Behaviors:
 * - Wanders freely on desktop (avoids icon columns)
 * - Perches on top of open window title bars
 * - Reacts when windows open (looks toward them)
 * - Falls asleep after 45s of no interaction (ZZZ animation)
 * - Gets annoyed when dragged, then amused, then cooperates
 * - Occasionally peeks from screen edges
 * - Double-click: triggers a random quip
 */

interface ChloeScreenmateProps {
  containerRef?: React.RefObject<HTMLElement | null>;
  initialX?: number;
  initialY?: number;
  active?: boolean;
}

const IDLE_TIMEOUT_MS = 45_000;
const IDLE_ACTION_INTERVAL_MS = 10_000;
const WANDER_RANGE_PX = 180;
const DRAG_ANNOYED_COUNT = 2;
const DRAG_AMUSED_COUNT = 5;
const PERCH_PROBABILITY = 0.35;
const EDGE_PEEK_PROBABILITY = 0.15;

export function ChloeScreenmate({
  containerRef,
  initialX,
  initialY,
  active = true,
}: ChloeScreenmateProps) {
  const { state, speech, speechVariant, triggerReaction, dismissSpeech } =
    useChloeReactions();
  const wm = useWindowManager();

  /* -- Position state ----------------------------------------- */
  const [position, setPosition] = useState({ x: initialX ?? 0, y: initialY ?? 0 });
  const [flipped, setFlipped] = useState(false);
  const [isPerched, setIsPerched] = useState(false);
  const [initialized, setInitialized] = useState(false);

  /* -- Refs --------------------------------------------------- */
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleActionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const prevWindowCountRef = useRef(0);
  const frameRef = useRef(0);

  /* -- Initialize position to bottom-right of desktop --------- */
  useEffect(() => {
    if (initialized) return;
    const x = initialX ?? Math.max(100, window.innerWidth - 200);
    const y = initialY ?? Math.max(100, window.innerHeight - 200);
    setPosition({ x, y });
    setInitialized(true);
  }, [initialized, initialX, initialY]);

  /* -- Blink animation frame counter -------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % 8;
    }, 500);
    return () => clearInterval(interval);
  }, []);

  /* -- Get a window to perch on ------------------------------- */
  const getPerchTarget = useCallback(() => {
    const visible = wm.visibleWindows.filter(w => !w.isMinimized && !w.isRouteWindow);
    if (visible.length === 0) return null;
    const target = visible[Math.floor(Math.random() * visible.length)];
    if (!target) return null;
    // Perch on top of the window's title bar
    return {
      x: target.x + target.width / 2 - 32,
      y: target.y - 48,
      windowId: target.id,
    };
  }, [wm.visibleWindows]);

  /* -- Get a safe wander position ----------------------------- */
  const getWanderPosition = useCallback((prev: { x: number; y: number }) => {
    const bounds = containerRef?.current?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    // Avoid icon columns (left 100px, right 100px)
    const minX = 100;
    const maxX = bounds.width - 164;
    const minY = 48; // Below menu bar
    const maxY = bounds.height - 120; // Above taskbar

    const newX = Math.max(
      minX,
      Math.min(maxX, prev.x + (Math.random() - 0.5) * WANDER_RANGE_PX * 2),
    );
    const newY = Math.max(
      minY,
      Math.min(maxY, prev.y + (Math.random() - 0.5) * WANDER_RANGE_PX * 2),
    );
    return { x: newX, y: newY };
  }, [containerRef]);

  /* -- React to window open/close ----------------------------- */
  useEffect(() => {
    const currentCount = wm.visibleWindows.length;
    if (prevWindowCountRef.current !== currentCount && prevWindowCountRef.current !== 0) {
      if (currentCount > prevWindowCountRef.current) {
        // Window opened — look toward it briefly
        const newest = wm.visibleWindows[wm.visibleWindows.length - 1];
        if (newest) {
          setFlipped(newest.x < position.x);
        }
      }
    }
    prevWindowCountRef.current = currentCount;
  }, [wm.visibleWindows, position.x]);

  /* -- Idle timer --------------------------------------------- */
  const resetIdleTimer = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleActionRef.current) clearInterval(idleActionRef.current);
    if (!active) return;

    idleTimerRef.current = setTimeout(() => {
      // First idle action
      triggerReaction({ type: 'idle-quip' });

      idleActionRef.current = setInterval(() => {
        const rand = Math.random();

        if (rand < EDGE_PEEK_PROBABILITY) {
          // Edge peek — move to screen edge and peek
          const edge = Math.random() < 0.5 ? 'left' : 'right';
          const y = 100 + Math.random() * (window.innerHeight - 300);
          setPosition({
            x: edge === 'left' ? -20 : window.innerWidth - 44,
            y,
          });
          setFlipped(edge === 'left');
          setIsPerched(false);
          triggerReaction({ type: 'mischief' });
        } else if (rand < EDGE_PEEK_PROBABILITY + PERCH_PROBABILITY) {
          // Perch on a window
          const perch = getPerchTarget();
          if (perch) {
            setPosition({ x: perch.x, y: perch.y });
            setFlipped(Math.random() < 0.5);
            setIsPerched(true);
          } else {
            // No windows to perch on, wander instead
            setPosition(prev => {
              const next = getWanderPosition(prev);
              setFlipped(next.x < prev.x);
              return next;
            });
            setIsPerched(false);
          }
        } else if (rand < 0.65) {
          triggerReaction({ type: 'idle-quip' });
        } else if (rand < 0.75) {
          triggerReaction({ type: 'mischief' });
        } else {
          // Standard wander
          setPosition(prev => {
            const next = getWanderPosition(prev);
            setFlipped(next.x < prev.x);
            return next;
          });
          setIsPerched(false);
        }
      }, IDLE_ACTION_INTERVAL_MS);
    }, IDLE_TIMEOUT_MS);
  }, [active, getPerchTarget, getWanderPosition, triggerReaction]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (idleActionRef.current) clearInterval(idleActionRef.current);
    };
  }, [resetIdleTimer]);

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

  /* -- Drag handlers ------------------------------------------ */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setIsPerched(false);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      dragCountRef.current++;
      resetIdleTimer();

      if (dragCountRef.current <= DRAG_ANNOYED_COUNT) {
        triggerReaction({ type: 'mischief' });
      } else if (dragCountRef.current <= DRAG_AMUSED_COUNT) {
        triggerReaction({ type: 'idle-quip' });
      }

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

  /* -- Double-click: random quip ------------------------------ */
  const handleDoubleClick = useCallback(() => {
    triggerReaction({ type: 'idle-quip' });
  }, [triggerReaction]);

  if (!active || !initialized) return null;

  return (
    <div
      className="absolute z-chloe pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging
          ? 'none'
          : 'left 1.8s cubic-bezier(0.34, 1.56, 0.64, 1), top 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'left, top',
      }}
    >
      {/* Shadow beneath Chloe when perched */}
      {isPerched && (
        <div
          className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-[48px] h-[6px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, oklch(0.82 0.15 340 / 0.15) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Chloe sprite (draggable + double-clickable) */}
      <div
        className="pointer-events-auto cursor-ghost select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          touchAction: 'none',
          filter: isDragging ? 'drop-shadow(0 4px 12px oklch(0.82 0.15 340 / 0.4))' : undefined,
          transform: isDragging ? 'scale(1.1)' : undefined,
          transition: isDragging ? 'none' : 'filter 300ms, transform 300ms',
        }}
      >
        <ChloeSprite
          state={state}
          size={64}
          glowing
          flipped={flipped}
          frame={frameRef.current}
        />
      </div>
    </div>
  );
}
