'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';
import { BevelInput } from '@/components/os/bevel-input';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Profile — Managed Window

   Full account management: info, edit name, change password,
   billing history, chat credits, danger zone.
   ═══════════════════════════════════════════════════════════════ */

interface PaymentRow {
  id: string;
  product: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

const PRODUCT_LABELS: Record<string, string> = {
  alpha_brief: 'Alpha Brief',
  alpha_brief_plus: 'Alpha Brief Plus',
  chat_credits_15: 'Chat Credits (15)',
  chat_credits: 'Chat Credits (100)',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProfileWindow() {
  const { user, loading: authLoading, isAuthenticated, refreshUser } = useAuth();
  const wm = useWindowManager();
  const router = useRouter();

  // Data state
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [chatCredits, setChatCredits] = useState<number | null>(null);
  const [scanCredits, setScanCredits] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Edit name
  const [editName, setEditName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load user data
  useEffect(() => {
    if (!user) return;

    setEditName(user.user_metadata?.name ?? '');

    async function loadData() {
      const supabase = createClient();

      const [scansRes, paymentsRes, creditsRes, scanCreditsRes] = await Promise.all([
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id),
        supabase
          .from('payments')
          .select('id, product, amount_cents, status, created_at')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('chat_credits')
          .select('remaining')
          .eq('user_id', user!.id)
          .maybeSingle(),
        supabase
          .from('scan_credits')
          .select('remaining')
          .eq('user_id', user!.id)
          .maybeSingle(),
      ]);

      setScanCount(scansRes.count ?? 0);
      setPayments((paymentsRes.data as PaymentRow[] | null) ?? []);
      setChatCredits(creditsRes.data?.remaining ?? null);
      setScanCredits(scanCreditsRes.data?.remaining ?? null);
      setDataLoading(false);
    }

    loadData();
  }, [user]);

  // Handlers
  const handleUpdateName = useCallback(async () => {
    if (!editName.trim()) return;
    setNameSaving(true);
    setNameMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { name: editName.trim() } });

    if (error) {
      setNameMsg({ type: 'error', text: error.message });
    } else {
      setNameMsg({ type: 'success', text: 'Name updated.' });
      await refreshUser();
    }
    setNameSaving(false);
  }, [editName, refreshUser]);

