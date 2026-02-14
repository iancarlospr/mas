'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const TTL_MS = 60 * 60 * 1000; // 1 hour

export function AutoScanTrigger() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (triggeredRef.current) return;

    // Check URL param first, then localStorage fallback
    let url = searchParams.get('auto_scan') ?? null;

    if (!url) {
      try {
        const stored = localStorage.getItem('alphascan_pending_url');
        if (stored) {
          const parsed = JSON.parse(stored) as { url: string; timestamp: number };
          if (Date.now() - parsed.timestamp < TTL_MS) {
            url = parsed.url;
          }
          // Always clear stale entries
          localStorage.removeItem('alphascan_pending_url');
        }
      } catch {
        // ignore
      }
    }

    if (!url) return;

    triggeredRef.current = true;

    // Clear localStorage and strip auto_scan from URL
    try { localStorage.removeItem('alphascan_pending_url'); } catch {}

    // Remove auto_scan param from URL without triggering navigation
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('auto_scan');
    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);

    // Start scan
    setStatus('scanning');

    fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, turnstileToken: '' }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to start scan');
        }
        return res.json();
      })
      .then(({ scanId }) => {
        router.push(`/scan/${scanId}`);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to start scan');
      });
  }, [searchParams, router]);

  if (status === 'scanning') {
    return (
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-6 mb-6 flex items-center gap-4">
        <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium text-primary">Starting your scan...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-error/10 border border-error/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-error font-medium">{errorMsg}</p>
      </div>
    );
  }

  return null;
}
