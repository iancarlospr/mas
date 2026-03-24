'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChloeSprite } from './chloe-sprite';
import { LaserBeams } from './laser-beams';
import { useChloeReactions } from './chloe-reactions';
import { useWindowManager } from '@/lib/window-manager';

/**
 * Chloé's Bedroom OS — Chloé Screenmate
 * ========================================
 *
 * The living desktop pet. Chloé roams the desktop, sits on window
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
  /** When true, ghost puffs away (scan running or report open) */
  suppressed?: boolean;
}

/* -- Laser beam constants ------------------------------------- */
const LASER_ZAPS_ICON_INTERVAL = 5_000;
const LASER_ZAP_DURATION = 800;

const IDLE_TIMEOUT_MS = 57_000;
const IDLE_ACTION_INTERVAL_MS = 57_000;
const WANDER_RANGE_PX = 300;
const DRAG_ANNOYED_COUNT = 2;
const DRAG_AMUSED_COUNT = 5;
const PERCH_PROBABILITY = 0.35;
const EDGE_PEEK_PROBABILITY = 0.15;

export function ChloeScreenmate({
  containerRef,
  initialX,
  initialY,
  active = true,
  suppressed = false,
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
  const [animFrame, setAnimFrame] = useState(0);
  const [laserTarget, setLaserTarget] = useState<{ x: number; y: number } | null>(null);
  const zapTargetRef = useRef<{ x: number; y: number } | null>(null);
  const [zapActive, setZapActive] = useState(false); // just for re-render trigger
  const laserTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ghostSpriteRef = useRef<HTMLDivElement>(null);

  /* -- Puff animation (suppressed = scan running or report open) */
  const [puffVisible, setPuffVisible] = useState(!suppressed);
  const [puffing, setPuffing] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    if (suppressed) {
      // Kill active laser immediately
      setLaserTarget(null);
      zapTargetRef.current = null;
      // Start puff-out
      setPuffing('out');
      const timer = setTimeout(() => {
        setPuffVisible(false);
        setPuffing(null);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      // Puff back in
      setPuffVisible(true);
      // Need a frame for the element to mount before transitioning
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPuffing('in'));
      });
      const timer = setTimeout(() => setPuffing(null), 400);
      return () => clearTimeout(timer);
    }
  }, [suppressed]);

  /* -- Initialize position to bottom-right of desktop --------- */
  useEffect(() => {
    if (initialized) return;
    const x = initialX ?? Math.max(100, window.innerWidth - 200);
    const y = initialY ?? Math.max(100, window.innerHeight - 180);
    setPosition({ x, y });
    setInitialized(true);
  }, [initialized, initialX, initialY]);

  /* -- Roam every 57s: dart around viewport then settle to bottom */
  useEffect(() => {
    if (suppressed) return;

    const roam = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 3 fast random positions across viewport
      const darts = [
        { x: 100 + Math.random() * (vw - 200), y: 60 + Math.random() * (vh * 0.5) },
        { x: 100 + Math.random() * (vw - 200), y: 60 + Math.random() * (vh * 0.5) },
        { x: 100 + Math.random() * (vw - 200), y: 60 + Math.random() * (vh * 0.5) },
      ];
      // Final settle position at bottom
      const settle = { x: 120 + Math.random() * (vw - 240), y: vh - 120 - Math.random() * 80 };

      setIsPerched(false);

      // Dart 1
      setPosition(prev => { setFlipped(darts[0]!.x < prev.x); return darts[0]!; });

      // Dart 2
      setTimeout(() => {
        setPosition(prev => { setFlipped(darts[1]!.x < prev.x); return darts[1]!; });
      }, 2000);

      // Dart 3
      setTimeout(() => {
        setPosition(prev => { setFlipped(darts[2]!.x < prev.x); return darts[2]!; });
      }, 4000);

      // Settle to bottom
      setTimeout(() => {
        setPosition(prev => { setFlipped(settle.x < prev.x); return settle; });
      }, 6000);
    };

    const timer = setTimeout(roam, 57_000);
    const interval = setInterval(roam, 57_000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [suppressed]);

  /* -- Animation frame counter (blink + wave) ----------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimFrame(f => (f + 1) % 8);
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

  /* -- Laser eyes: target scan input or random icons ---------- */
  // Laser is OFF by default — only fires during sweep events
  const wmRef = useRef(wm);
  wmRef.current = wm;

  // Input sweep — fires at 22s, repeats every 22s if scan window still open
  useEffect(() => {
    if (suppressed) return;

    const doSweepAnim = (startX: number, startY: number, sweepWidth: number, onDone: () => void) => {
      const sweepDuration = 1200;
      const sweepStart = Date.now();

      const animate = () => {
        const elapsed = Date.now() - sweepStart;
        const t = Math.min(elapsed / sweepDuration, 1);

        if (t < 0.7) {
          const p = t / 0.7;
          const eased = p * (2 - p);
          zapTargetRef.current = { x: startX + eased * sweepWidth, y: startY };
        } else if (t < 1) {
          const p = (t - 0.7) / 0.3;
          const eased = p * p;
          zapTargetRef.current = {
            x: startX + sweepWidth + eased * 30,
            y: startY - eased * 50,
          };
        } else {
          zapTargetRef.current = null;
          onDone();
          return;
        }
        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    };

    const doSweep = () => {
      const scanWin = wmRef.current.windows['scan-input'];
      const scanOpen = scanWin?.isOpen && !scanWin.isMinimized;

      if (scanOpen) {
        // Sweep the URL input
        const inputEl = document.querySelector('#window-scan-input input[type="text"]');
        if (!inputEl) return;
        const rect = inputEl.getBoundingClientRect();
        const startX = rect.left;
        const startY = rect.top + rect.height / 2;

        setLaserTarget({ x: rect.left + rect.width / 2, y: startY });
        setTimeout(() => {
          doSweepAnim(startX, startY, rect.width * 0.9, () => setLaserTarget(null));
        }, 500);
      } else {
        // Sweep a random icon
        const icons = document.querySelectorAll<HTMLElement>('[data-icon-id]');
        if (icons.length === 0) return;
        const icon = icons[Math.floor(Math.random() * icons.length)]!;
        const rect = icon.getBoundingClientRect();
        const startX = rect.left - 40;
        const startY = rect.top + rect.height / 2;

        setLaserTarget({ x: rect.left + rect.width / 2, y: startY });
        setTimeout(() => {
          doSweepAnim(startX, startY, 200, () => setLaserTarget(null));
        }, 500);
      }
    };

    const firstTimer = setTimeout(doSweep, 22_000);
    const repeatId = setInterval(doSweep, 22_000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(repeatId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed]);

  // Pricing window — laser the "Unlock Results" button 3s after open
  const pricingFiredRef = useRef(false);
  useEffect(() => {
    if (suppressed) return;
    const pricingWin = wm.windows['pricing'];
    if (pricingWin?.isOpen && !pricingWin.isMinimized && !pricingFiredRef.current) {
      pricingFiredRef.current = true;
      const timer = setTimeout(() => {
        // Find "Unlock Results" button by text
        const buttons = document.querySelectorAll('#window-pricing button');
        let unlockBtn: HTMLElement | null = null;
        buttons.forEach(b => {
          if (b.textContent?.trim() === 'Unlock Results') unlockBtn = b as HTMLElement;
        });
        if (!unlockBtn) { setLaserTarget(null); return; }
        const btn = unlockBtn as HTMLElement;

        const rect = btn.getBoundingClientRect();
        const startX = rect.left - 20;
        const startY = rect.top + rect.height / 2;

        setLaserTarget({ x: rect.left + rect.width / 2, y: startY });
        setTimeout(() => {
          const sweepDuration = 1200;
          const sweepStart = Date.now();
          const animate = () => {
            const elapsed = Date.now() - sweepStart;
            const t = Math.min(elapsed / sweepDuration, 1);
            if (t < 0.7) {
              const p = t / 0.7;
              const eased = p * (2 - p);
              zapTargetRef.current = { x: startX + eased * (rect.width + 40), y: startY };
            } else if (t < 1) {
              const p = (t - 0.7) / 0.3;
              const eased = p * p;
              zapTargetRef.current = { x: startX + rect.width + 40 + eased * 30, y: startY - eased * 50 };
            } else {
              zapTargetRef.current = null;
              setLaserTarget(null);
              return;
            }
            requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }, 500);
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (!pricingWin?.isOpen) {
      pricingFiredRef.current = false; // reset when closed so it fires again next open
    }
  }, [wm.windows, suppressed]);

  // Random icon zaps — only fire when laser is active (during a sweep event)
  const laserActiveRef = useRef(false);
  laserActiveRef.current = !!laserTarget;

  useEffect(() => {
    if (suppressed) return;

    laserTimerRef.current = setInterval(() => {
      if (!laserActiveRef.current) return;

      const icons = document.querySelectorAll<HTMLElement>('[data-icon-id]');
      if (icons.length === 0) return;
      const icon = icons[Math.floor(Math.random() * icons.length)]!;
      const rect = icon.getBoundingClientRect();
      const startX = rect.left - 80;
      const startY = rect.top + rect.height / 2;

      const sweepDuration = 1200;
      const sweepStart = Date.now();

      const animateZap = () => {
        const elapsed = Date.now() - sweepStart;
        const t = Math.min(elapsed / sweepDuration, 1);

        if (t < 0.7) {
          const p = t / 0.7;
          const eased = p * (2 - p);
          zapTargetRef.current = { x: startX + eased * 200, y: startY };
        } else if (t < 1) {
          const p = (t - 0.7) / 0.3;
          const eased = p * p;
          zapTargetRef.current = {
            x: startX + 200 + eased * 30,
            y: startY - eased * 50,
          };
        } else {
          zapTargetRef.current = null;
          return;
        }
        requestAnimationFrame(animateZap);
      };

      requestAnimationFrame(animateZap);
    }, LASER_ZAPS_ICON_INTERVAL);

    return () => {
      if (laserTimerRef.current) clearInterval(laserTimerRef.current);
    };
  }, [suppressed]);

  /* -- Double-click: random quip ------------------------------ */
  const handleDoubleClick = useCallback(() => {
    triggerReaction({ type: 'idle-quip' });
  }, [triggerReaction]);

  if (!active || !initialized || !puffVisible) return null;

  const isPuffingOut = puffing === 'out';
  const isPuffingIn = puffing === 'in';

  return (
    <div
      ref={ghostSpriteRef}
      className="absolute z-chloe pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        opacity: isPuffingOut ? 0 : (isPuffingIn || !puffing) ? 1 : 0,
        transform: isPuffingOut ? 'scale(1.3)' : 'scale(1)',
        filter: isPuffingOut ? 'blur(6px)' : isPuffingIn ? 'blur(0px)' : undefined,
        transition: isDragging
          ? 'none'
          : [
              'left 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
              'top 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
              ...(puffing ? ['opacity 400ms ease-out', 'transform 400ms ease-out', 'filter 400ms ease-out'] : []),
            ].join(', '),
        willChange: 'left, top',
      }}
    >
      {/* Shadow beneath Chloé when perched */}
      {isPerched && (
        <div
          className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-[48px] h-[6px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, oklch(0.82 0.15 340 / 0.15) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Chloé sprite (draggable + double-clickable) */}
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
          state={laserTarget ? 'scanning' : state}
          size={64}
          glowing
          flipped={flipped}
          frame={laserTarget ? 0 : animFrame}
        />
      </div>

      {/* Laser beams — canvas portal at page root, reads ghost position via rAF */}
      <LaserBeams ghostRef={ghostSpriteRef} targetPos={laserTarget} zapTargetRef={zapTargetRef} />
    </div>
  );
}
