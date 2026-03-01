'use client';

import { lazy, Suspense } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { ManagedWindow } from './managed-window';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Static Window Renderer

   Reads all windows from WindowManagerProvider context.
   For each open, non-minimized, non-route window, renders the
   corresponding content component inside a ManagedWindow.

   Content components are lazy-loaded — they contain marketing
   copy and heavy components that shouldn't block initial load.
   ═══════════════════════════════════════════════════════════════ */

// Lazy-loaded window content components
const AboutWindow = lazy(() => import('@/components/windows/about-window'));
const ProductsWindow = lazy(() => import('@/components/windows/products-window'));
const PricingWindow = lazy(() => import('@/components/windows/pricing-window'));
const CustomersWindow = lazy(() => import('@/components/windows/customers-window'));
const ChillWindow = lazy(() => import('@/components/windows/chill-window'));
const HistoryWindow = lazy(() => import('@/components/windows/history-window'));
const ChatLauncherWindow = lazy(() => import('@/components/windows/chat-launcher-window'));
const ScanInputWindow = lazy(() => import('@/components/windows/scan-input-window'));
const FeaturesWindow = lazy(() => import('@/components/windows/features-window'));
const BlogWindow = lazy(() => import('@/components/windows/blog-window'));
const GamesWindow = lazy(() => import('@/components/windows/games-window'));
const TrashWindow = lazy(() => import('@/components/windows/trash-window'));
const AuthWindow = lazy(() => import('@/components/windows/auth-window'));
const ProfileWindow = lazy(() => import('@/components/windows/profile-window'));

const WINDOW_COMPONENTS: Record<string, React.ComponentType> = {
  'about': AboutWindow,
  'products': ProductsWindow,
  'pricing': PricingWindow,
  'customers': CustomersWindow,
  'chill': ChillWindow,
  'history': HistoryWindow,
  'chat-launcher': ChatLauncherWindow,
  'scan-input': ScanInputWindow,
  'features': FeaturesWindow,
  'blog': BlogWindow,
  'games': GamesWindow,
  'trash': TrashWindow,
  'auth': AuthWindow,
  'profile': ProfileWindow,
};

function WindowLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full p-gs-8">
      <div className="font-system text-os-base text-gs-muted animate-blink">
        Loading...
      </div>
    </div>
  );
}

export function StaticWindowRenderer() {
  const { visibleWindows } = useWindowManager();

  return (
    <>
      {visibleWindows
        .filter((w) => !w.isRouteWindow)
        .map((w) => {
          const ContentComponent = WINDOW_COMPONENTS[w.id];
          if (!ContentComponent) return null;

          return (
            <ManagedWindow key={w.id} id={w.id}>
              <Suspense fallback={<WindowLoadingFallback />}>
                <ContentComponent />
              </Suspense>
            </ManagedWindow>
          );
        })}
    </>
  );
}
