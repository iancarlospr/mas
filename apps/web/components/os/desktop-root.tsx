'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WindowManagerProvider } from '@/lib/window-manager';
import { AuthProvider } from '@/lib/auth-context';
import { ScanOrchestratorProvider } from '@/lib/scan-orchestrator';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { DesktopShell } from './desktop-shell';
import { MobileGate } from './mobile-gate';

/* =================================================================
   Chloé's Bedroom OS — Desktop Root

   Client component that wraps everything in providers.
   AuthProvider at shell level = single source of truth for auth.
   ChloeReactionsProvider at root = Chloé reacts to everything.

   Standalone routes (legal pages) bypass the desktop shell entirely.
   ================================================================= */

const STANDALONE_ROUTES = ['/privacy', '/terms', '/cookies', '/contact', '/report'];

export function DesktopRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_ROUTES.some((r) => pathname.startsWith(r));

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <WindowManagerProvider>
      <AuthProvider>
        <ScanOrchestratorProvider>
          <ChloeReactionsProvider>
            <MobileGate>
              <DesktopShell>
                {children}
              </DesktopShell>
            </MobileGate>
          </ChloeReactionsProvider>
        </ScanOrchestratorProvider>
      </AuthProvider>
    </WindowManagerProvider>
  );
}
