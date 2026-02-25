'use client';

import type { ReactNode } from 'react';
import { WindowManagerProvider } from '@/lib/window-manager';
import { DesktopShell } from './desktop-shell';
import { MobileGate } from './mobile-gate';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Desktop Root

   Client component that wraps everything in WindowManagerProvider
   + DesktopShell. Sits at the root layout level.
   ═══════════════════════════════════════════════════════════════ */

export function DesktopRoot({ children }: { children: ReactNode }) {
  return (
    <WindowManagerProvider>
      <MobileGate>
        <DesktopShell>
          {children}
        </DesktopShell>
      </MobileGate>
    </WindowManagerProvider>
  );
}
