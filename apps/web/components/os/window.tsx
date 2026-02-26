'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';

/* =================================================================
   Chloe's Bedroom OS — Window Component

   The foundational UI unit. Everything is a window.
   4 variants: default, terminal, ghost, dialog

   Frosted glass chrome with colored dots (close/min/max).
   ================================================================= */

export interface WindowProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  variant?: 'default' | 'terminal' | 'ghost' | 'dialog';
  isActive?: boolean;
  isMaximized?: boolean;
  showStatusBar?: boolean;
  statusBarContent?: ReactNode;
  animateIn?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  className?: string;
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
      data-active={isActive}
      onMouseDown={handleFocus}
      className={cn(
        'window',
        variant === 'ghost' && 'window-ghost',
        variant === 'terminal' && 'window-terminal',
        animateIn && 'animate-window-open',
        isMaximized && 'fixed inset-0 z-[500] !rounded-none',
        className,
      )}
      style={{
        width: isMaximized ? '100%' : width,
        height: isMaximized ? '100%' : height,
      }}
    >
      {/* -- Title Bar ----------------------------------------- */}
      <div
        className="window-titlebar"
        data-active={isActive}
        onDoubleClick={onMaximize}
      >
        {/* Colored dots: close, minimize, maximize (macOS order) */}
        <div className="window-titlebar-buttons">
          {onClose && (
            <button
              className="window-titlebar-btn"
              data-action="close"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            />
          )}
          {onMinimize && (
            <button
              className="window-titlebar-btn"
              data-action="minimize"
              onClick={onMinimize}
              aria-label="Minimize"
              title="Minimize"
            />
          )}
          {onMaximize && (
            <button
              className="window-titlebar-btn"
              data-action="maximize"
              onClick={onMaximize}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              title={isMaximized ? 'Restore' : 'Maximize'}
            />
          )}
        </div>
        {icon && <span className="window-titlebar-icon">{icon}</span>}
        <span className="window-titlebar-text">{title}</span>
      </div>

      {/* -- Content Area -------------------------------------- */}
      <div
        className={cn(
          'window-content',
          variant === 'terminal' && 'bg-[#0A0A0A] text-gs-terminal font-data text-data-sm',
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* -- Status Bar ---------------------------------------- */}
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

/* =================================================================
   Sub-components for common window patterns
   ================================================================= */

export interface ModulePanelProps {
  moduleId: string;
  moduleName: string;
  score?: number;
  health?: 'green' | 'amber' | 'red';
  actionTitle?: string;
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
      <div className="module-panel-header">
        <span className="font-data text-data-xs text-gs-mid">{moduleId}</span>
        <span className="flex-1 truncate">{moduleName}</span>
        {isGhostModule && (
          <span className="text-os-xs text-gs-base">GhostScan</span>
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

      {actionTitle && (
        <div className="px-3 py-2 border-b border-gs-mid/30">
          <p className="font-data text-data-xl text-gs-light leading-snug">
            {actionTitle}
          </p>
        </div>
      )}

      <div className="module-panel-content">
        {children}
      </div>
    </div>
  );
}

export interface DialogWindowProps extends Omit<WindowProps, 'variant' | 'isMaximized'> {
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
          className="fixed inset-0 bg-gs-void/60 backdrop-blur-sm z-[590]"
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