  const handleChangePassword = useCallback(async () => {
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPwSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPwMsg({ type: 'error', text: error.message });
    } else {
      setPwMsg({ type: 'success', text: 'Password changed.' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setPwSaving(false);
  }, [newPassword, confirmPassword]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    wm.closeWindow('profile');
    router.push('/');
    router.refresh();
  }, [wm, router]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to delete account.');
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      wm.closeWindow('profile');
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.');
      setDeleting(false);
    }
  }, [deleteConfirm, wm, router]);

  // Not authenticated
  if (authLoading) {
    return (
      <div className="p-gs-6 flex items-center justify-center h-full">
        <span className="font-system text-os-base text-gs-muted animate-blink">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="p-gs-8 text-center space-y-gs-4">
        <div className="font-system text-os-lg font-bold text-gs-muted">Locked</div>
        <h2 className="font-system text-os-base font-bold">Login Required</h2>
        <p className="font-data text-data-sm text-gs-muted">
          Log in to view your profile.
        </p>
        <button
          onClick={() => wm.openWindow('auth')}
          className="bevel-button-primary"
        >
          Log In
        </button>
      </div>
    );
  }

  const provider = user.app_metadata?.provider ?? 'email';
  const isOAuth = provider !== 'email';
  const displayName = user.user_metadata?.name ?? '';
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="h-full overflow-auto">
      {/* Account Info */}
      <div className="p-gs-6 space-y-gs-4 border-b border-gs-mid/20">
        <div className="flex items-center gap-gs-4">
          <div className="w-[48px] h-[48px] rounded-full bg-gs-base/20 flex items-center justify-center flex-shrink-0">
            <span className="font-system text-os-lg font-bold text-gs-base">
              {(displayName || user.email || '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            {displayName && (
              <div className="font-system text-os-base font-bold text-gs-light truncate">
                {displayName}
              </div>
            )}
            <div className="font-data text-data-sm text-gs-mid truncate">
              {user.email}
            </div>
            <div className="flex items-center gap-gs-2 mt-gs-1">
              <span className={cn(
                'font-system text-os-xs px-gs-1 rounded',
                isOAuth ? 'bg-gs-base/15 text-gs-base' : 'bg-gs-mid/15 text-gs-mid',
              )}>
                {provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Email'}
              </span>
              <span className="font-data text-data-xs text-gs-mid">
                since {memberSince}
              </span>
              {scanCount != null && (
                <span className="font-data text-data-xs text-gs-mid">
                  {scanCount} scan{scanCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Name */}
      <div className="p-gs-6 space-y-gs-3 border-b border-gs-mid/20">
        <h3 className="font-system text-os-sm font-bold text-gs-light">Edit Name</h3>
        <div className="flex gap-gs-2">
          <BevelInput
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your name"
            fullWidth
          />
          <button
            onClick={handleUpdateName}
            disabled={nameSaving || !editName.trim()}
            className="bevel-button text-os-sm flex-shrink-0"
          >
            {nameSaving ? '...' : 'Update'}
          </button>
        </div>
        {nameMsg && (
          <p className={cn('font-data text-data-xs', nameMsg.type === 'success' ? 'text-gs-terminal' : 'text-gs-critical')}>
            {nameMsg.text}
          </p>
        )}
      </div>

      {/* Change Password */}
      <div className="p-gs-6 space-y-gs-3 border-b border-gs-mid/20">
        <h3 className="font-system text-os-sm font-bold text-gs-light">Change Password</h3>
        {isOAuth ? (
          <p className="font-data text-data-sm text-gs-mid">
            Password managed by {provider === 'google' ? 'Google' : 'Apple'}. Sign in with your {provider === 'google' ? 'Google' : 'Apple'} account instead.
          </p>
        ) : (
          <>
            <BevelInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min. 8 chars)"
              minLength={8}
              fullWidth
            />
            <BevelInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              fullWidth
            />
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !newPassword}
              className="bevel-button text-os-sm"
            >
              {pwSaving ? 'Saving...' : 'Change Password'}
            </button>
            {pwMsg && (
              <p className={cn('font-data text-data-xs', pwMsg.type === 'success' ? 'text-gs-terminal' : 'text-gs-critical')}>
                {pwMsg.text}
              </p>
            )}
          </>
        )}
      </div>

      {/* Billing & Payments */}
      <div className="p-gs-6 space-y-gs-3 border-b border-gs-mid/20">
        <h3 className="font-system text-os-sm font-bold text-gs-light">Billing</h3>
        {dataLoading ? (
          <p className="font-data text-data-sm text-gs-muted animate-blink">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="font-data text-data-sm text-gs-muted">No payments yet.</p>
        ) : (
          <div className="space-y-gs-1">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-gs-2 font-data text-data-sm py-gs-1">
                <span className="flex-1 text-gs-light truncate">
                  {PRODUCT_LABELS[p.product] ?? p.product}
                </span>
                <span className="text-gs-base font-bold w-16 text-right">
                  {formatCents(p.amount_cents)}
                </span>
                <span className={cn(
                  'font-system text-os-xs px-gs-1 w-20 text-center',
                  p.status === 'completed' ? 'text-gs-terminal' :
                  p.status === 'failed' ? 'text-gs-critical' :
                  p.status === 'refunded' ? 'text-gs-warning' :
                  'text-gs-mid',
                )}>
                  {p.status}
                </span>
                <span className="text-data-xs text-gs-muted w-20 text-right">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan Credits */}
      <div className="p-gs-6 space-y-gs-3 border-b border-gs-mid/20">
        <h3 className="font-system text-os-sm font-bold text-gs-light">Scan Credits</h3>
        {dataLoading ? (
          <p className="font-data text-data-sm text-gs-muted animate-blink">Loading...</p>
        ) : scanCredits != null && scanCredits > 0 ? (
          <p className="font-data text-data-base text-gs-light">
            <span className="text-gs-base font-bold">{scanCredits}</span> credit{scanCredits !== 1 ? 's' : ''} remaining
          </p>
        ) : (
          <p className="font-data text-data-sm text-gs-muted">No scan credits remaining.</p>
        )}
        <button
          onClick={() => wm.openWindow('pricing')}
          className="bevel-button text-os-sm"
        >
          Buy More Scans
        </button>
      </div>

      {/* Chat Credits */}
      <div className="p-gs-6 space-y-gs-3 border-b border-gs-mid/20">
        <h3 className="font-system text-os-sm font-bold text-gs-light">Chat Credits</h3>
        {dataLoading ? (
          <p className="font-data text-data-sm text-gs-muted animate-blink">Loading...</p>
        ) : chatCredits != null ? (
          <p className="font-data text-data-base text-gs-light">
            <span className="text-gs-base font-bold">{chatCredits}</span> credit{chatCredits !== 1 ? 's' : ''} remaining
          </p>
        ) : (
          <p className="font-data text-data-sm text-gs-muted">No chat credits.</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="p-gs-6 space-y-gs-4 bg-gs-critical/5">
        <h3 className="font-system text-os-sm font-bold text-gs-critical">Danger Zone</h3>

        <div className="flex items-center gap-gs-3">
          <button
            onClick={handleSignOut}
            className="bevel-button text-os-sm"
          >
            Sign Out
          </button>
        </div>

        <div className="space-y-gs-2 pt-gs-2 border-t border-gs-critical/20">
          <p className="font-data text-data-xs text-gs-critical">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <div className="flex gap-gs-2">
            <BevelInput
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              fullWidth
              className="!border-gs-critical/30 focus:!border-gs-critical focus:!ring-gs-critical/30"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== 'DELETE' || deleting}
              className={cn(
                'bevel-button text-os-sm flex-shrink-0',
                deleteConfirm === 'DELETE' && '!bg-gs-critical/20 !text-gs-critical !border-gs-critical/40',
              )}
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
          {deleteError && (
            <p className="font-data text-data-xs text-gs-critical">{deleteError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
