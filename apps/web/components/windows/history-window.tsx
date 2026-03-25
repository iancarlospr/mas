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

   Auth-gated scan history list. File-explorer style with
   domain, date, score, tier badge per row.
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

  const handleCopyMarkdown = useCallback(async (e: React.MouseEvent, scanId: string, domain: string) => {
    e.stopPropagation();
    if (mdCopiedId === scanId) return;
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      if (!res.ok) return;
      const data: ScanWithResults = await res.json();
      const markdown = generateAuditMarkdown(data);
      await navigator.clipboard.writeText(markdown);
      setMdCopiedId(scanId);
      analytics.markdownCopied(scanId, domain);
      setTimeout(() => setMdCopiedId(null), 2000);
    } catch { /* clipboard API not available */ }
  }, [mdCopiedId]);

  const handleScanClick = useCallback((scanId: string, domain: string, status: string) => {
    if (status === 'complete' || status === 'failed' || status === 'cancelled') {
      orchestrator.openScanWindow(scanId, domain);
    } else {
      orchestrator.startScan(scanId, domain);
    }
  }, [orchestrator]);

  const handleDelete = useCallback(async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
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
      {/* Scan cards */}
      <div className="flex-1 overflow-auto">
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
              role="button"
              tabIndex={0}
              onClick={() => handleScanClick(scan.id, domain, scan.status)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleScanClick(scan.id, domain, scan.status); } }}
              className="px-gs-4 py-gs-3 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20 cursor-pointer transition-colors"
            >
              {/* Top row: domain + metadata */}
              <div className="flex items-center gap-gs-2">
                <span className="min-w-0 font-data font-bold truncate" style={{ maxWidth: '50%', fontSize: '14px', color: 'var(--gs-light)' }}>
                  {domain}
                </span>
                {scan.marketing_iq != null && (
                  <span className="flex items-center gap-[5px] font-data" style={{ flexShrink: 0, fontSize: '13px' }}>
                    <span
                      className={`rounded-full ${getScoreColor(scan.marketing_iq)}`}
                      style={{ width: 7, height: 7, boxShadow: scan.marketing_iq >= 70 ? '0 0 6px oklch(0.72 0.2 145 / 0.6)' : scan.marketing_iq >= 40 ? '0 0 6px oklch(0.72 0.15 85 / 0.5)' : '0 0 6px oklch(0.65 0.2 25 / 0.5)' }}
                    />
                    <span style={{ color: 'oklch(0.75 0.04 340)' }}>{scan.marketing_iq}</span>
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
                {isPaid ? (
                  <span
                    className="font-system font-bold"
                    style={{
                      flexShrink: 0,
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: 'var(--gs-base)',
                      color: 'var(--gs-void)',
                      boxShadow: '0 0 10px oklch(0.72 0.17 340 / 0.35)',
                    }}
                  >
                    PRO
                  </span>
                ) : (
                  <span
                    className="font-system"
                    style={{
                      flexShrink: 0,
                      fontSize: '10px',
                      letterSpacing: '0.06em',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      border: '1px solid oklch(0.35 0.04 340)',
                      color: 'oklch(0.55 0.04 340)',
                    }}
                  >
                    FREE
                  </span>
                )}
                <span className="flex-1" />
                <span className="font-data text-data-sm" style={{ flexShrink: 0, color: 'oklch(0.45 0.03 340)' }}>
                  {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <button
                  onClick={(e) => handleDelete(e, scan.id)}
                  disabled={deletingId === scan.id}
                  className="hover:text-gs-critical transition-colors font-data text-data-sm"
                  title="Delete scan"
                  style={{ flexShrink: 0, color: 'oklch(0.40 0.02 340)' }}
                >
                  {deletingId === scan.id ? '...' : 'x'}
                </button>
              </div>

              {/* Bottom row: action buttons as pills */}
              {isPaid && isComplete && (
                <div className="flex items-center gap-gs-2 mt-gs-2" style={{ paddingLeft: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/report/${scan.id}/slides?download=1`, '_blank'); }}
                    className="bevel-button"
                    title="Download Audit Deck"
                    style={{ padding: '3px 10px', fontSize: '12px', minHeight: 0 }}
                  >
                    Audit&nbsp;&darr;
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${scan.id}/prd`, '_blank'); }}
                    className="bevel-button"
                    title="Download PRD"
                    style={{ padding: '3px 10px', fontSize: '12px', minHeight: 0 }}
                  >
                    PRD&nbsp;&darr;
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/report/${scan.id}/boss-deck?download=1`, '_blank'); }}
                    className="bevel-button"
                    title="Download Boss Deck"
                    style={{ padding: '3px 10px', fontSize: '12px', minHeight: 0 }}
                  >
                    Boss&nbsp;&darr;
                  </button>
                  <button
                    onClick={(e) => handleCopyMarkdown(e, scan.id, domain)}
                    className="bevel-button"
                    title="Copy audit as Markdown"
                    style={{ padding: '3px 10px', fontSize: '12px', minHeight: 0 }}
                  >
                    {mdCopiedId === scan.id ? '\u2713' : '.MD\u00a0\u2193'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="neon-outline-btn flex items-center gap-[4px]"
                    title="Ask Chloe"
                    style={{
                      padding: '3px 10px',
                      fontSize: '12px',
                      minHeight: 0,
                      borderRadius: '8px',
                      border: '1.5px solid var(--gs-base)',
                      background: 'oklch(0.12 0.03 340)',
                      color: 'var(--gs-base)',
                      fontFamily: 'var(--font-system)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                    </svg>
                    Chat
                  </button>
                </div>
              )}
              {!isPaid && isComplete && (
                <div className="flex items-center gap-gs-2 mt-gs-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const paymentId = `payment-${scan.id}`;
                      wm.registerWindow(paymentId, { title: 'Checkout', width: 420, height: 300, variant: 'dialog', componentType: 'payment' });
                      wm.openWindow(paymentId, { scanId: scan.id, domain, product: 'alpha_brief' });
                    }}
                    className="neon-outline-btn flex items-center gap-[4px]"
                    title="Unlock full report"
                    style={{
                      padding: '3px 10px',
                      fontSize: '12px',
                      minHeight: 0,
                      borderRadius: '8px',
                      border: '1.5px solid var(--gs-base)',
                      background: 'oklch(0.12 0.03 340)',
                      color: 'var(--gs-base)',
                      fontFamily: 'var(--font-system)',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Unlock
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
