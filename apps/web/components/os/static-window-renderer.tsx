'use client';

import { lazy, Suspense } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { ManagedWindow } from './managed-window';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Window Renderer

   Renders two kinds of windows:
   1. Static — fixed ID, hardcoded in WINDOW_COMPONENTS map
   2. Dynamic — runtime IDs (e.g., scan-{uuid}), resolved via
      componentType field in WindowState

   Content components are lazy-loaded to avoid blocking initial load.
   ═══════════════════════════════════════════════════════════════ */

// Lazy-loaded static window content components
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

// Lazy-loaded dynamic window content components (resolved by componentType)
const ScanReportWindow = lazy(() => import('@/components/windows/scan-report-window'));
const PaymentWindow = lazy(() => import('@/components/windows/payment-window'));

/** Static windows — keyed by exact window ID */
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

/** Dynamic windows — keyed by componentType, accepts windowId prop */
const DYNAMIC_WINDOW_COMPONENTS: Record<string, React.ComponentType<{ windowId: string }>> = {
  'scan-report': ScanReportWindow,
  'payment': PaymentWindow,
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
          // Static window — exact ID match
          const StaticComponent = WINDOW_COMPONENTS[w.id];
          if (StaticComponent) {
            return (
              <ManagedWindow key={w.id} id={w.id}>
                <Suspense fallback={<WindowLoadingFallback />}>
                  <StaticComponent />
                </Suspense>
              </ManagedWindow>
            );
          }

          // Dynamic window — resolve by componentType
          const DynamicComponent = w.componentType
            ? DYNAMIC_WINDOW_COMPONENTS[w.componentType]
            : undefined;
          if (DynamicComponent) {
            return (
              <ManagedWindow key={w.id} id={w.id}>
                <Suspense fallback={<WindowLoadingFallback />}>
                  <DynamicComponent windowId={w.id} />
                </Suspense>
              </ManagedWindow>
            );
          }

          return null;
        })}
    </>
  );
}
