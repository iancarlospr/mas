'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { analytics } from '@/lib/analytics';
import { Window } from '@/components/os/window';
import { BevelInput } from '@/components/os/bevel-input';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Signup Wall (Pre-Auth Gate)
 * ═══════════════════════════════════════════════
 *
 * WHAT: Overlay prompting anonymous users to sign up to see scan results.
 * WHY:  The fake scan hooked them — now convert. The retro dialog style
 *       makes this feel like a system prompt, not a paywall (Plan Section 15).
 * HOW:  Full-screen overlay with CRT grain, Window dialog, Chloé persuasion,
 *       bevel inputs, OAuth buttons. All auth logic preserved.
 */

interface SignupWallProps {
  domain: string;
  scanUrl: string;
}

export function SignupWall({ domain, scanUrl }: SignupWallProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const router = useRouter();
  const supabase = createClient();

  const storePendingUrl = () => {
    try {
      localStorage.setItem(
        'alphascan_pending_url',
        JSON.stringify({ url: scanUrl, timestamp: Date.now() }),
      );
    } catch { /* localStorage unavailable */ }
  };

  const returnPath = `/history?auto_scan=${encodeURIComponent(scanUrl)}`;

  const handleOAuth = async (provider: 'google' | 'apple') => {
    storePendingUrl();
    analytics.signupWallConverted(domain);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });
    if (error) setError(error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        storePendingUrl();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
          },
        });
        if (error) throw error;
        analytics.signupWallConverted(domain);
        try {
          localStorage.setItem(
            'alphascan_pending_verification',
            JSON.stringify({ email, scanUrl, timestamp: Date.now() }),
          );
        } catch { /* localStorage unavailable */ }
        router.push(`/verify?email=${encodeURIComponent(email)}&scan_url=${encodeURIComponent(scanUrl)}`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        analytics.signupWallConverted(domain);
        router.push(returnPath);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed. Try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark CRT backdrop */}
      <div className="absolute inset-0 bg-gs-ink/90" />
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative">
        {/* Chloé */}
        <div className="absolute -top-[80px] left-1/2 -translate-x-1/2">
          <ChloeSprite state="smug" size={32} glowing />
        </div>

        <Window
          id="signup-wall"
          title={mode === 'register' ? 'Create Account to Continue' : 'Sign In to Continue'}
          variant="dialog"
          isActive
          width={420}
        >
          <div className="p-gs-6 space-y-gs-4">
            <div className="text-center">
              <p className="font-data text-data-sm text-gs-muted">
                Your audit of <strong className="text-gs-red">{domain}</strong> is ready.
                {mode === 'register' ? ' Create a free account to see all 42 modules.' : ' Sign in to see your results.'}
              </p>
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
              <div className="flex-1 h-px bg-gs-muted" />
              <span className="font-system text-os-xs text-gs-muted">or</span>
              <div className="flex-1 h-px bg-gs-muted" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-gs-3">
              {mode === 'register' && (
                <BevelInput
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  fullWidth
                />
              )}
              <BevelInput
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                required
                placeholder="you@company.com"
                fullWidth
              />
              <BevelInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                fullWidth
              />

              {error && (
                <div className="bevel-sunken bg-gs-critical/10 px-gs-3 py-gs-2">
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
                  : mode === 'register'
                    ? '▶ Create Account'
                    : '▶ Sign In'}
              </button>
            </form>

            <p className="text-center font-data text-data-xs text-gs-muted">
              {mode === 'register' ? (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(null); }}
                    className="text-gs-red hover:underline font-bold"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => { setMode('register'); setError(null); }}
                    className="text-gs-red hover:underline font-bold"
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>

            <p className="text-center font-data text-data-xs text-gs-muted">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-gs-red hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-gs-red hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </Window>
      </div>
    </div>
  );
}
