'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
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

/* ── Ghost icon (inline SVG) ─────────────────────────────── */
function GhostIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={{ flexShrink: 0 }}>
      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
    </svg>
  );
}

export function MobileGhostChat({ paidScans, onAuthRequired }: MobileGhostChatProps) {
  // Auto-select first scan if only 1 exists
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    paidScans.length === 1 ? paidScans[0]!.id : null,
  );

  const selectedScan = paidScans.find((s) => s.id === selectedScanId);
  const selectedDomain = selectedScan ? extractDomain(selectedScan.url) : undefined;

  // Track scroll state for fade indicators
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      setCanScrollLeft(el.scrollLeft > 4);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    // Recheck after layout settles
    const raf = requestAnimationFrame(check);
    return () => { el.removeEventListener('scroll', check); cancelAnimationFrame(raf); };
  }, [paidScans.length]);

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
        /* Hide scrollbar on scan pills */
        .mobile-ghost-chat-pills::-webkit-scrollbar { display: none; }
        /* Pill glow pulse for active scan */
        @keyframes pillGlow {
          0%, 100% { box-shadow: 0 0 8px oklch(0.72 0.17 340 / 0.3), inset 0 1px 0 oklch(0.72 0.17 340 / 0.15); }
          50% { box-shadow: 0 0 14px oklch(0.72 0.17 340 / 0.45), inset 0 1px 0 oklch(0.72 0.17 340 / 0.25); }
        }
      `}</style>

      {/* ── Scan selector pills (horizontal scroll) ── */}
      {paidScans.length > 1 && (
        <div className="px-gs-4 mb-gs-3 relative">
          {/* Scroll container */}
          <div
            ref={scrollRef}
            className="flex gap-[10px] overflow-x-auto pb-gs-2 mobile-ghost-chat-pills"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {paidScans.map((scan) => {
              const domain = extractDomain(scan.url);
              const isActive = scan.id === selectedScanId;
              const msgCount = scan.chat_messages?.[0]?.count ?? 0;
              const score = scan.marketing_iq;
              return (
                <button
                  key={scan.id}
                  onClick={() => setSelectedScanId(scan.id)}
                  className="flex-shrink-0 font-data transition-all"
                  style={{
                    scrollSnapAlign: 'start',
                    fontSize: '12px',
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? 'var(--gs-base)' : 'oklch(0.30 0.04 340)'}`,
                    background: isActive
                      ? 'linear-gradient(135deg, oklch(0.20 0.06 340), oklch(0.16 0.04 340))'
                      : 'oklch(0.13 0.02 340)',
                    color: isActive ? 'var(--gs-base)' : 'oklch(0.60 0.04 340)',
                    fontWeight: isActive ? 600 : 400,
                    animation: isActive ? 'pillGlow 3s ease-in-out infinite' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {isActive && <GhostIcon size={12} />}
                  <span>{domain}</span>
                  {score != null && (
                    <span
                      className="font-data tabular-nums"
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isActive ? 'oklch(0.72 0.17 340 / 0.2)' : 'oklch(0.20 0.03 340)',
                        color: isActive ? 'var(--gs-base)' : 'oklch(0.50 0.04 340)',
                        fontWeight: 600,
                      }}
                    >
                      {score}
                    </span>
                  )}
                  {msgCount > 0 && !score && (
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '10px',
                        opacity: 0.5,
                      }}
                    >
                      {msgCount} msg{msgCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right fade — indicates more pills to scroll */}
          {canScrollRight && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                right: 16,
                top: 0,
                bottom: 8,
                width: 40,
                background: 'linear-gradient(to right, transparent, var(--gs-void) 85%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 2,
              }}
            >
              <span
                className="font-data"
                style={{
                  fontSize: '14px',
                  color: 'oklch(0.50 0.06 340)',
                  pointerEvents: 'auto',
                }}
              >
                ›
              </span>
            </div>
          )}

          {/* Left fade — indicates scrolled content behind */}
          {canScrollLeft && (
            <div
              className="pointer-events-none"
              style={{
                position: 'absolute',
                left: 16,
                top: 0,
                bottom: 8,
                width: 40,
                background: 'linear-gradient(to left, transparent, var(--gs-void) 85%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: 2,
              }}
            >
              <span
                className="font-data"
                style={{
                  fontSize: '14px',
                  color: 'oklch(0.50 0.06 340)',
                  pointerEvents: 'auto',
                }}
              >
                ‹
              </span>
            </div>
          )}
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
        <div className="px-gs-4 py-gs-8 text-center space-y-gs-3">
          <ChloeSprite state="chat" size={32} glowing className="mx-auto" />
          <p className="font-data text-data-sm" style={{ color: 'oklch(0.55 0.06 340)' }}>
            Pick a scan above to start chatting
          </p>
          <p className="font-data" style={{ fontSize: '10px', color: 'oklch(0.35 0.04 340)' }}>
            Chlo&eacute; knows everything about your audit results
          </p>
        </div>
      )}
    </div>
  );
}
