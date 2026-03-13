'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '/ingest',
    ui_host: 'https://us.posthog.com',
    capture_pageview: false, // we capture manually below
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: { password: true, email: false },
    },
    autocapture: {
      capture_copied_text: true,
    },
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      const search = searchParams.toString();
      if (search) url += '?' + search;
      ph.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  // Global error tracking
  useEffect(() => {
    if (!ph) return;

    const handleError = (event: ErrorEvent) => {
      ph.capture('$exception', {
        $exception_message: event.message,
        $exception_type: event.error?.name ?? 'Error',
        $exception_stack_trace_raw: event.error?.stack,
        $exception_source: event.filename,
        $exception_lineno: event.lineno,
        $exception_colno: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      ph.capture('$exception', {
        $exception_message: err?.message ?? String(err),
        $exception_type: err?.name ?? 'UnhandledRejection',
        $exception_stack_trace_raw: err?.stack,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
