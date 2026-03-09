'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { BevelInput } from '@/components/os/bevel-input';
import { ResendVerificationButton } from '@/app/(auth)/verify/resend-button';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   auth.exe — Managed Auth Window

   Tabbed sign-in / register / magic-link / verify-email inside
   the desktop shell. No page navigation, no full-screen overlay.
   ═══════════════════════════════════════════════════════════════ */

type AuthTab = 'sign-in' | 'register' | 'magic-link-sent' | 'verify-email';

export default function AuthWindow() {
  const { isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const orchestrator = useScanOrchestrator();
  const winState = useWindowState('auth');
  const openData = winState?.openData;

  const initialTab = (openData?.tab as AuthTab | undefined) ?? 'sign-in';
  const [tab, setTab] = useState<AuthTab>(initialTab);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync tab when openData changes (e.g., opened from route orchestrator)
  useEffect(() => {
    if (openData?.tab) {
      setTab(openData.tab as AuthTab);
    }
  }, [openData?.tab]);

  // Auto-close if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      wm.closeWindow('auth');
    }
  }, [isAuthenticated, wm]);

  const supabase = createClient();

  const isScanGate = openData?.scanGate === true;
  const returnPath = isScanGate ? '/?scan_gate=true' : '/';

  /* -- Handlers ------------------------------------------------ */

  const handleEmailAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'register') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
          },
        });
        if (err) throw err;
        // Pass userId + credentials to AuthGatePoller.
        // Poller checks /api/auth/check-verified?userId=<uuid> (no auth logs).
        // On confirmation, signs in once with credentials to establish session.
        if (isScanGate && data.user) {
          orchestrator.setGateIdentity(data.user.id, email, password);
        }
        setTab('verify-email');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // onAuthStateChange fires → useAuth updates → auto-close
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tab, email, password, name, supabase.auth, returnPath]);

  const handleMagicLink = useCallback(async () => {
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
      },
    });

    if (err) {
      setError(err.message);
    } else {
      setTab('magic-link-sent');
    }
    setLoading(false);
  }, [email, supabase.auth, returnPath]);

  const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });
    if (err) setError(err.message);
  }, [supabase.auth, returnPath]);

  /* -- Magic link sent state ----------------------------------- */
  if (tab === 'magic-link-sent') {
    return (
      <div className="p-gs-6 text-center space-y-gs-4">
        <div className="font-system text-os-lg font-bold text-gs-base">Check Your Email</div>
        <p className="font-data text-data-base text-gs-light">
          Magic link sent to <strong className="text-gs-base">{email}</strong>
        </p>
        <p className="font-data text-data-sm text-gs-mid">
          Click the link in your email to access AlphaScan.
        </p>
        <button
          onClick={() => { setTab('sign-in'); setError(null); }}
          className="bevel-button text-os-sm"
        >
          Use a different method
        </button>
      </div>
    );
  }

  /* -- Verify email state -------------------------------------- */
  if (tab === 'verify-email') {
    return (
      <div className="p-gs-6 text-center space-y-gs-4">
        <div className="font-system text-os-lg font-bold text-gs-base">Verify Your Email</div>
        <p className="font-data text-data-base text-gs-light">
          Confirmation sent to <strong className="text-gs-base">{email}</strong>
        </p>
        <p className="font-data text-data-sm text-gs-mid">
          Click the link in your email to activate your account.
        </p>
        {email && <ResendVerificationButton email={email} />}
        <button
          onClick={() => { setTab('sign-in'); setError(null); }}
          className="font-data text-data-xs text-gs-mid hover:text-gs-light transition-colors"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  /* -- Main auth form (sign-in / register) --------------------- */
  const isRegister = tab === 'register';

  return (
    <div className="p-gs-6 space-y-gs-4">
      {/* Tab bar */}
      <div className="flex rounded-lg bg-gs-void/40 p-0.5">
        <button
          className={cn(
            'flex-1 py-gs-1 font-system text-os-sm text-center rounded-md transition-all',
            !isRegister
              ? 'bg-gs-base/20 text-gs-base font-bold'
              : 'text-gs-mid hover:text-gs-light',
          )}
          onClick={() => { setTab('sign-in'); setError(null); }}
        >
          Sign In
        </button>
        <button
          className={cn(
            'flex-1 py-gs-1 font-system text-os-sm text-center rounded-md transition-all',
            isRegister
              ? 'bg-gs-base/20 text-gs-base font-bold'
              : 'text-gs-mid hover:text-gs-light',
          )}
          onClick={() => { setTab('register'); setError(null); }}
        >
          Register
        </button>
      </div>

      {/* OAuth buttons */}
      <div className="space-y-gs-2">
        <button
          onClick={() => handleOAuth('google')}
          className="bevel-button w-full text-os-sm justify-center gap-gs-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-gs-3">
        <div className="flex-1 h-px bg-gs-mid/40" />
        <span className="font-system text-os-xs text-gs-mid">or</span>
        <div className="flex-1 h-px bg-gs-mid/40" />
      </div>

      {/* Email/password form */}
      <form onSubmit={handleEmailAuth} className="space-y-gs-3">
        {isRegister && (
          <div>
            <label className="block font-system text-os-xs text-gs-mid mb-gs-1">
              Name:
            </label>
            <BevelInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              fullWidth
            />
          </div>
        )}
        <div>
          <label className="block font-system text-os-xs text-gs-mid mb-gs-1">
            Email:
          </label>
          <BevelInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
            autoComplete="email"
            fullWidth
          />
        </div>
        <div>
          <label className="block font-system text-os-xs text-gs-mid mb-gs-1">
            Password:
          </label>
          <BevelInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min. 8 characters"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            fullWidth
          />
        </div>

        {error && (
          <div className="bg-gs-critical/10 border border-gs-critical/30 rounded-lg px-gs-3 py-gs-2">
            <p className="font-data text-data-xs text-gs-critical">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bevel-button-primary w-full text-os-sm"
        >
          {loading
            ? 'Loading...'
            : isRegister
              ? 'Create Account'
              : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full font-data text-data-xs text-gs-base hover:text-gs-bright text-center transition-colors"
        >
          Send me a magic link instead
        </button>
      </form>
    </div>
  );
}
