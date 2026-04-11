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

const STANDALONE_ROUTES = ['/privacy', '/terms', '/cookies', '/contact', '/report', '/brand'];

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

  // Detect blog routes — /blog (list) and /blog/<slug> (detail)
  // These should open the blog window inside the desktop OS instead of
  // rendering the page content behind the shell.
  const blogMatch = pathname.match(/^\/blog(?:\/([^/]+))?\/?$/);
  const blogRouteActive = !!blogMatch;
  const initialBlogSlug = blogMatch?.[1] ?? null;

  // After hydration, suppress children on blog routes so the blog page
  // content doesn't bleed through behind the shell. SSR still renders
  // the children (good for crawlers / OG metadata), then the client flips
  // this flag in useEffect to avoid a hydration mismatch.
  const [suppressChildren, setSuppressChildren] = useState(false);
  useEffect(() => {
    if (blogRouteActive) setSuppressChildren(true);
    else setSuppressChildren(false);
  }, [blogRouteActive]);

  if (isStandalone) {
    return <>{children}</>;
  }

  const shellChildren = suppressChildren ? null : children;

  return (
    <WindowManagerProvider>
      <AuthProvider>
        <ScanOrchestratorProvider>
          <ChloeReactionsProvider>
            <MobileGate initialBlogSlug={initialBlogSlug} blogRouteActive={blogRouteActive}>
              {isMobile ? shellChildren : (
                <DesktopShell initialBlogSlug={initialBlogSlug} blogRouteActive={blogRouteActive}>
                  {shellChildren}
                </DesktopShell>
              )}
            </MobileGate>
          </ChloeReactionsProvider>
        </ScanOrchestratorProvider>
      </AuthProvider>
    </WindowManagerProvider>
  );
}
