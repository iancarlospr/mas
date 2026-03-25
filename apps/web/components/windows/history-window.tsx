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
              className="px-gs-4 py-gs-3 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20 cursor-pointer"
            >
              {/* Top row: domain + metadata */}
              <div className="flex items-center gap-gs-2">
                <span className="font-system text-os-sm text-gs-muted" style={{ flexShrink: 0 }}>{'>'}</span>
                <span className="flex-1 min-w-0 font-data text-data-sm font-bold truncate">
                  {domain}
                </span>
                {scan.marketing_iq != null && (
                  <span className="flex items-center gap-1 font-data text-data-sm" style={{ flexShrink: 0 }}>
                    <span className={`w-2 h-2 rounded-full ${getScoreColor(scan.marketing_iq)}`} />
                    <span>{scan.marketing_iq}</span>
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
                <span
                  className="font-system text-os-sm px-gs-1 bevel-raised"
                  style={isPaid
                    ? { background: 'var(--gs-base)', color: 'var(--gs-void)', fontWeight: 700, flexShrink: 0 }
                    : { flexShrink: 0 }}
                >
                  {isPaid ? 'PRO' : 'FREE'}
                </span>
                <span className="font-data text-data-sm text-gs-muted" style={{ flexShrink: 0 }}>
                  {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <button
                  onClick={(e) => handleDelete(e, scan.id)}
                  disabled={deletingId === scan.id}
                  className="text-gs-muted hover:text-gs-critical transition-colors font-data text-data-sm"
                  title="Delete scan"
                  style={{ flexShrink: 0 }}
                >
                  {deletingId === scan.id ? '...' : 'x'}
                </button>
              </div>

              {/* Bottom row: action buttons */}
              {isPaid && isComplete && (
                <div className="flex items-center gap-gs-2 mt-gs-1" style={{ paddingLeft: 'calc(12px + var(--gs-2))' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/report/${scan.id}/slides?download=1`, '_blank'); }}
                    className="text-gs-base hover:text-gs-bright transition-colors font-system text-os-sm"
                    title="Download Audit Deck"
                  >
                    Audit&nbsp;&darr;
                  </button>
                  <span className="text-gs-mid font-data text-data-sm">&middot;</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${scan.id}/prd`, '_blank'); }}
                    className="text-gs-base hover:text-gs-bright transition-colors font-system text-os-sm"
                    title="Download PRD"
                  >
                    PRD&nbsp;&darr;
                  </button>
                  <span className="text-gs-mid font-data text-data-sm">&middot;</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`/report/${scan.id}/boss-deck?download=1`, '_blank'); }}
                    className="text-gs-base hover:text-gs-bright transition-colors font-system text-os-sm"
                    title="Download Boss Deck"
                  >
                    Boss&nbsp;&darr;
                  </button>
                  <span className="text-gs-mid font-data text-data-sm">&middot;</span>
                  <button
                    onClick={(e) => handleCopyMarkdown(e, scan.id, domain)}
                    className="text-gs-base hover:text-gs-bright transition-colors font-system text-os-sm"
                    title="Copy audit as Markdown"
                  >
                    {mdCopiedId === scan.id ? '\u2713' : '.MD\u00a0\u2193'}
                  </button>
                  <span className="text-gs-mid font-data text-data-sm">&middot;</span>
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
                    className="text-gs-base hover:text-gs-bright transition-colors flex items-center gap-[3px] font-system text-os-sm"
                    title="Ask Chloe"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                    </svg>
                    Chat
                  </button>
                </div>
              )}
              {!isPaid && isComplete && (
                <div className="flex items-center gap-gs-2 mt-gs-1" style={{ paddingLeft: 'calc(12px + var(--gs-2))' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const paymentId = `payment-${scan.id}`;
                      wm.registerWindow(paymentId, { title: 'Checkout', width: 420, height: 300, variant: 'dialog', componentType: 'payment' });
                      wm.openWindow(paymentId, { scanId: scan.id, domain, product: 'alpha_brief' });
                    }}
                    className="text-gs-base hover:text-gs-bright transition-colors flex items-center gap-1 font-system text-os-sm"
                    title="Unlock full report"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
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
