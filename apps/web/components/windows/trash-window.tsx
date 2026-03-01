'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   Trash — Window Content

   "Empty Trash?" with logout + account info.
   Shows login prompt if not authenticated.
   ═══════════════════════════════════════════════════════════════ */

export default function TrashWindow() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const wm = useWindowManager();

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    wm.closeWindow('trash');
    router.push('/');
    router.refresh();
  }, [router, wm]);

  if (!isAuthenticated) {
    return (
      <div className="p-gs-6 space-y-gs-6 text-center">
        <div className="font-system text-os-lg font-bold text-gs-muted">Trash</div>
        <div className="space-y-gs-2">
          <h2 className="font-system text-os-base font-bold">Trash is empty</h2>
          <p className="font-data text-data-sm text-gs-muted">
            Nothing to see here.
          </p>
        </div>
        <div className="text-data-xs text-gs-muted pt-gs-4 border-t border-gs-chrome-dark/20">
          <p>GhostScan OS v1.0</p>
          <p>© 2026 AlphaScan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-gs-6 space-y-gs-6 text-center">
      <div className="font-system text-os-lg font-bold text-gs-muted">Trash</div>

      <div className="space-y-gs-2">
        <h2 className="font-system text-os-base font-bold">Empty Trash?</h2>
        <p className="font-data text-data-sm text-gs-muted">
          This will log you out of GhostScan OS.
        </p>
      </div>

      <div className="flex items-center justify-center gap-gs-4">
        <button
          className="bevel-button-primary"
          onClick={handleLogout}
        >
          Log Out
        </button>
      </div>

      <div className="text-data-xs text-gs-muted pt-gs-4 border-t border-gs-chrome-dark/20">
        <p>GhostScan OS v1.0</p>
        <p>© 2026 AlphaScan</p>
      </div>
    </div>
  );
}
