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

    let url = searchParams.get('auto_scan') ?? null;

    if (!url) {
      try {
        const stored = localStorage.getItem('alphascan_pending_url');
        if (stored) {
          const parsed = JSON.parse(stored) as { url: string; timestamp: number };
          if (Date.now() - parsed.timestamp < TTL_MS) {
            url = parsed.url;
          }
          localStorage.removeItem('alphascan_pending_url');
        }
      } catch { /* ignore */ }
    }

    if (!url) return;

    triggeredRef.current = true;

    try { localStorage.removeItem('alphascan_pending_url'); } catch { /* */ }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('auto_scan');
    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);

    setStatus('scanning');

    fetch('/api/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, turnstileToken: '', autoScan: true }),
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
      <div className="bevel-raised bg-gs-red/10 p-gs-4 mb-gs-4 flex items-center gap-gs-3">
        <span className="font-data text-data-sm text-gs-red animate-pulse">⏳</span>
        <span className="font-data text-data-sm text-gs-ink">Starting your scan...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bevel-raised bg-gs-critical/10 p-gs-4 mb-gs-4">
        <p className="font-data text-data-sm text-gs-critical">{errorMsg}</p>
      </div>
    );
  }

  return null;
}
