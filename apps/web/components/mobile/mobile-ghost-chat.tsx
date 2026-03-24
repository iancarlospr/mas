'use client';

import { useState, useCallback } from 'react';
import ChatWindow from '@/components/windows/chat-window';

/* ═══════════════════════════════════════════════════════════════
   MobileGhostChat — Inline GhostChat for mobile paid users

   Shows a vertical scan selector (cards) + inline ChatWindow.
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

      {/* ── Scan selector cards (vertical list) ── */}
      {paidScans.length > 1 && (
        <div className="px-gs-4 mb-gs-3">
          <div className="flex flex-col gap-[6px]">
            {paidScans.map((scan) => {
              const domain = extractDomain(scan.url);
              const isActive = scan.id === selectedScanId;
              const msgCount = scan.chat_messages?.[0]?.count ?? 0;
              return (
                <button
                  key={scan.id}
                  onClick={() => setSelectedScanId(scan.id)}
                  className="flex items-center gap-gs-3 w-full text-left transition-colors"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    borderLeft: `3px solid ${isActive ? 'var(--gs-base)' : 'transparent'}`,
                    background: isActive
                      ? 'oklch(0.14 0.03 340)'
                      : 'oklch(0.11 0.01 340)',
                    borderTop: `1px solid ${isActive ? 'oklch(0.25 0.05 340)' : 'oklch(0.18 0.02 340)'}`,
                    borderRight: `1px solid ${isActive ? 'oklch(0.25 0.05 340)' : 'oklch(0.18 0.02 340)'}`,
                    borderBottom: `1px solid ${isActive ? 'oklch(0.25 0.05 340)' : 'oklch(0.18 0.02 340)'}`,
                  }}
                >
                  {/* Chevron */}
                  <span
                    className="font-system"
                    style={{
                      fontSize: '13px',
                      color: isActive ? 'var(--gs-base)' : 'oklch(0.35 0.04 340)',
                      flexShrink: 0,
                      width: 12,
                      textAlign: 'center',
                    }}
                  >
                    {'>'}
                  </span>

                  {/* Domain + message count */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-data font-bold truncate"
                      style={{
                        fontSize: '14px',
                        color: isActive ? 'var(--gs-light)' : 'oklch(0.70 0.04 340)',
                      }}
                    >
                      {domain}
                    </div>
                    <div
                      className="font-data"
                      style={{
                        fontSize: '12px',
                        color: isActive ? 'oklch(0.55 0.08 340)' : 'oklch(0.40 0.04 340)',
                        marginTop: 2,
                      }}
                    >
                      {msgCount > 0
                        ? `${msgCount} message${msgCount === 1 ? '' : 's'} sent`
                        : 'No messages yet'}
                    </div>
                  </div>

                  {/* Arrow */}
                  <span
                    className="font-data"
                    style={{
                      fontSize: '14px',
                      color: isActive ? 'var(--gs-base)' : 'oklch(0.30 0.04 340)',
                      flexShrink: 0,
                    }}
                  >
                    →
                  </span>
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
        <div className="px-gs-4 py-gs-8 text-center space-y-gs-2">
          <p className="font-data" style={{ fontSize: '13px', color: 'oklch(0.55 0.06 340)' }}>
            Pick a scan above to start chatting
          </p>
          <p className="font-data" style={{ fontSize: '11px', color: 'oklch(0.35 0.04 340)' }}>
            Chlo&eacute; knows everything about your audit results
          </p>
        </div>
      )}
    </div>
  );
}
