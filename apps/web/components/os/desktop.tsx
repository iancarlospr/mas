'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { MenuBar } from './menu-bar';
import { Taskbar } from './taskbar';
import { DesktopIcon } from './desktop-icon';
import { ContextMenu, type ContextMenuItem } from './context-menu';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Desktop Environment

   The full-viewport canvas that IS the app. Contains:
   - Noise grain + CRT scanline overlays (atmospheric)
   - Menu bar (top, Mac OS 9 style)
   - Desktop icons (clickable programs)
   - Windows (children rendered here)
   - Taskbar (bottom, Win95 style)
   - Chloé screenmate (rendered as child)
   ═══════════════════════════════════════════════════════════════ */

export interface DesktopProgram {
  id: string;
  label: string;
  icon: ReactNode;
  /** Whether the program is currently open */
  isOpen?: boolean;
  /** Callback when icon double-clicked */
  onOpen: () => void;
}

export interface DesktopProps {
  /** Programs available on the desktop (shown as icons + in taskbar) */
  programs: DesktopProgram[];
  /** Open window content — rendered in the desktop area */
  children: ReactNode;
  /** Chloé screenmate component — rendered on top of everything */
  chloe?: ReactNode;
  /** Current time (for taskbar clock) */
  currentTime?: string;
  /** Volume enabled */
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
  /** Menu bar actions */
  onNewScan?: () => void;
  onViewHistory?: () => void;
  onSettings?: () => void;
}

export function Desktop({
  programs,
  children,
  chloe,
  currentTime,
  audioEnabled = false,
  onToggleAudio,
  onNewScan,
  onViewHistory,
  onSettings,
}: DesktopProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const handleDesktopRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: 'New Scan...', onClick: () => { onNewScan?.(); setContextMenu(null); } },
          { label: 'Refresh', onClick: () => { window.location.reload(); setContextMenu(null); } },
          { type: 'separator' } as const,
          { label: 'Arrange Icons', onClick: () => setContextMenu(null) },
          { label: 'Properties', onClick: () => { onSettings?.(); setContextMenu(null); } },
          { type: 'separator' } as const,
          { label: 'About GhostScan OS', onClick: () => setContextMenu(null) },
        ],
      });
    },
    [onNewScan, onSettings],
  );

  const handleDesktopClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-gs-near-white overflow-hidden select-none"
      role="application"
      aria-label="GhostScan OS Desktop"
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopRightClick}
    >
      {/* ── Atmospheric Overlays ─────────────────────────── */}
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-vignette" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      {/* ── Menu Bar (Top) ───────────────────────────────── */}
      <MenuBar
        audioEnabled={audioEnabled}
        onToggleAudio={onToggleAudio}
        onNewScan={onNewScan}
        onViewHistory={onViewHistory}
        onSettings={onSettings}
        currentTime={currentTime}
      />

      {/* ── Desktop Area ─────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Desktop Icons */}
        <div className="absolute inset-0 p-gs-4 z-icons">
          <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-gs-4 content-start">
            {programs.map((program) => (
              <DesktopIcon
                key={program.id}
                label={program.label}
                icon={program.icon}
                onDoubleClick={program.onOpen}
              />
            ))}
          </div>
        </div>

        {/* Windows + Content */}
        <div className="absolute inset-0 z-window pointer-events-none">
          <div className="pointer-events-auto">
            {children}
          </div>
        </div>

        {/* Chloé Screenmate (above windows) */}
        {chloe && (
          <div className="absolute inset-0 z-chloe pointer-events-none">
            <div className="pointer-events-auto">
              {chloe}
            </div>
          </div>
        )}
      </div>

      {/* ── Taskbar (Bottom) ─────────────────────────────── */}
      <Taskbar
        programs={programs}
        currentTime={currentTime}
        audioEnabled={audioEnabled}
        onToggleAudio={onToggleAudio}
      />

      {/* ── Context Menu ─────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
