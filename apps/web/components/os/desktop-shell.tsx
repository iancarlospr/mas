'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { MenuBar } from './menu-bar';
import { Taskbar } from './taskbar';
import { DesktopIconGrid } from './desktop-icon-grid';
import { StaticWindowRenderer } from './static-window-renderer';
import { ContextMenu, type ContextMenuItem } from './context-menu';
import { BedroomWallpaper } from './bedroom-wallpaper';
import { ChloeScreenmate } from '@/components/chloe/chloe-screenmate';
import { useWindowManager, type WindowConfig } from '@/lib/window-manager';
import { BedroomIcon } from './bedroom-icons';

/* =================================================================
   Chloe's Bedroom OS — Desktop Shell

   The root desktop environment. Renders at the root layout level
   and persists across all Next.js navigations. Contains:
   - Bedroom wallpaper (subtle illustrated bedroom)
   - Menu bar (top, frosted glass)
   - Desktop icons (SVG bedroom objects)
   - Static windows (context-managed, opened by icon double-click)
   - Route-based windows (Next.js children)
   - Taskbar (bottom, frosted glass)
   - Context menu (frosted glass)
   ================================================================= */

/** Desktop icon window configurations — icons are now SVG IDs */
const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  'about':         { title: 'About AlphaScan',                 icon: '~', width: 600, height: 500 },
  'products':      { title: 'Products',                        icon: '~', width: 700, height: 500 },
  'pricing':       { title: 'Pricing',                         icon: '~', width: 650, height: 600 },
  'customers':     { title: 'Customers',                       icon: '~', width: 400, height: 350 },
  'chill':         { title: 'chill.mov',                       icon: '~', width: 640, height: 480, variant: 'terminal' },
  'history':       { title: 'My Scans',                        icon: '~', width: 600, height: 500 },
  'chat-launcher': { title: 'GhostChat',                       icon: '~', width: 400, height: 400 },
  'scan-input':    { title: 'Scan.exe',                        icon: '~', width: 450, height: 280, variant: 'dialog', minHeight: 200 },
  'features':      { title: 'Why AlphaScan?',                  icon: '~', width: 550, height: 450 },
  'blog':          { title: 'Blog',                            icon: '~', width: 600, height: 500 },
  'games':         { title: 'Ghost Sweeper',                   icon: '~', width: 320, height: 420, minWidth: 320, minHeight: 420 },
  'trash':         { title: 'Trash',                           icon: '~', width: 350, height: 250 },
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
      // Set icon to the SVG bedroom icon ReactNode
      wm.registerWindow(id, {
        ...config,
        icon: <BedroomIcon windowId={id} size={14} />,
      });
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
          { label: 'About AlphaScan', onClick: () => { wm.openWindow('about'); setContextMenu(null); } },
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

      if (meta && e.key === 'n') {
        e.preventDefault();
        wm.openWindow('scan-input');
      }

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
      className="fixed inset-0 flex flex-col bg-gs-void overflow-hidden select-none"
      role="application"
      aria-label="AlphaScan Desktop"
      onClick={handleDesktopClick}
      onContextMenu={handleDesktopRightClick}
    >
      {/* Bedroom wallpaper — subtle illustrated background */}
      <BedroomWallpaper />

      {/* Noise grain texture — barely visible */}
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

        {/* Chloe screenmate — living desktop pet */}
        <ChloeScreenmate active />
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
