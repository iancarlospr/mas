'use client';

import type { ReactNode } from 'react';
import { WindowManagerProvider } from '@/lib/window-manager';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { DesktopShell } from './desktop-shell';
import { MobileGate } from './mobile-gate';

/* =================================================================
   Chloe's Bedroom OS — Desktop Root

   Client component that wraps everything in providers.
   ChloeReactionsProvider at root = Chloe reacts to everything.
   ================================================================= */

export function DesktopRoot({ children }: { children: ReactNode }) {
  return (
    <WindowManagerProvider>
      <ChloeReactionsProvider>
        <MobileGate>
          <DesktopShell>
            {children}
          </DesktopShell>
        </MobileGate>
      </ChloeReactionsProvider>
    </WindowManagerProvider>
  );
}
