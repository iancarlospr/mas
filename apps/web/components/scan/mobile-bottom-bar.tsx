'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * GhostScan Mobile — Bottom Bar
 * Free tier: full-width "Declassify $9.99" CTA.
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
      <div className="h-[48px] flex items-center px-gs-3 bg-gs-light bevel-raised flex-shrink-0">
        <button
          onClick={handleDeclassify}
          disabled={loading}
          className={cn(
            'bevel-button-primary w-full text-os-sm',
            loading && 'cursor-wait opacity-70',
          )}
        >
          {loading ? '⏳ Connecting...' : '🔓 Declassify — $9.99'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-[48px] flex items-center gap-gs-1 px-gs-2 bg-gs-light bevel-raised flex-shrink-0">
      <button
        className={cn(
          'flex-1 text-os-xs py-gs-1',
          activeTab === 'dashboard' ? 'bevel-sunken bg-gs-mid-dark text-gs-near-white' : 'bevel-button',
        )}
      >
        📊 Dashboard
      </button>
      <Link
        href={`/chat/${scanId}`}
        className={cn(
          'flex-1 text-os-xs py-gs-1 text-center',
          activeTab === 'chat' ? 'bevel-sunken bg-gs-mid-dark text-gs-near-white' : 'bevel-button',
        )}
      >
        💬 Chat
      </Link>
      <Link
        href={`/report/${scanId}`}
        className={cn(
          'flex-1 text-os-xs py-gs-1 text-center',
          activeTab === 'report' ? 'bevel-sunken bg-gs-mid-dark text-gs-near-white' : 'bevel-button',
        )}
      >
        📋 Report
      </Link>
    </div>
  );
}
