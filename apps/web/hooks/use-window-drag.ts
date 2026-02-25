'use client';

import { useRef, useCallback, useEffect, type RefObject } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Window Drag Hook

   Attach to a title bar element. Handles pointer-based drag-to-move.
   Uses direct DOM manipulation during drag for 60fps, commits
   final position via callback on pointerup.

   Does NOT depend on WindowManagerProvider — takes callbacks.
   ═══════════════════════════════════════════════════════════════ */

interface UseDragOptions {
  windowRef: RefObject<HTMLDivElement | null>;
  getPosition: () => { x: number; y: number } | null;
  onMove: (x: number, y: number) => void;
  onFocus: () => void;
  isMaximized: boolean;
}

export function useWindowDrag({ windowRef, getPosition, onMove, onFocus, isMaximized }: UseDragOptions) {
  const titleBarRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (isMaximized) return;

      const pos = getPosition();
      if (!pos) return;

      e.preventDefault();
      onFocus();

      dragState.current = {
        isDragging: true,
        offsetX: e.clientX - pos.x,
        offsetY: e.clientY - pos.y,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getPosition, onFocus, isMaximized],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current.isDragging) return;

      const newX = e.clientX - dragState.current.offsetX;
      const newY = e.clientY - dragState.current.offsetY;
      const clampedX = Math.max(-200, Math.min(window.innerWidth - 100, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 40, newY));

      if (windowRef.current) {
        windowRef.current.style.left = `${clampedX}px`;
        windowRef.current.style.top = `${clampedY}px`;
      }
    },
    [windowRef],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragState.current.isDragging) return;
      dragState.current.isDragging = false;

      const newX = e.clientX - dragState.current.offsetX;
      const newY = e.clientY - dragState.current.offsetY;
      const clampedX = Math.max(-200, Math.min(window.innerWidth - 100, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 40, newY));

      onMove(clampedX, clampedY);
    },
    [onMove],
  );

  useEffect(() => {
    const el = titleBarRef.current;
    if (!el) return;

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  return { titleBarRef };
}
