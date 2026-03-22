'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   GhostChat Launcher — Window Content

   Lists paid scans. Click one to open /chat/[scanId].
   If no paid scans, shows upgrade prompt.
   ═══════════════════════════════════════════════════════════════ */

interface PaidScan {
  id: string;
  url: string;
  marketing_iq_score: number | null;
  created_at: string;
}

export default function ChatLauncherWindow() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const [scans, setScans] = useState<PaidScan[]>([]);
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
        .select('id, url, marketing_iq_score, created_at')
        .eq('user_id', user!.id)
        .eq('tier', 'paid')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(20);

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
          Log in to chat with Chloé about your scans.
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
        <h2 className="font-system text-os-base font-bold">No paid scans yet</h2>
        <p className="font-data text-data-sm text-gs-muted">
          Upgrade a scan to Alpha Brief to unlock GhostChat.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-gs-4 py-gs-2 bg-gs-chrome border-b border-gs-chrome-dark">
        <p className="font-system text-os-xs text-gs-muted">
          Select a scan to chat with Chloé:
        </p>
      </div>
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
              href={`/chat/${scan.id}`}
              className="flex items-center gap-gs-3 px-gs-4 py-gs-3 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20"
            >
              <span className="font-system text-os-sm text-gs-muted">{'>'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-data text-data-sm font-bold truncate">{domain}</div>
                <div className="font-data text-data-xs text-gs-muted">
                  Score: {scan.marketing_iq_score ?? '—'} · {new Date(scan.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className="text-gs-muted text-data-sm">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
