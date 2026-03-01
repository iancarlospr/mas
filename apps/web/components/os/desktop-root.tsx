'use client';

import type { ReactNode } from 'react';
import { WindowManagerProvider } from '@/lib/window-manager';
import { AuthProvider } from '@/lib/auth-context';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { DesktopShell } from './desktop-shell';
import { MobileGate } from './mobile-gate';

/* =================================================================
   Chloe's Bedroom OS — Desktop Root

   Client component that wraps everything in providers.
   AuthProvider at shell level = single source of truth for auth.
   ChloeReactionsProvider at root = Chloe reacts to everything.
   ================================================================= */

export function DesktopRoot({ children }: { children: ReactNode }) {
  return (
    <WindowManagerProvider>
      <AuthProvider>
        <ChloeReactionsProvider>
          <MobileGate>
            <DesktopShell>
              {children}
            </DesktopShell>
          </MobileGate>
        </ChloeReactionsProvider>
      </AuthProvider>
    </WindowManagerProvider>
  );
}
