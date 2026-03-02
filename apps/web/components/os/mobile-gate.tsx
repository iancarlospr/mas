'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * Chloe's Bedroom OS — Mobile Gate
 *
 * Screen < 1024px: Show gate with option to "Scan anyway."
 * Updated to pink monochrome palette.
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
    <div className="fixed inset-0 bg-gs-void z-[9999] flex flex-col items-center justify-center p-gs-6">
      <div className="noise-grain opacity-[0.03]" aria-hidden="true" />

      <div className="text-center space-y-gs-6 max-w-sm relative">
        <ChloeSprite state="idle" size={128} className="mx-auto" />

        <div className="space-y-gs-3">
          <h1 className="font-display text-display-sm text-gs-base">
            AlphaScan
          </h1>
          <p className="font-data text-data-sm text-gs-mid">
            This is a desktop experience. Open on your computer for the full OS.
          </p>
        </div>

        <div className="bg-gs-deep/80 backdrop-blur-md border border-gs-mid rounded-lg p-gs-4 space-y-gs-3">
          <p className="font-system text-os-sm text-gs-light font-bold">
            Scan anyway?
          </p>
          <form onSubmit={handleScan} className="space-y-gs-2">
            <input
              type="url"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-gs-light/90 border border-gs-mid rounded-lg px-gs-3 py-gs-2 font-data text-[12px] leading-[1.5] outline-none focus:border-gs-base transition-colors select-text"
              style={{ color: 'var(--gs-void)', caretColor: 'currentColor' }}
            />
            <button
              type="submit"
              className="bevel-button-primary w-full"
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : 'Execute Scan'}
            </button>
          </form>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="font-data text-data-xs text-gs-mid hover:text-gs-base underline transition-colors"
        >
          Show desktop anyway
        </button>
      </div>
    </div>
  );
}
