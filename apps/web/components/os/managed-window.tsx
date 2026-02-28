'use client';

import { useCallback, useRef, useMemo, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useWindowDrag } from '@/hooks/use-window-drag';
import { useWindowResize } from '@/hooks/use-window-resize';

/* Bayer 8x8 threshold matrix */
const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

const DITHER_HEIGHT = 40;

function DitherTitlebar({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.offsetWidth;
    if (w === 0) return;

    const scale = 2;
    const cols = Math.ceil(w / scale);
    const rows = Math.ceil(DITHER_HEIGHT / scale);

    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = w + 'px';
    canvas.style.height = DITHER_HEIGHT + 'px';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Exact colors: active = #FFB2EF, inactive = oklch(0.35 0.05 340) = rgb(76, 48, 67)
    const r = active ? 255 : 76;
    const g = active ? 178 : 48;
    const b = active ? 239 : 67;

    // Window body color (dark bg)
    const br = 18, bg2 = 15, bb = 19; // approx oklch(0.13 0.01 340)

    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;

    for (let y = 0; y < rows; y++) {
      const gradient = 1.0 - (y / rows);

      for (let x = 0; x < cols; x++) {
        const threshold = BAYER8[y % 8]![x % 8]! / 64;
        const idx = (y * cols + x) * 4;

        if (gradient > threshold) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        } else {
          data[idx] = br;
          data[idx + 1] = bg2;
          data[idx + 2] = bb;
        }
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 overflow-hidden"
      style={{
        height: DITHER_HEIGHT,
        marginTop: -1,
        background: active ? '#FFB2EF' : 'rgb(76, 48, 67)',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

/* =================================================================
   Chloe's Bedroom OS — Managed Window

   Height is CSS-driven: fit-content up to 85vh, then scrolls.
   Width comes from window manager state.
   No JS measurement hacks — pure CSS layout.
   ================================================================= */

interface ManagedWindowProps {
  id: string;
  children: ReactNode;
  contentClassName?: string;
  showStatusBar?: boolean;
  statusBarContent?: ReactNode;
}

export function ManagedWindow({
  id,
  children,
  contentClassName,
  showStatusBar,
  statusBarContent,
}: ManagedWindowProps) {
  const wm = useWindowManager();
  const windowState = useWindowState(id);
  const windowRef = useRef<HTMLDivElement>(null);

  const isActive = wm.activeWindowId === id;
  const isMaximized = windowState?.isMaximized ?? false;

  const getPosition = useCallback(() => {
    if (!windowState) return null;
    return { x: windowState.x, y: windowState.y };
  }, [windowState]);

  const handleMove = useCallback(
    (x: number, y: number) => wm.moveWindow(id, x, y),
    [wm, id],
  );

  const handleFocus = useCallback(
    () => wm.focusWindow(id),
    [wm, id],
  );

  const getRect = useCallback(() => {
    if (!windowState) return null;
    return {
      x: windowState.x,
      y: windowState.y,
      width: windowState.width,
      height: windowState.height,
      minWidth: windowState.minWidth,
      minHeight: windowState.minHeight,
    };
  }, [windowState]);

  const handleResize = useCallback(
    (x: number, y: number, width: number, height: number) => {
      wm.moveResizeWindow(id, x, y, width, height);
    },
    [wm, id],
  );

  const { titleBarRef } = useWindowDrag({
    windowRef,
    getPosition,
    onMove: handleMove,
    onFocus: handleFocus,
    isMaximized,
  });

  const { resizeHandles } = useWindowResize({
    windowRef,
    getRect,
    onResize: handleResize,
    isMaximized,
  });

  // Compute transform-origin from desktop icon position (macOS-style open)
  const transformOrigin = useMemo(() => {
    if (isMaximized || !windowState) return undefined;
    // Find the icon button on the desktop
    const iconEl = document.querySelector(`[data-icon-id="${id}"]`);
    if (!iconEl) return undefined;
    const iconRect = iconEl.getBoundingClientRect();
    const iconCenterX = iconRect.left + iconRect.width / 2;
    const iconCenterY = iconRect.top + iconRect.height / 2;
    // Origin relative to window's top-left
    const ox = iconCenterX - windowState.x;
    const oy = iconCenterY - windowState.y;
    return `${ox}px ${oy}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, windowState?.x, windowState?.y, isMaximized]);

  if (!windowState || !windowState.isOpen || windowState.isMinimized) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      data-active={isActive}
      className={cn(
        'window',
        windowState.variant === 'ghost' && 'window-ghost',
        windowState.variant === 'terminal' && 'window-terminal',
        'animate-window-open',
      )}
      style={{
        position: 'absolute',
        left: isMaximized ? 0 : windowState.x,
        top: isMaximized ? 0 : windowState.y,
        width: isMaximized ? '100%' : windowState.width,
        height: isMaximized ? '100%' : 'fit-content',
        maxHeight: isMaximized ? '100%' : 'calc(85vh - 44px)',
        zIndex: windowState.zIndex,
        transformOrigin: transformOrigin,
      }}
      onMouseDown={handleFocus}
      role="region"
      aria-label={windowState.title}
      id={`window-${id}`}
    >
      {/* Resize handles */}
      {resizeHandles}

      {/* Title bar (drag handle) */}
      <div
        ref={titleBarRef}
        className="window-titlebar"
        data-active={isActive}
        onDoubleClick={() => wm.maximizeWindow(id)}
      >
        <div className="window-titlebar-buttons">
          <button
            className="window-titlebar-btn"
            data-action="close"
            onClick={() => wm.closeWindow(id)}
            aria-label="Close"
            title="Close"
          />
          <button
            className="window-titlebar-btn"
            data-action="minimize"
            onClick={() => wm.minimizeWindow(id)}
            aria-label="Minimize"
            title="Minimize"
          />
          <button
            className="window-titlebar-btn"
            data-action="maximize"
            onClick={() => wm.maximizeWindow(id)}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            title={isMaximized ? 'Restore' : 'Maximize'}
          />
        </div>
        <span className="window-titlebar-text">{windowState.title}</span>
      </div>

      {/* Dither strip — only on Scan.exe window */}
      {id === 'scan-input' && <DitherTitlebar active={isActive} />}

      {/* Content */}
      <div
        className={cn(
          'window-content',
          windowState.variant === 'terminal' && 'bg-[#0A0A0A] text-gs-terminal font-data text-data-sm',
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* Status bar */}
      {showStatusBar && (
        <div className="window-statusbar">
          {statusBarContent ?? (
            <div className="window-statusbar-section">Ready</div>
          )}
        </div>
      )}
    </div>
  );
}
