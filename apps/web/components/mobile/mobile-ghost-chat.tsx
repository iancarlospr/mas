'use client';

import { useState, useCallback } from 'react';
import ChatWindow from '@/components/windows/chat-window';

/* ═══════════════════════════════════════════════════════════════
   MobileGhostChat — Inline GhostChat for mobile paid users

   Shows a horizontal scan selector (pills) + inline ChatWindow.
   Auto-selects if only 1 paid scan exists.
   ═══════════════════════════════════════════════════════════════ */

export interface MobilePaidScan {
  id: string;
  url: string;
  marketing_iq: number | null;
  created_at: string;
  chat_messages: { count: number }[];
}

interface MobileGhostChatProps {
  paidScans: MobilePaidScan[];
  onAuthRequired: () => void;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function MobileGhostChat({ paidScans, onAuthRequired }: MobileGhostChatProps) {
  // Auto-select first scan if only 1 exists
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    paidScans.length === 1 ? paidScans[0]!.id : null,
  );

  const selectedScan = paidScans.find((s) => s.id === selectedScanId);
  const selectedDomain = selectedScan ? extractDomain(selectedScan.url) : undefined;

  // Mobile credit purchase: POST to checkout API, redirect to Stripe
  const handlePurchaseCredits = useCallback(async (product: string, scanId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, scanId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch { /* ignore — Stripe redirect failed */ }
  }, []);

  return (
    <div className="mobile-ghost-chat">
      <style>{`
        /* Hide CopyableMessage floating tooltip on touch — native long-press copy works */
        .mobile-ghost-chat [style*="will-change: transform"] { display: none !important; }
      `}</style>

      {/* ── Scan selector pills (horizontal scroll) ── */}
      {paidScans.length > 1 && (
        <div className="px-gs-4 mb-gs-2">
          <div className="flex gap-gs-2 overflow-x-auto pb-gs-1" style={{ scrollbarWidth: 'none' }}>
            {paidScans.map((scan) => {
              const domain = extractDomain(scan.url);
              const isActive = scan.id === selectedScanId;
              const msgCount = scan.chat_messages?.[0]?.count ?? 0;
              return (
                <button
                  key={scan.id}
                  onClick={() => setSelectedScanId(scan.id)}
                  className="flex-shrink-0 font-data transition-colors"
                  style={{
                    fontSize: '12px',
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: `1px solid ${isActive ? 'var(--gs-base)' : 'oklch(0.25 0.02 340)'}`,
                    background: isActive ? 'oklch(0.18 0.04 340)' : 'transparent',
                    color: isActive ? 'var(--gs-base)' : 'var(--gs-mid)',
                  }}
                >
                  {domain}
                  {msgCount > 0 && (
                    <span className="ml-1 opacity-50">({msgCount})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chat area ── */}
      {selectedScanId ? (
        <div style={{ height: '60svh', maxHeight: '70svh', minHeight: 360 }}>
          <ChatWindow
            key={selectedScanId}
            scanId={selectedScanId}
            domain={selectedDomain}
            containerHeight="100%"
            onAuthRequired={onAuthRequired}
            onPurchaseCredits={handlePurchaseCredits}
          />
        </div>
      ) : (
        /* No scan selected — prompt user to pick one */
        <div className="px-gs-4 py-gs-6 text-center">
          <p className="font-data text-data-sm text-gs-muted">
            Select a scan above to chat with Chlo&eacute;
          </p>
        </div>
      )}
    </div>
  );
}
