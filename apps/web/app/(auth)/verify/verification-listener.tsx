'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const CHANNEL_NAME = 'alphascan_auth';
const POLL_INTERVAL_MS = 3000;

interface Props {
  scanUrl?: string;
}

/**
 * Invisible component that listens for email verification from another tab.
 * Uses BroadcastChannel as primary mechanism, localStorage polling as fallback.
 * When verification is detected, redirects this tab to start the scan.
 */
export function VerificationListener({ scanUrl }: Props) {
  const router = useRouter();
  const redirectedRef = useRef(false);

  const buildRedirect = (fallback?: string) => {
    const target = fallback ?? (scanUrl
      ? `/history?auto_scan=${encodeURIComponent(scanUrl)}`
      : '/history');
    return target;
  };

  const handleVerified = (redirectTo?: string) => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    // Clean up
    try { localStorage.removeItem('alphascan_pending_verification'); } catch { /* */ }
    try { localStorage.removeItem('alphascan_email_verified'); } catch { /* */ }

    router.push(buildRedirect(redirectTo));
    router.refresh();
  };

  useEffect(() => {
    // Primary: BroadcastChannel (instant cross-tab messaging)
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === 'verified') {
          handleVerified(event.data.redirectTo);
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    // Fallback: poll localStorage for the signal (set by /auth/verified)
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem('alphascan_email_verified');
        if (raw) {
          const data = JSON.parse(raw);
          handleVerified(data.redirectTo);
        }
      } catch { /* */ }
    }, POLL_INTERVAL_MS);

    return () => {
      channel?.close();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
