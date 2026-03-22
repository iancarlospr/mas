'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager, useWindowState } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   GhostChat Launcher — Window Content

   Two modes:
   1. Context-aware (openData.scanId set) — auto-redirects to
      the dynamic chat window, then closes this launcher.
   2. Context-free (no scanId) — lists paid scans. Click one
      to open its chat window.
   ═══════════════════════════════════════════════════════════════ */

interface PaidScan {
  id: string;
  url: string;
  marketing_iq: number | null;
  created_at: string;
  chat_messages: { count: number }[];
}

/** Register + open a dynamic GhostChat window for a specific scan */
function openChatWindow(
  wm: ReturnType<typeof useWindowManager>,
  scanId: string,
  domain?: string,
) {
  const chatId = `chat-${scanId}`;
  if (wm.windows[chatId]?.isOpen) {
    wm.focusWindow(chatId);
    return;
  }
  wm.registerWindow(chatId, {
    title: `Ask Chloé — ${domain ?? ''}`,
    width: 380,
    height: 480,
    minWidth: 340,
    minHeight: 400,
    componentType: 'ghost-chat',
  });
  wm.openWindow(chatId, { scanId, domain });
  // Pin to bottom-right corner
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  wm.moveWindow(chatId, vw - 380 - 16, vh - 480 - 44 - 16);
}

export default function ChatLauncherWindow() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const windowState = useWindowState('chat-launcher');
  const contextScanId = windowState?.openData?.scanId as string | undefined;
  const contextDomain = windowState?.openData?.domain as string | undefined;

  const [scans, setScans] = useState<PaidScan[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [redirected, setRedirected] = useState(false);

  // Auto-redirect: if scanId was passed, skip selector → open chat window directly
  useEffect(() => {
    if (contextScanId && !authLoading && isAuthenticated && !redirected) {
      setRedirected(true);
      openChatWindow(wm, contextScanId, contextDomain);
      wm.closeWindow('chat-launcher');
    }
  }, [contextScanId, contextDomain, authLoading, isAuthenticated, redirected, wm]);

  useEffect(() => {
    // Wait for auth to resolve before querying — prevents "no paid scans" flash
    if (authLoading) return;
    if (!user) {
      setDataLoading(false);
      return;
    }

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('scans')
        .select('id, url, marketing_iq, created_at, chat_messages(count)')
        .eq('user_id', user!.id)
        .eq('tier', 'paid')
        .eq('status', 'complete')
        .eq('chat_messages.role', 'user')
        .order('created_at', { ascending: false })
        .limit(20);

      setScans(data ?? []);
      setDataLoading(false);
    }
    load();
  }, [user?.id, authLoading]);

  // Handle scan click — open dynamic chat window, close launcher
  const handleScanClick = useCallback((scan: PaidScan) => {
    let domain: string;
    try {
      domain = new URL(scan.url).hostname;
    } catch {
      domain = scan.url;
    }
    openChatWindow(wm, scan.id, domain);
    wm.closeWindow('chat-launcher');
  }, [wm]);

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
            <button
              key={scan.id}
              onClick={() => handleScanClick(scan)}
              className="flex items-center gap-gs-3 px-gs-4 py-gs-3 hover:bg-gs-red/5 border-b border-gs-chrome-dark/20 w-full text-left"
            >
              <span className="font-system text-os-sm text-gs-muted">{'>'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-data text-data-sm font-bold truncate">{domain}</div>
                <div className="font-data text-data-xs text-gs-muted">
                  {scan.chat_messages?.[0]?.count
                    ? `${scan.chat_messages[0].count} message${scan.chat_messages[0].count === 1 ? '' : 's'} sent`
                    : 'No messages yet'}
                </div>
              </div>
              <span className="text-gs-muted text-data-sm">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
