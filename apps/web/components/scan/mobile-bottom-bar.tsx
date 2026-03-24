'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * GhostScan Mobile — Bottom Bar
 * Free tier: full-width "Unlock — from $24.99" CTA.
 * Paid tier: Dashboard | Chat | Report navigation.
 */
interface MobileBottomBarProps {
  scanId: string;
  isPaid: boolean;
  activeTab?: 'dashboard' | 'chat' | 'report';
}

export function MobileBottomBar({ scanId, isPaid, activeTab = 'dashboard' }: MobileBottomBarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDeclassify = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'alpha_brief', scanId }),
      });
      if (!res.ok) { setLoading(false); return; }
      const { url } = await res.json();
      if (url) router.push(url);
    } catch {
      setLoading(false);
    }
  }, [scanId, router]);

  if (!isPaid) {
    return (
      <div className="h-[48px] flex items-center px-gs-3 bg-gs-chrome bevel-raised flex-shrink-0">
        <button
          onClick={handleDeclassify}
          disabled={loading}
          className={cn(
            'bevel-button-primary w-full text-os-sm',
            loading && 'cursor-wait opacity-70',
          )}
        >
          {loading ? 'Connecting...' : 'Unlock — from $24.99'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 bg-gs-chrome bevel-raised">
      <div className="h-[48px] flex items-center gap-gs-1 px-gs-2">
        <button
          className={cn(
            'flex-1 text-os-xs py-gs-1',
            activeTab === 'dashboard' ? 'bevel-sunken bg-gs-ink text-gs-paper' : 'bevel-button',
          )}
        >
          Dashboard
        </button>
        <Link
          href={`/chat/${scanId}`}
          className={cn(
            'flex-1 text-os-xs py-gs-1 text-center',
            activeTab === 'chat' ? 'bevel-sunken bg-gs-ink text-gs-paper' : 'bevel-button',
          )}
        >
          Chat
        </Link>
        <button
          onClick={() => window.open(`/report/${scanId}/slides?download=1`, '_blank')}
          className="flex-1 text-os-xs py-gs-1 bevel-button text-center"
        >
          Audit ↓
        </button>
        <button
          onClick={() => window.open(`/api/reports/${scanId}/prd`, '_blank')}
          className="flex-1 text-os-xs py-gs-1 bevel-button text-center"
        >
          PRD ↓
        </button>
        <button
          onClick={() => window.open(`/report/${scanId}/boss-deck?download=1`, '_blank')}
          className="flex-1 text-os-xs py-gs-1 bevel-button text-center"
        >
          Boss ↓
        </button>
      </div>
      <p className="text-center font-data text-[9px] text-gs-mid/40 pb-[4px] -mt-[2px]">
        Full interactive report available on desktop
      </p>
    </div>
  );
}
