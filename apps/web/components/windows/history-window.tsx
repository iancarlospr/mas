'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { analytics } from '@/lib/analytics';
import { generateAuditMarkdown } from '@/lib/report/markdown-export';
import type { ScanWithResults } from '@marketing-alpha/types';

/* ═══════════════════════════════════════════════════════════════
   My Scans — Window Content

   Auth-gated scan history. Frosted glass cards with breathing
   room, score/badge/date stripe, Chat as hero CTA.
   ═══════════════════════════════════════════════════════════════ */

interface ScanRow {
  id: string;
  url: string;
  marketing_iq: number | null;
  status: string;
  tier: string;
  created_at: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'traffic-dot-green';
  if (score >= 40) return 'traffic-dot-amber';
  return 'traffic-dot-red';
}

interface HistoryWindowProps {
  onChatOpen?: (scanId: string, domain: string) => void;
}

export default function HistoryWindow({ onChatOpen }: HistoryWindowProps = {}) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const orchestrator = useScanOrchestrator();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mdCopiedId, setMdCopiedId] = useState<string | null>(null);

  const [mdCopyingId, setMdCopyingId] = useState<string | null>(null);

  const handleCopyMarkdown = useCallback(async (scanId: string, domain: string) => {
    if (mdCopiedId === scanId || mdCopyingId === scanId) return;
    setMdCopyingId(scanId);
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      if (!res.ok) { setMdCopyingId(null); return; }
      const data: ScanWithResults = await res.json();
      const markdown = generateAuditMarkdown(data);
      await navigator.clipboard.writeText(markdown);
      setMdCopyingId(null);
      setMdCopiedId(scanId);
      analytics.markdownCopied(scanId, domain);
      setTimeout(() => setMdCopiedId(null), 2000);
    } catch { setMdCopyingId(null); }
  }, [mdCopiedId, mdCopyingId]);

  const handleScanClick = useCallback((scanId: string, domain: string, status: string) => {
    if (status === 'complete' || status === 'failed' || status === 'cancelled') {
      orchestrator.openScanWindow(scanId, domain);
    } else {
      orchestrator.startScan(scanId, domain);
    }
  }, [orchestrator]);

  const handleDelete = useCallback(async (scanId: string) => {
    if (deletingId) return;
    setDeletingId(scanId);
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: 'DELETE' });
      if (res.ok) {
        analytics.scanDeleted(scanId);
        setScans((prev) => prev.filter((s) => s.id !== scanId));
        // Close the scan window if it's open
        const windowId = `scan-${scanId}`;
        if (wm.windows[windowId]?.isOpen) {
          wm.closeWindow(windowId);
        }
      }
    } catch { /* ignore */ }
    setDeletingId(null);
  }, [deletingId, wm]);

  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('scans')
        .select('id, url, marketing_iq, status, tier, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setScans(data ?? []);
      setDataLoading(false);
    }
    load();
  }, [user?.id]);

  if (authLoading || dataLoading) {
    return (
      <div className="p-gs-6 flex items-center justify-center h-full">
        <span className="font-system text-os-base text-gs-muted animate-blink">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-gs-8 text-center space-y-gs-4">
        <div className="font-system text-os-lg font-bold text-gs-muted">Locked</div>
        <h2 className="font-system text-os-base font-bold">Login Required</h2>
        <p className="font-data text-data-sm text-gs-muted">
          Log in to view your scan history.
        </p>
        <button onClick={() => wm.openWindow('auth')} className="bevel-button-primary">
          Log In
        </button>
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="p-gs-8 text-center space-y-gs-4">
        <h2 className="font-system text-os-base font-bold">No scans yet</h2>
        <p className="font-data text-data-sm text-gs-muted">
          Run your first scan to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scans.map((scan) => {
            let domain: string;
            try {
              domain = new URL(scan.url).hostname;
            } catch {
              domain = scan.url;
            }

            const isPaid = scan.tier === 'paid';
            const isComplete = scan.status === 'complete';

            return (
              <div
                key={scan.id}
                className="transition-all"
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  background: 'oklch(0.14 0.02 340 / 0.65)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid oklch(0.25 0.04 340)',
                  boxShadow: '0 2px 12px oklch(0.05 0.01 340 / 0.4), inset 0 1px 0 oklch(0.30 0.03 340 / 0.2)',
                  overflow: 'visible',
                  marginTop: 12,
                }}
              >
                {/* Top-centered notch badge */}
                <span
                  className="font-system font-bold"
                  style={{
                    position: 'absolute',
                    top: -11,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1,
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    padding: '3px 14px 4px',
                    borderRadius: '8px 8px 0 0',
                    ...(isPaid
                      ? {
                          background: 'var(--gs-base)',
                          color: 'var(--gs-void)',
                          boxShadow: '0 -2px 10px oklch(0.72 0.17 340 / 0.35)',
                        }
                      : {
                          background: 'oklch(0.18 0.02 340)',
                          color: 'oklch(0.55 0.04 340)',
                          border: '1px solid oklch(0.30 0.04 340)',
                          borderBottom: 'none',
                          fontWeight: 500,
                        }),
                  }}
                >
                  {isPaid ? 'PRO' : 'FREE'}
                </span>
                {/* Header: domain · dot · score · status · date ··· delete — one line */}
                <div className="flex items-center" style={{ padding: '14px 10px 12px 16px', gap: 8 }}>
                  <span
                    className="min-w-0 font-data font-bold truncate"
                    style={{ fontSize: 15, color: 'var(--gs-light)', flex: '0 1 auto', maxWidth: '40%' }}
                  >
                    {domain}
                  </span>
                  {scan.marketing_iq != null && (
                    <span className="flex items-center font-data" style={{ flexShrink: 0, gap: 5 }}>
                      <span
                        className={`rounded-full ${getScoreColor(scan.marketing_iq)}`}
                        style={{
                          width: 9,
                          height: 9,
                          boxShadow: scan.marketing_iq >= 70
                            ? '0 0 8px oklch(0.72 0.2 145 / 0.6)'
                            : scan.marketing_iq >= 40
                              ? '0 0 8px oklch(0.72 0.15 85 / 0.5)'
                              : '0 0 8px oklch(0.65 0.2 25 / 0.5)',
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.75 0.04 340)' }}>
                        {scan.marketing_iq}
                      </span>
                    </span>
                  )}
                  <span title={scan.status} style={{ flexShrink: 0 }}>
                    {scan.status === 'complete' ? (
                      <svg className="w-3.5 h-3.5 inline-block text-gs-terminal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    ) : scan.status === 'failed' ? (
                      <svg className="w-3.5 h-3.5 inline-block text-gs-critical" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 inline-block text-gs-warning animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    )}
                  </span>
                  <span className="flex-1" />
                  <span className="font-data" style={{ flexShrink: 0, fontSize: 12, color: 'oklch(0.50 0.04 340)' }}>
                    {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {/* Trash icon — bare, no box */}
                  <button
                    onClick={() => handleDelete(scan.id)}
                    disabled={deletingId === scan.id}
                    className={`flex items-center justify-center transition-colors duration-100 bg-transparent rounded ${deletingId === scan.id ? 'text-[oklch(0.40_0.03_340)]' : 'text-[oklch(0.45_0.04_340)] hover:text-gs-critical hover:bg-white/10'}`}
                    title="Delete scan"
                    style={{
                      flexShrink: 0,
                      width: 28,
                      height: 28,
                      border: 'none',
                      cursor: deletingId === scan.id ? 'default' : 'pointer',
                    }}
                  >
                    {deletingId === scan.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Action zone: flush to card edges, no gaps, no separators */}
                {isPaid && isComplete && (
                  <>
                    {/* Chat hero — full-bleed */}
                    <button
                      onClick={() => {
                        if (onChatOpen) {
                          onChatOpen(scan.id, domain);
                        } else {
                          const chatId = `chat-${scan.id}`;
                          if (wm.windows[chatId]?.isOpen) {
                            wm.focusWindow(chatId);
                            return;
                          }
                          wm.registerWindow(chatId, {
                            title: `Ask Chloé — ${domain}`,
                            width: 380, height: 480,
                            minWidth: 340, minHeight: 400,
                            componentType: 'ghost-chat',
                            alwaysOnTop: true,
                          });
                          wm.openWindow(chatId, { scanId: scan.id, domain });
                        }
                      }}
                      className="neon-outline-btn flex items-center justify-center w-full transition-colors duration-100 bg-[oklch(0.11_0.04_340)] text-gs-base hover:bg-[oklch(0.15_0.06_340)] hover:brightness-110 active:bg-[oklch(0.18_0.07_340)]"
                      title="GhostChat™"
                      style={{
                        gap: 8,
                        padding: '12px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 0,
                        border: 'none',
                        borderTop: '1px solid oklch(0.22 0.04 340)',
                        fontFamily: 'var(--font-system)',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                        <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                        <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                        <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                      </svg>
                      GhostChat&trade;
                    </button>
                    {/* Export row — View Report + downloads + .MD with NotebookLM icon */}
                    <div className="flex" style={{ borderTop: '1px solid oklch(0.18 0.02 340)' }}>
                      {/* View Report — opens the slide deck in-app (same as card click) */}
                      <button
                        onClick={() => orchestrator.openScanWindow(scan.id, domain)}
                        className="hidden md:flex flex-1 font-system items-center justify-center transition-colors duration-100 bg-transparent text-gs-light hover:bg-white/10 hover:text-gs-base active:bg-white/15"
                        title="View audit report"
                        style={{ gap: 4, padding: '10px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid oklch(0.18 0.02 340)', cursor: 'pointer' }}
                      >
                        Report
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </button>
                      <button
                        onClick={() => window.open(`/report/${scan.id}/slides?download=1`, '_blank')}
                        className="flex-1 font-system flex items-center justify-center transition-colors duration-100 bg-transparent text-[oklch(0.60_0.04_340)] hover:bg-white/10 hover:text-gs-base active:bg-white/15"
                        title="Download Audit Deck PDF"
                        style={{ gap: 4, padding: '10px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid oklch(0.18 0.02 340)', cursor: 'pointer' }}
                      >
                        Alpha Brief
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                      </button>
                      <button
                        onClick={() => window.open(`/api/reports/${scan.id}/prd`, '_blank')}
                        className="flex-1 font-system flex items-center justify-center transition-colors duration-100 bg-transparent text-[oklch(0.60_0.04_340)] hover:bg-white/10 hover:text-gs-base active:bg-white/15"
                        title="Download PRD"
                        style={{ gap: 4, padding: '10px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid oklch(0.18 0.02 340)', cursor: 'pointer' }}
                      >
                        PRD
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                      </button>
                      <button
                        onClick={() => window.open(`/report/${scan.id}/boss-deck?download=1`, '_blank')}
                        className="flex-1 font-system flex items-center justify-center transition-colors duration-100 bg-transparent text-[oklch(0.60_0.04_340)] hover:bg-white/10 hover:text-gs-base active:bg-white/15"
                        title="Download Boss Deck PDF"
                        style={{ gap: 4, padding: '10px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRight: '1px solid oklch(0.18 0.02 340)', cursor: 'pointer' }}
                      >
                        Boss Deck
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                      </button>
                      <button
                        onClick={() => handleCopyMarkdown(scan.id, domain)}
                        className={`flex-1 font-system flex items-center justify-center transition-colors duration-100 bg-transparent ${mdCopiedId === scan.id || mdCopyingId === scan.id ? '' : 'hover:bg-white/10 hover:text-gs-base active:bg-white/15'} ${mdCopiedId === scan.id ? '!text-gs-terminal' : mdCopyingId === scan.id ? '!text-gs-warning' : 'text-[oklch(0.60_0.04_340)]'}`}
                        title="Copy audit as Markdown for NotebookLM"
                        style={{
                          gap: 4,
                          padding: '10px 0',
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: mdCopyingId === scan.id ? 'wait' : 'pointer',
                        }}
                      >
                        {mdCopiedId === scan.id ? (
                          <>{'\u2713'} Copied!</>
                        ) : mdCopyingId === scan.id ? (
                          <>Copying...</>
                        ) : (
                          <>
                            .MD
                            {/* NotebookLM spiral icon */}
                            <svg width="12" height="12" viewBox="0 0 175 132" fill="currentColor" style={{ flexShrink: 0, opacity: 0.7 }}>
                              <path d="M87.27,1.14C39.07,1.14,0,39.88,0,87.69v41.44h16.09v-4.13c0-19.39,15.84-35.11,35.39-35.11s35.39,15.72,35.39,35.11v4.13h16.09v-4.13c0-28.2-23.05-51.05-51.48-51.05-11.07,0-21.32,3.46-29.72,9.37,8.79-17.32,26.88-29.21,47.77-29.21,29.51,0,53.44,23.74,53.44,53v22.02h16.09v-22.02c0-38.08-31.13-68.96-69.53-68.96-17.27,0-33.06,6.24-45.22,16.58,11.94-22.39,35.65-37.64,62.97-37.64,39.32,0,71.19,31.61,71.19,70.6v41.44h16.09v-41.44C174.55,39.88,135.48,1.14,87.27,1.14Z"/>
                            </svg>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
                {!isPaid && isComplete && (
                  <button
                    onClick={() => {
                      const paymentId = `payment-${scan.id}`;
                      wm.registerWindow(paymentId, { title: 'Checkout', width: 420, height: 300, variant: 'dialog', componentType: 'payment' });
                      wm.openWindow(paymentId, { scanId: scan.id, domain, product: 'alpha_brief' });
                    }}
                    className="neon-outline-btn flex items-center justify-center w-full transition-colors duration-100 bg-[oklch(0.11_0.04_340)] text-gs-base hover:bg-[oklch(0.15_0.06_340)] hover:brightness-110 active:bg-[oklch(0.18_0.07_340)]"
                    title="Unlock full report"
                    style={{
                      gap: 8,
                      padding: '12px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 0,
                      border: 'none',
                      borderTop: '1px solid oklch(0.22 0.04 340)',
                      fontFamily: 'var(--font-system)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Unlock Full Report
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
