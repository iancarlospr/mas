'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useWindowDrag } from '@/hooks/use-window-drag';
import { useWindowResize } from '@/hooks/use-window-resize';

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
        <span className="window-titlebar-icon">{windowState.icon}</span>
        <span className="window-titlebar-text">{windowState.title}</span>
      </div>

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
