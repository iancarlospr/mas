'use client';

import { useRef, useCallback, useEffect, type RefObject } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Window Resize Hook

   8 invisible resize handles (4 edges + 4 corners), each 6px wide.
   Direct DOM manipulation during resize for 60fps.

   Does NOT depend on WindowManagerProvider — takes callbacks.
   ═══════════════════════════════════════════════════════════════ */

type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const HANDLE_SIZE = 6;

const CURSOR_MAP: Record<ResizeEdge, string> = {
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
};

interface UseResizeOptions {
  windowRef: RefObject<HTMLDivElement | null>;
  getRect: () => { x: number; y: number; width: number; height: number; minWidth: number; minHeight: number } | null;
  onResize: (x: number, y: number, width: number, height: number) => void;
  isMaximized: boolean;
}

export function useWindowResize({ windowRef, getRect, onResize, isMaximized }: UseResizeOptions) {
  const resizeState = useRef({
    isResizing: false,
    edge: null as ResizeEdge | null,
    startX: 0,
    startY: 0,
    startRect: { x: 0, y: 0, width: 0, height: 0, minWidth: 300, minHeight: 200 },
  });

  const calcNewRect = useCallback((e: { clientX: number; clientY: number }) => {
    const state = resizeState.current;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const r = state.startRect;

    let newX = r.x;
    let newY = r.y;
    let newW = r.width;
    let newH = r.height;

    if (state.edge?.includes('e')) {
      newW = Math.max(r.minWidth, r.width + dx);
    }
    if (state.edge?.includes('w')) {
      const proposedW = r.width - dx;
      if (proposedW >= r.minWidth) {
        newW = proposedW;
        newX = r.x + dx;
      }
    }
    if (state.edge?.includes('s')) {
      newH = Math.max(r.minHeight, r.height + dy);
    }
    if (state.edge?.includes('n')) {
      const proposedH = r.height - dy;
      if (proposedH >= r.minHeight) {
        newH = proposedH;
        newY = r.y + dy;
      }
    }

    return { x: newX, y: newY, width: newW, height: newH };
  }, []);

  const handlePointerDown = useCallback(
    (edge: ResizeEdge, e: React.PointerEvent) => {
      if (isMaximized) return;
      const rect = getRect();
      if (!rect) return;

      e.preventDefault();
      e.stopPropagation();

      resizeState.current = {
        isResizing: true,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startRect: rect,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getRect, isMaximized],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!resizeState.current.isResizing) return;
      const { x, y, width, height } = calcNewRect(e);

      if (windowRef.current) {
        windowRef.current.style.left = `${x}px`;
        windowRef.current.style.top = `${y}px`;
        windowRef.current.style.width = `${width}px`;
        windowRef.current.style.height = `${height}px`;
      }
    },
    [windowRef, calcNewRect],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!resizeState.current.isResizing) return;
      const { x, y, width, height } = calcNewRect(e);

      resizeState.current.isResizing = false;
      resizeState.current.edge = null;

      onResize(x, y, width, height);
    },
    [onResize, calcNewRect],
  );

  // Global listeners for when cursor leaves the handle during drag
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (resizeState.current.isResizing) handlePointerMove(e);
    };
    const onUp = (e: PointerEvent) => {
      if (resizeState.current.isResizing) handlePointerUp(e);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const resizeHandles = isMaximized ? null : (
    <>
      {(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as ResizeEdge[]).map((edge) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          zIndex: 1,
          cursor: CURSOR_MAP[edge],
        };

        switch (edge) {
          case 'n':
            style.top = -HANDLE_SIZE / 2; style.left = HANDLE_SIZE; style.right = HANDLE_SIZE; style.height = HANDLE_SIZE;
            break;
          case 'ne':
            style.top = -HANDLE_SIZE / 2; style.right = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE * 2; style.height = HANDLE_SIZE * 2;
            break;
          case 'e':
            style.top = HANDLE_SIZE; style.bottom = HANDLE_SIZE; style.right = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE;
            break;
          case 'se':
            style.bottom = -HANDLE_SIZE / 2; style.right = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE * 2; style.height = HANDLE_SIZE * 2;
            break;
          case 's':
            style.bottom = -HANDLE_SIZE / 2; style.left = HANDLE_SIZE; style.right = HANDLE_SIZE; style.height = HANDLE_SIZE;
            break;
          case 'sw':
            style.bottom = -HANDLE_SIZE / 2; style.left = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE * 2; style.height = HANDLE_SIZE * 2;
            break;
          case 'w':
            style.top = HANDLE_SIZE; style.bottom = HANDLE_SIZE; style.left = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE;
            break;
          case 'nw':
            style.top = -HANDLE_SIZE / 2; style.left = -HANDLE_SIZE / 2; style.width = HANDLE_SIZE * 2; style.height = HANDLE_SIZE * 2;
            break;
        }

        return (
          <div
            key={edge}
            style={style}
            data-resize-edge={edge}
            onPointerDown={(e) => handlePointerDown(edge, e)}
          />
        );
      })}
    </>
  );

  return { resizeHandles };
}
