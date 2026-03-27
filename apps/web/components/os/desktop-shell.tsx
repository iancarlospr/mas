'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { Taskbar } from './taskbar';
import { DesktopIconGrid } from './desktop-icon-grid';
import { StaticWindowRenderer } from './static-window-renderer';
import { ContextMenu, type ContextMenuItem } from './context-menu';
import { BedroomWallpaper } from './bedroom-wallpaper';
import { ChloeScreenmate } from '@/components/chloe/chloe-screenmate';
import { useWindowManager, type WindowConfig } from '@/lib/window-manager';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { BedroomIcon } from './bedroom-icons';
import { analytics } from '@/lib/analytics';

/* =================================================================
   Chloé's Bedroom OS — Desktop Shell

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
/** Initial sizes — auto-sizer will snap to actual content on open */
const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  'about':         { title: 'About AlphaScan',                 icon: '~', width: 480, height: 520 },
  'products':      { title: 'Products',                        icon: '~', width: 560, height: 580 },
  'pricing':       { title: 'Pricing',                         icon: '~', width: 700, height: 560 },
  'customers':     { title: 'Reviews',                         icon: '~', width: 440, height: 560 },
  'chill':         { title: 'chill.mov',                       icon: '~', width: 820, height: 500, variant: 'terminal' },
  'history':       { title: 'My Scans',                        icon: '~', width: 600, height: 400 },
  'chat-launcher': { title: 'GhostChat\u2122',                       icon: '~', width: 420, height: 380 },
  'scan-input':    { title: 'Scan.exe',                        icon: '~', width: 600, height: 380, variant: 'dialog' },
  'features':      { title: 'Why AlphaScan?',                  icon: '~', width: 540, height: 400 },
  'blog':          { title: 'UnderTheStack',                   icon: '~', width: 560, height: 520 },
  'games':         { title: 'Ghost Sweeper',                   icon: '~', width: 320, height: 420, minWidth: 320, minHeight: 420 },
  'trash':         { title: 'Log Out',                         icon: '~', width: 340, height: 240 },
  'auth':          { title: 'auth.exe',                       icon: '~', width: 440, height: 480, variant: 'dialog' },
  'profile':       { title: 'Profile',                        icon: '~', width: 480, height: 520 },
  'beta-tracker':  { title: 'Mission Control',                icon: '~', width: 820, height: 600, variant: 'terminal' },
};

export function DesktopShell({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const orchestrator = useScanOrchestrator();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Mark body so globals.css print rules only apply to desktop OS
  useEffect(() => {
    document.body.classList.add('gs-desktop');
    return () => document.body.classList.remove('gs-desktop');
  }, []);

  // Register all static window configs on mount
  useEffect(() => {
    for (const [id, config] of Object.entries(WINDOW_CONFIGS)) {
      wm.registerWindow(id, {
        ...config,
        icon: <BedroomIcon windowId={id} size={14} />,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track beta invite link click (once per session)
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)__alphascan_invite=([^;]+)/);
    if (match) {
      const code = decodeURIComponent(match[1]!);
      if (code && !sessionStorage.getItem('invite_tracked')) {
        analytics.betaInviteClicked(code);
        sessionStorage.setItem('invite_tracked', '1');
      }
    }
  }, []);

  // Open Scan.exe centered after registration
  useEffect(() => {
    const timer = setTimeout(() => {
      wm.openWindow('scan-input');
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = WINDOW_CONFIGS['scan-input']!.width ?? 600;
      const h = WINDOW_CONFIGS['scan-input']!.height ?? 380;
      wm.moveWindow('scan-input', Math.round((vw - w) / 2), Math.round(vh * 0.05));
    }, 100);
    return () => clearTimeout(timer);
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

      // Secret: Ctrl+Shift+B → Mission Control (beta tracker)
      if (meta && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        wm.openWindow('beta-tracker');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wm]);

  // Handle URL params: ?payment_success={scanId} or ?open_scan={scanId}
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const paymentScanId = params.get('payment_success');
    if (paymentScanId) {
      window.history.replaceState({}, '', '/');
      // Delay to give Stripe webhook time to update tier
      setTimeout(() => {
        orchestrator.openScanWindow(paymentScanId, '');
      }, 1500);
      return;
    }

    // Credits purchased from pricing page (no specific scan)
    const creditsPurchased = params.get('credits_purchased');
    if (creditsPurchased) {
      window.history.replaceState({}, '', '/');
      // Open scan-input so user can use their credits
      wm.openWindow('scan-input');
      return;
    }

    const openScanId = params.get('open_scan');
    if (openScanId) {
      window.history.replaceState({}, '', '/');
      orchestrator.openScanWindow(openScanId, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-desktop-shell
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

      {/* Desktop Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Desktop Icons — two columns */}
        <DesktopIconGrid />

        {/* Static windows (opened by icon double-click) */}
        <StaticWindowRenderer />

        {/* Route-based windows (from Next.js children) */}
        {children}

        {/* Chloé screenmate — living desktop pet */}
        <ChloeScreenmate active suppressed={wm.hasOpenScanReport || orchestrator.isVisualSequenceActive} />
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
