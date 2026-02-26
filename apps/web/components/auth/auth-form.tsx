'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Window } from '@/components/os/window';
import { BevelInput } from '@/components/os/bevel-input';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { ChloeSpeech } from '@/components/chloe/chloe-speech';
import { pickRandom, GREETINGS, ERROR_STATES } from '@/lib/chloe-ai-copy';

/**
 * Chloe's Bedroom OS — Auth Form
 * ================================
 *
 * Login/register form as a frosted glass dialog on dark background.
 * You're "outside" the OS, trying to get in.
 */

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [greeting] = useState(() =>
    mode === 'login' ? pickRandom(GREETINGS.login) : pickRandom(GREETINGS.register),
  );

  const scanUrl = searchParams.get('scan_url');
  const redirect = searchParams.get('redirect');
  const returnPath = scanUrl
    ? `/history?auto_scan=${encodeURIComponent(scanUrl)}`
    : redirect ?? '/history';

  /* -- Auth handlers ------------------------------------------ */

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
          },
        });
        if (err) throw err;
        const verifyParams = new URLSearchParams({ email });
        if (scanUrl) verifyParams.set('scan_url', scanUrl);
        router.push('/verify?' + verifyParams.toString());
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push(returnPath);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : pickRandom(ERROR_STATES.authError);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
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
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
      },
    });
    if (err) setError(err.message);
  };

  /* -- Magic link sent state ---------------------------------- */
  if (magicLinkSent) {
    return (
      <div className="fixed inset-0 bg-gs-void flex items-center justify-center">
        <div className="noise-grain" aria-hidden="true" />
        <div className="relative">
          <ChloeSprite state="smug" size={64} glowing className="mx-auto mb-gs-4" />
          <Window id="magic-link" title="Check Your Email" variant="dialog" isActive width={380}>
            <div className="p-gs-6 text-center">
              <p className="font-data text-data-lg text-gs-light mb-gs-2">
                Magic link sent to <strong className="text-gs-base">{email}</strong>
              </p>
              <p className="font-data text-data-sm text-gs-mid mb-gs-4">
                Click the link in your email to access AlphaScan.
              </p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="bevel-button text-os-sm"
              >
                Use a different method
              </button>
            </div>
          </Window>
        </div>
      </div>
    );
  }

  /* -- Main auth form ----------------------------------------- */
  return (
    <div className="fixed inset-0 bg-gs-void flex items-center justify-center">
      <div className="noise-grain" aria-hidden="true" />

      <div className="relative">
        {/* Chloe greeting */}
        <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 flex flex-col items-center">
          <ChloeSprite state="chat" size={64} glowing />
          <ChloeSpeech
            message={greeting}
            variant="ghost"
            tailPosition="bottom-left"
            autoDismissMs={0}
            className="mt-gs-2"
          />
        </div>

        {/* Auth dialog window */}
        <Window
          id="auth"
          title={
            mode === 'login'
              ? 'AlphaScan — Authentication Required'
              : 'AlphaScan — Create Account'
          }
          variant="dialog"
          isActive
          width={400}
        >
          <div className="p-gs-6 space-y-gs-4">
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
              <button
                onClick={() => handleOAuth('apple')}
                className="bevel-button w-full text-os-sm justify-center gap-gs-2"
              >
                Continue with Apple
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
              {mode === 'register' && (
                <div>
                  <label className="block font-system text-os-xs text-gs-mid mb-gs-1">
                    Name:
                  </label>
                  <BevelInput
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
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
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
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

            {/* Switch mode link */}
            <p className="text-center font-data text-data-xs text-gs-mid">
              {mode === 'login' ? (
                <>
                  New operative?{' '}
                  <Link
                    href={`/register${scanUrl ? `?scan_url=${encodeURIComponent(scanUrl)}` : redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                    className="text-gs-base hover:text-gs-bright hover:underline font-bold transition-colors"
                  >
                    Create account
                  </Link>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <Link
                    href={`/login${scanUrl ? `?scan_url=${encodeURIComponent(scanUrl)}` : redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                    className="text-gs-base hover:text-gs-bright hover:underline font-bold transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </Window>
      </div>
    </div>
  );
}
