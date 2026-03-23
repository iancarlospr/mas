'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { analytics } from '@/lib/analytics';

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

export default function HistoryWindow() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const orchestrator = useScanOrchestrator();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      {/* Column headers */}
      <div className="flex items-center gap-gs-2 px-gs-3 py-gs-2 bg-gs-chrome border-b border-gs-chrome-dark font-system text-os-xs" style={{ color: 'var(--gs-light)', opacity: 0.6 }}>
        <span className="flex-1">Domain</span>
        <span className="w-14 text-center">Score</span>
        <span className="w-6 text-center" />
        <span className="w-14 text-center">Tier</span>
        <span className="w-44 text-center">Actions</span>
        <span className="w-16 text-right">Date</span>
        <span className="w-6" />
      </div>

      {/* Scan rows */}
      <div className="flex-1 overflow-auto">
        {scans.map((scan) => {
          let domain: string;
          try {
            domain = new URL(scan.url).hostname;
          } catch {
            domain = scan.url;
          }

          return (
            <div
              key={scan.id}
              role="button"
              tabIndex={0}
              onClick={() => handleScanClick(scan.id, domain, scan.status)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleScanClick(scan.id, domain, scan.status); } }}
              className="flex items-center gap-gs-2 px-gs-3 py-gs-2 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20 font-data text-data-sm w-full text-left cursor-pointer"
            >
              <span className="flex-1 truncate">
                {domain}
              </span>
              <span className="w-14 text-center flex items-center justify-center gap-1">
                {scan.marketing_iq != null && (
                  <>
                    <span className={`traffic-dot w-2 h-2 ${getScoreColor(scan.marketing_iq)}`} />
                    <span>{scan.marketing_iq}</span>
                  </>
                )}
              </span>
              <span className="w-6 text-center" title={scan.status}>
                {scan.status === 'complete' ? (
                  <svg className="w-3.5 h-3.5 inline-block text-gs-terminal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : scan.status === 'failed' ? (
                  <svg className="w-3.5 h-3.5 inline-block text-gs-critical" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 inline-block text-gs-warning animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                )}
              </span>
              <span className="w-14 text-center">
                <span
                  className="font-system text-os-xs px-gs-1 bevel-raised"
                  style={scan.tier === 'paid'
                    ? { background: 'var(--gs-base)', color: 'var(--gs-void)', fontWeight: 700 }
                    : {}}
                >
                  {scan.tier === 'paid' ? 'PRO' : 'FREE'}
                </span>
              </span>
              <span className="w-44 text-center flex items-center justify-center gap-2 whitespace-nowrap">
                {scan.tier === 'paid' && scan.status === 'complete' ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${scan.id}/presentation`, '_blank'); }}
                      className="text-gs-base hover:text-gs-bright transition-colors"
                      title="Download Audit Deck"
                      style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}
                    >
                      Audit&nbsp;&darr;
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${scan.id}/prd`, '_blank'); }}
                      className="text-gs-base hover:text-gs-bright transition-colors"
                      title="Download PRD"
                      style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}
                    >
                      PRD&nbsp;&darr;
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${scan.id}/boss-deck-pdf`, '_blank'); }}
                      className="text-gs-base hover:text-gs-bright transition-colors"
                      title="Download Boss Deck"
                      style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}
                    >
                      Boss&nbsp;&darr;
                    </button>
                  </>
                ) : scan.tier !== 'paid' && scan.status === 'complete' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      let domain: string;
                      try { domain = new URL(scan.url).hostname; } catch { domain = scan.url; }
                      const paymentId = `payment-${scan.id}`;
                      wm.registerWindow(paymentId, { title: 'Checkout', width: 420, height: 300, variant: 'dialog', componentType: 'payment' });
                      wm.openWindow(paymentId, { scanId: scan.id, domain, product: 'alpha_brief' });
                    }}
                    className="text-gs-base hover:text-gs-bright transition-colors flex items-center gap-1"
                    title="Unlock full report"
                    style={{ fontSize: '11px', fontFamily: 'var(--font-system)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Unlock
                  </button>
                ) : null}
              </span>
              <span className="w-16 text-right text-data-xs text-gs-muted">
                {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="w-6 flex justify-center">
                <button
                  onClick={(e) => handleDelete(e, scan.id)}
                  disabled={deletingId === scan.id}
                  className="text-gs-muted hover:text-gs-critical transition-colors text-data-xs"
                  title="Delete scan"
                >
                  {deletingId === scan.id ? '...' : 'x'}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
