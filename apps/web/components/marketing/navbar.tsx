'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * GhostScan OS — Marketing NavBar
 * ═══════════════════════════════════════
 *
 * WHAT: Top navigation for marketing pages (landing, pricing, about, blog).
 * WHY:  The old navbar was generic SaaS with glass blur. Now it matches
 *       the GhostScan OS aesthetic — menu bar style, pixel font logo,
 *       Chloé's gradient accent (Plan Section 14).
 * HOW:  Bevel-raised bar with system font, ghost pixel logo, retro
 *       link styling. Preserves all auth logic (Supabase user state,
 *       sign out, conditional nav items).
 */

const navLinks = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-gs-light bevel-raised border-b-0">
      <div className="mx-auto max-w-7xl px-gs-4">
        <div className="flex h-[44px] items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-gs-2">
            <span className="text-os-lg">👻</span>
            <span className="font-system text-os-base font-bold text-ghost-gradient">
              AlphaScan
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-gs-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bevel-button text-os-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth actions */}
          <div className="hidden md:flex items-center gap-gs-2">
            {user ? (
              <>
                <Link href="/history" className="bevel-button-primary text-os-sm">
                  My Scans
                </Link>
                <button
                  onClick={handleSignOut}
                  className="bevel-button text-os-sm"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="bevel-button text-os-sm">
                  Log in
                </Link>
                <Link href="/register" className="bevel-button-primary text-os-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden bevel-button p-gs-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="font-system text-os-base">
              {mobileOpen ? '✕' : '☰'}
            </span>
          </button>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gs-mid py-gs-3 bg-gs-light">
            <nav className="flex flex-col gap-gs-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="bevel-button text-os-sm w-full text-left"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-gs-2 pt-gs-3 border-t border-gs-mid mt-gs-2">
                {user ? (
                  <>
                    <Link
                      href="/history"
                      className="bevel-button-primary text-os-sm flex-1 text-center"
                      onClick={() => setMobileOpen(false)}
                    >
                      My Scans
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileOpen(false);
                      }}
                      className="bevel-button text-os-sm"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="bevel-button text-os-sm"
                      onClick={() => setMobileOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/register"
                      className="bevel-button-primary text-os-sm flex-1 text-center"
                      onClick={() => setMobileOpen(false)}
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
