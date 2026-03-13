'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import posthog from 'posthog-js';
import { createClient } from '@/lib/supabase/client';

/* ═══════════════════════════════════════════════════════════════
   Auth Context — Single source of truth for client-side auth

   Wraps Supabase onAuthStateChange at the shell level.
   All components use useAuth() instead of ad-hoc getUser() calls.
   ═══════════════════════════════════════════════════════════════ */

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Identify the user in PostHog with person properties */
function identifyUser(u: User) {
  if (typeof window === 'undefined' || !posthog.__loaded) return;

  posthog.identify(u.id, {
    email: u.email,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name,
    created_at: u.created_at,
    auth_provider: u.app_metadata?.provider,
  });
  posthog.people.set_once({
    first_seen_at: new Date().toISOString(),
    signup_method: u.app_metadata?.provider ?? 'email',
  });
}

/** Detect new account creation (created_at within last 60s) */
function maybeTrackAccountCreation(u: User) {
  if (typeof window === 'undefined' || !posthog.__loaded) return;

  const createdAt = new Date(u.created_at).getTime();
  const now = Date.now();
  if (now - createdAt < 60_000) {
    posthog.capture('account_created', {
      method: u.app_metadata?.provider ?? 'email',
      email_domain: u.email?.split('@')[1],
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch — identify if already logged in
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
      if (u) identifyUser(u);
    });

    // Reactive listener for login/logout/token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        setLoading(false);

        if (event === 'SIGNED_IN' && u) {
          identifyUser(u);
          maybeTrackAccountCreation(u);
        } else if (event === 'TOKEN_REFRESHED' && u) {
          identifyUser(u);
        } else if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined' && posthog.__loaded) {
            posthog.reset();
          }
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
  }, []);

  const isAuthenticated = user != null;

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
