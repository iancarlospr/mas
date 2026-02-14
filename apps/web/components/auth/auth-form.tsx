'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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

  // Compute return path: scan_url > redirect > /history
  const scanUrl = searchParams.get('scan_url');
  const redirect = searchParams.get('redirect');
  const returnPath = scanUrl
    ? `/history?auto_scan=${encodeURIComponent(scanUrl)}`
    : redirect ?? '/history';

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
          },
        });
        if (error) throw error;
        const verifyParams = new URLSearchParams({ email });
        if (scanUrl) verifyParams.set('scan_url', scanUrl);
        router.push('/verify?' + verifyParams.toString());
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(returnPath);
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(returnPath)}`,
      },
    });
    if (error) setError(error.message);
  };

  if (magicLinkSent) {
    return (
      <div className="text-center py-8">
        <h2 className="font-heading text-h3 text-primary mb-2">Check your email</h2>
        <p className="text-muted">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <button
          onClick={() => setMagicLinkSent(false)}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Use a different method
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="font-heading text-h2 text-primary text-center mb-2">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="text-sm text-muted text-center mb-8">
        {mode === 'login'
          ? 'Sign in to access your scans'
          : 'Start scanning marketing stacks for free'}
      </p>

      {/* OAuth buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleOAuth('google')}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 text-sm font-medium hover:bg-background transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>
        <button
          onClick={() => handleOAuth('apple')}
          className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-4 py-3 text-sm font-medium hover:bg-background transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </button>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface px-4 text-muted">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-primary mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="Your name"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-primary mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-primary mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            placeholder="Min. 8 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-heading font-700 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full text-sm text-accent hover:underline"
        >
          Send me a magic link instead
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <Link href={`/register${scanUrl ? `?scan_url=${encodeURIComponent(scanUrl)}` : redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-accent hover:underline font-medium">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href={`/login${scanUrl ? `?scan_url=${encodeURIComponent(scanUrl)}` : redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
