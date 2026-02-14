'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const CHANNEL_NAME = 'alphascan_auth';

export function VerifiedContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect_to') ?? '/history';

  useEffect(() => {
    // Signal the original tab (verify page) that verification succeeded
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'verified', redirectTo });
      setTimeout(() => channel.close(), 2000);
    } catch {
      // BroadcastChannel not supported — fallback via localStorage
      try {
        localStorage.setItem('alphascan_email_verified', JSON.stringify({
          redirectTo,
          timestamp: Date.now(),
        }));
      } catch { /* */ }
    }
  }, [redirectTo]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="font-heading text-h3 text-primary mb-2">Email verified</h1>
        <p className="text-muted text-sm mb-6">
          Your account is confirmed. Go back to your original tab — your scan will start automatically.
        </p>
        <p className="text-muted text-xs mb-6">You can close this tab.</p>

        <Link
          href={redirectTo}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Or continue here instead
        </Link>
      </div>
    </div>
  );
}
