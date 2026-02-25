'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Mobile Gate
 *
 * Screen < 1024px: Show gate with option to "Scan anyway."
 * The desktop OS metaphor requires a large screen.
 * Mobile users can still scan — they just can't use the OS.
 */

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [scanUrl, setScanUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleScan = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl.trim() || scanning) return;

    setScanning(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scanUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/scan/${data.id}`);
      }
    } catch {
      setScanning(false);
    }
  }, [scanUrl, scanning, router]);

  if (!isMobile || dismissed) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-gs-paper z-[9999] flex flex-col items-center justify-center p-gs-6">
      <div className="noise-grain opacity-[0.02]" aria-hidden="true" />

      <div className="text-center space-y-gs-6 max-w-sm">
        <ChloeSprite state="idle" size={128} className="mx-auto" />

        <div className="space-y-gs-3">
          <h1 className="font-display text-display-sm text-gs-ink">
            GhostScan OS
          </h1>
          <p className="font-data text-data-sm text-gs-muted">
            This is a desktop experience. Open on your computer for the full OS.
          </p>
        </div>

        <div className="bevel-raised bg-gs-chrome p-gs-4 space-y-gs-3">
          <p className="font-system text-os-sm text-gs-ink font-bold">
            Scan anyway?
          </p>
          <form onSubmit={handleScan} className="space-y-gs-2">
            <input
              type="url"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bevel-sunken bg-gs-paper px-gs-3 py-gs-2 font-data text-data-sm text-gs-ink outline-none"
            />
            <button
              type="submit"
              className="bevel-button-primary w-full"
              disabled={scanning}
            >
              {scanning ? '⏳ Scanning...' : '▶ Execute Scan'}
            </button>
          </form>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="font-data text-data-xs text-gs-muted hover:text-gs-red underline"
        >
          Show desktop anyway
        </button>
      </div>
    </div>
  );
}
