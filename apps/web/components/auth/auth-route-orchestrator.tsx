'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWindowManager } from '@/lib/window-manager';
import { useViewport } from '@/hooks/use-viewport';
import { AuthForm } from './auth-form';

/* ═══════════════════════════════════════════════════════════════
   Auth Route Orchestrator

   Bridge between Next.js routes (/login, /register) and the
   desktop OS window system.

   Desktop: opens the auth managed window, renders nothing.
   Mobile:  renders the full-screen auth form directly.
   ═══════════════════════════════════════════════════════════════ */

interface AuthRouteOrchestratorProps {
  mode: 'login' | 'register';
}

export function AuthRouteOrchestrator({ mode }: AuthRouteOrchestratorProps) {
  const viewport = useViewport();
  const wm = useWindowManager();
  const searchParams = useSearchParams();

  // Desktop: open the auth window and render nothing
  useEffect(() => {
    if (viewport !== 'desktop') return;

    const tab = mode === 'register' ? 'register' : 'sign-in';
    const scanUrl = searchParams.get('scan_url') ?? undefined;
    const redirect = searchParams.get('redirect') ?? undefined;

    wm.openWindow('auth', { tab, scanUrl, redirect });
  }, [viewport, mode, wm, searchParams]);

  // Desktop renders nothing — the managed window is visible
  if (viewport === 'desktop') {
    return null;
  }

  // Mobile: render the full-screen auth form
  return <AuthForm mode={mode} />;
}
