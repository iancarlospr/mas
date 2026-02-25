'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Window Component

   The foundational UI unit. Everything is a window.
   4 variants: default, terminal, ghost, dialog

   Win95 chrome: title bar with icon/title/buttons, content area,
   optional status bar. 3D bevel borders throughout.
   ═══════════════════════════════════════════════════════════════ */

export interface WindowProps {
  /** Unique ID for window manager z-index tracking */
  id: string;
  /** Window title text */
  title: string;
  /** Pixel art icon (16x16 or 32x32) shown in title bar */
  icon?: ReactNode;
  /** Content rendered inside the window */
  children: ReactNode;
  /** Window dimensions */
  width?: number | string;
  height?: number | string;
  /** Window variant */
  variant?: 'default' | 'terminal' | 'ghost' | 'dialog';
  /** Whether this window is the active/focused one */
  isActive?: boolean;
  /** Whether the window is maximized to fill the desktop */
  isMaximized?: boolean;
  /** Whether to show the status bar at bottom */
  showStatusBar?: boolean;
  /** Content for the status bar */
  statusBarContent?: ReactNode;
  /** Whether the window is currently animating open */
  animateIn?: boolean;
  /** Callback handlers */
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  /** Additional class names */
  className?: string;
  /** Content area class names */
  contentClassName?: string;
}

export function Window({
  id,
  title,
  icon,
  children,
  width,
  height,
  variant = 'default',
  isActive = true,
  isMaximized = false,
  showStatusBar = false,
  statusBarContent,
  animateIn = false,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  className,
  contentClassName,
}: WindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Play sound on mount (window open) and cleanup (window close)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      soundEffects.play('windowOpen');
    }
    return () => {
      soundEffects.play('windowClose');
    };
  }, []);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  return (
    <div
      ref={windowRef}
      id={`window-${id}`}
      role={variant === 'dialog' ? 'dialog' : 'region'}
      aria-label={title}
      onMouseDown={handleFocus}
      className={cn(
        'window',
        variant === 'ghost' && 'window-ghost',
        variant === 'terminal' && 'window-terminal',
        animateIn && 'animate-window-open',
        isMaximized && 'fixed inset-0 z-[500]',
        className,
      )}
      style={{
        width: isMaximized ? '100%' : width,
        height: isMaximized ? '100%' : height,
      }}
    >
      {/* ── Title Bar ─────────────────────────────────────── */}
      <div
        className="window-titlebar"
        data-active={isActive}
        onDoubleClick={onMaximize}
      >
        {icon && <span className="window-titlebar-icon">{icon}</span>}
        <span className="window-titlebar-text">{title}</span>
        <div className="window-titlebar-buttons">
          {onMinimize && (
            <button
              className="window-titlebar-btn"
              onClick={onMinimize}
              aria-label="Minimize"
              title="Minimize"
            >
              ─
            </button>
          )}
          {onMaximize && (
            <button
              className="window-titlebar-btn"
              onClick={onMaximize}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? '❐' : '□'}
            </button>
          )}
          {onClose && (
            <button
              className="window-titlebar-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Content Area ──────────────────────────────────── */}
      <div
        className={cn(
          'window-content',
          variant === 'terminal' && 'bg-gs-black text-gs-terminal font-data text-data-sm',
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* ── Status Bar ────────────────────────────────────── */}
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

/* ═══════════════════════════════════════════════════════════════
   Sub-components for common window patterns
   ═══════════════════════════════════════════════════════════════ */

/** Module sub-panel rendered inside the Dashboard window */
export interface ModulePanelProps {
  moduleId: string;
  moduleName: string;
  score?: number;
  /** Traffic light: 'green' | 'amber' | 'red' */
  health?: 'green' | 'amber' | 'red';
  /** McKinsey-style action title — the key insight sentence */
  actionTitle?: string;
  /** Whether this is a GhostScan module */
  isGhostModule?: boolean;
  children: ReactNode;
  className?: string;
}

export function ModulePanel({
  moduleId,
  moduleName,
  score,
  health,
  actionTitle,
  isGhostModule = false,
  children,
  className,
}: ModulePanelProps) {
  return (
    <div
      className={cn(
        'module-panel',
        isGhostModule && 'shadow-ghost-glow',
        className,
      )}
      id={`module-${moduleId}`}
    >
      {/* Module header (mini title bar) */}
      <div className="module-panel-header">
        <span className="font-data text-data-xs text-gs-mid-dark">{moduleId}</span>
        <span className="flex-1 truncate">{moduleName}</span>
        {isGhostModule && (
          <span className="text-os-xs text-gs-cyan">👻 GhostScan™</span>
        )}
        {score != null && (
          <span className={cn(
            'font-data text-data-sm font-bold',
            health === 'green' && 'text-gs-terminal',
            health === 'amber' && 'text-gs-warning',
            health === 'red' && 'text-gs-critical',
          )}>
            {score}
          </span>
        )}
        {health && (
          <span className={cn(
            'traffic-dot',
            health === 'green' && 'traffic-dot-green',
            health === 'amber' && 'traffic-dot-amber',
            health === 'red' && 'traffic-dot-red',
          )} />
        )}
      </div>

      {/* Action title (the insight) */}
      {actionTitle && (
        <div className="px-3 py-2 border-b border-gs-mid/30 bg-gs-near-white">
          <p className="font-data text-data-xl text-gs-black leading-snug">
            {actionTitle}
          </p>
        </div>
      )}

      {/* Module content */}
      <div className="module-panel-content">
        {children}
      </div>
    </div>
  );
}

/** Dialog variant — centered modal-like window */
export interface DialogWindowProps extends Omit<WindowProps, 'variant' | 'isMaximized'> {
  /** Whether to show a backdrop behind the dialog */
  showBackdrop?: boolean;
}

export function DialogWindow({
  showBackdrop = true,
  ...props
}: DialogWindowProps) {
  return (
    <>
      {showBackdrop && (
        <div
          className="fixed inset-0 bg-gs-black/30 z-[590]"
          onClick={props.onClose}
        />
      )}
      <div className="fixed inset-0 flex items-center justify-center z-[600] pointer-events-none">
        <div className="pointer-events-auto">
          <Window {...props} variant="dialog" />
        </div>
      </div>
    </>
  );
}
