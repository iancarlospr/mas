'use client';

import { useState, useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { WindowManagerProvider } from '@/lib/window-manager';
import { AuthProvider } from '@/lib/auth-context';
import { ScanOrchestratorProvider } from '@/lib/scan-orchestrator';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { MobileGate } from './mobile-gate';

/* =================================================================
   Chloé's Bedroom OS — Desktop Root

   Client component that wraps everything in providers.
   AuthProvider at shell level = single source of truth for auth.
   ChloeReactionsProvider at root = Chloé reacts to everything.

   On mobile (<1024px), DesktopShell is never loaded or rendered.
   Its JS bundle is code-split via next/dynamic and only fetched
   when the viewport is desktop-sized.

   Standalone routes (legal pages) bypass the desktop shell entirely.
   ================================================================= */

const DesktopShell = dynamic(
  () => import('./desktop-shell').then((m) => ({ default: m.DesktopShell })),
  { ssr: false },
);

const STANDALONE_ROUTES = ['/privacy', '/terms', '/cookies', '/contact', '/report'];

export function DesktopRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
              {isMobile ? children : <DesktopShell>{children}</DesktopShell>}
            </MobileGate>
          </ChloeReactionsProvider>
        </ScanOrchestratorProvider>
      </AuthProvider>
    </WindowManagerProvider>
  );
}
