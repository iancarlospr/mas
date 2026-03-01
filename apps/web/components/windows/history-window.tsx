'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   My Scans — Window Content

   Auth-gated scan history list. File-explorer style with
   domain, date, score, tier badge per row.
   ═══════════════════════════════════════════════════════════════ */

interface ScanRow {
  id: string;
  url: string;
  marketing_iq_score: number | null;
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
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('scans')
        .select('id, url, marketing_iq_score, status, tier, created_at')
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
      <div className="flex items-center gap-gs-2 px-gs-3 py-gs-1 bg-gs-chrome border-b border-gs-chrome-dark font-system text-os-xs text-gs-muted">
        <span className="flex-1">Domain</span>
        <span className="w-16 text-center">Score</span>
        <span className="w-20 text-center">Status</span>
        <span className="w-16 text-center">Tier</span>
        <span className="w-24 text-right">Date</span>
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
            <Link
              key={scan.id}
              href={`/scan/${scan.id}`}
              className="flex items-center gap-gs-2 px-gs-3 py-gs-2 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20 font-data text-data-sm"
            >
              <span className="flex-1 truncate">
                {domain}
              </span>
              <span className="w-16 text-center flex items-center justify-center gap-1">
                {scan.marketing_iq_score != null && (
                  <>
                    <span className={`traffic-dot w-2 h-2 ${getScoreColor(scan.marketing_iq_score)}`} />
                    <span>{scan.marketing_iq_score}</span>
                  </>
                )}
              </span>
              <span className="w-20 text-center">
                <span className={`font-system text-os-xs px-gs-1 ${
                  scan.status === 'complete' ? 'text-gs-terminal' :
                  scan.status === 'failed' ? 'text-gs-critical' :
                  'text-gs-warning'
                }`}>
                  {scan.status}
                </span>
              </span>
              <span className="w-16 text-center">
                <span className={`font-system text-os-xs px-gs-1 bevel-raised ${
                  scan.tier === 'paid' ? 'bg-gs-red text-white' : 'bg-gs-chrome'
                }`}>
                  {scan.tier === 'paid' ? 'PRO' : 'FREE'}
                </span>
              </span>
              <span className="w-24 text-right text-data-xs text-gs-muted">
                {new Date(scan.created_at).toLocaleDateString()}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
