'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { MenuBar } from './menu-bar';
import { Taskbar } from './taskbar';
import { DesktopIconGrid } from './desktop-icon-grid';
import { StaticWindowRenderer } from './static-window-renderer';
import { ContextMenu, type ContextMenuItem } from './context-menu';
import { useWindowManager, type WindowConfig } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Desktop Shell

   The root desktop environment. Renders at the root layout level
   and persists across all Next.js navigations. Contains:
   - Paper grain texture (subtle, warm)
   - Menu bar (top, Mac OS 9 style)
   - Desktop icons (two columns, left + right)
   - Static windows (context-managed, opened by icon double-click)
   - Route-based windows (Next.js children)
   - Taskbar (bottom, Win95 style)
   - Context menu (right-click)

   CRT scanlines and vignette are NOT used on the desktop.
   Those effects are scoped to the scan sequence terminal only.
   ═══════════════════════════════════════════════════════════════ */

/** Desktop icon window configurations */
const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  'about':         { title: 'About GhostScan OS',             icon: '📋', width: 600, height: 500 },
  'products':      { title: 'Products',                       icon: '📁', width: 700, height: 500 },
  'pricing':       { title: 'Pricing — Choose Your Edition',  icon: '🧮', width: 650, height: 600 },
  'customers':     { title: 'Customers',                      icon: '👥', width: 400, height: 350 },
  'chill':         { title: 'chill.mov — ASCII Theater',      icon: '🎬', width: 640, height: 480, variant: 'terminal' },
  'history':       { title: '📁 My Scans',                    icon: '📚', width: 600, height: 500 },
  'chat-launcher': { title: '💬 GhostChat',                   icon: '💬', width: 400, height: 400 },
  'scan-input':    { title: 'Scan.exe — Enter URL',           icon: '🔗', width: 450, height: 280, variant: 'dialog', minHeight: 200 },
  'features':      { title: '❓ Why AlphaScan?',               icon: '❓', width: 550, height: 450 },
  'blog':          { title: '📖 Blog — UnderTheStack',        icon: '📖', width: 600, height: 500 },
  'games':         { title: '🏆 Ghost Sweeper',               icon: '🏆', width: 320, height: 420, minWidth: 320, minHeight: 420 },
  'trash':         { title: '🗑️ Trash',                       icon: '🗑️', width: 350, height: 250 },
};

export function DesktopShell({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Register all static window configs on mount
  useEffect(() => {
    for (const [id, config] of Object.entries(WINDOW_CONFIGS)) {
      wm.registerWindow(id, config);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDesktopRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: 'New Scan...', onClick: () => { wm.openWindow('scan-input'); setContextMenu(null); } },
          { label: 'Refresh', onClick: () => { window.location.reload(); setContextMenu(null); } },
          { type: 'separator' },
          { label: 'Arrange Icons', onClick: () => setContextMenu(null) },
          { label: 'Properties', onClick: () => setContextMenu(null) },
          { type: 'separator' },
          { label: 'About GhostScan OS', onClick: () => { wm.openWindow('about'); setContextMenu(null); } },
        ],
      });
    },
    [wm],
  );

  const handleDesktopClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+N — New Scan
      if (meta && e.key === 'n') {
        e.preventDefault();
        wm.openWindow('scan-input');
      }

      // Alt+F4 — Close active window
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        if (wm.activeWindowId) {
          wm.closeWindow(wm.activeWindowId);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wm]);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-gs-paper overflow-hidden select-none"
      role="application"
      aria-label="GhostScan OS Desktop"
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopRightClick}
    >
      {/* Paper grain texture — barely visible, warm */}
      <div className="noise-grain" aria-hidden="true" />

      {/* Menu Bar (top) */}
      <MenuBar />

      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Desktop Icons — two columns */}
        <DesktopIconGrid />

        {/* Static windows (opened by icon double-click) */}
        <StaticWindowRenderer />

        {/* Route-based windows (from Next.js children) */}
        {children}
      </div>

      {/* Taskbar (bottom) */}
      <Taskbar />

      {/* Context Menu */}
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
