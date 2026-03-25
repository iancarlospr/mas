'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { MobileChloeLaser } from '@/components/chloe/mobile-chloe-laser';
import { UserCircle } from 'lucide-react';
import { MobileScanFlow } from '@/components/mobile/mobile-scan-flow';
import { MobilePricingSection } from '@/components/mobile/mobile-pricing-section';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { analytics } from '@/lib/analytics';
import FeaturesWindow from '@/components/windows/features-window';
import ProductsWindow from '@/components/windows/products-window';
import CustomersWindow from '@/components/windows/customers-window';
import AboutWindow from '@/components/windows/about-window';
import HistoryWindow from '@/components/windows/history-window';
import ProfileWindow from '@/components/windows/profile-window';
import AuthWindow from '@/components/windows/auth-window';
import ChatWindow from '@/components/windows/chat-window';
import { DesktopReminderForm } from '@/components/mobile/desktop-reminder-form';
import { createClient } from '@/lib/supabase/client';

interface MobilePaidScan {
  id: string;
  url: string;
  marketing_iq: number | null;
  created_at: string;
  chat_messages: { count: number }[];
}

/**
 * Mobile Landing Page (replaces old MobileGate)
 *
 * Viewport < 1024px: scrollable marketing landing page.
 * Viewport >= 1024px: pass through to DesktopShell.
 *
 * Sections: Hero (scan-input mirror) → Features → Products → Pricing → Social Proof → Desktop CTA
 */

/* ── Bayer 8x8 dither (extracted from managed-window.tsx) ─────── */

const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

function DitherStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.offsetWidth;
    if (w === 0) return;

    const height = 40;
    const scale = 2;
    const cols = Math.ceil(w / scale);
    const rows = Math.ceil(height / scale);

    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = w + 'px';
    canvas.style.height = height + 'px';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const r = 255, g = 178, b = 239; // #FFB2EF
    const br = 18, bg2 = 15, bb = 19; // dark bg

    const imageData = ctx.createImageData(cols, rows);
    const data = imageData.data;

    for (let y = 0; y < rows; y++) {
      const gradient = 1.0 - (y / rows);
      for (let x = 0; x < cols; x++) {
        const threshold = BAYER8[y % 8]![x % 8]! / 64;
        const idx = (y * cols + x) * 4;
        if (gradient > threshold) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        } else {
          data[idx] = br;
          data[idx + 1] = bg2;
          data[idx + 2] = bb;
        }
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{ height: 40, background: '#FFB2EF' }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

/* ── Bouncing arrow ──────────────────────────────────────────── */

function CurvedArrow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      if (!ref.current) return;
      frame++;
      const y = Math.sin(frame * 0.08) * 6;
      ref.current.style.transform = `translateY(${y}px)`;
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={ref} className="font-marker select-none" style={{ marginTop: '16px' }}>
      <span
        style={{
          fontSize: '44px',
          color: 'var(--gs-base)',
          display: 'block',
          lineHeight: '0.7',
        }}
      >
        &#8595;
      </span>
    </div>
  );
}

/* ── ASCII title ─────────────────────────────────────────────── */

const ASCII_TITLE = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

/* ── Section divider ─────────────────────────────────────────── */

function SectionDivider() {
  return (
    <div className="flex items-center gap-gs-3 px-gs-4">
      <div className="flex-1 border-t border-gs-mid/15" />
      <span className="font-data text-[9px] text-gs-mid/30 tracking-[0.2em] uppercase select-none">
        ···
      </span>
      <div className="flex-1 border-t border-gs-mid/15" />
    </div>
  );
}

/* ── Animated ghost for sticky bar ───────────────────────────── */

function AnimatedChloe({ size, state, className }: { size: 32 | 64; state: 'idle'; className?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 8), 500);
    return () => clearInterval(id);
  }, []);
  return <ChloeSprite state={state} size={size} frame={frame} className={className} />;
}

/* ── Main component ──────────────────────────────────────────── */

/* Routes that should render their own page content on mobile instead of the landing page */
const MOBILE_PASSTHROUGH = ['/login', '/register', '/auth/', '/scan/', '/chat/', '/history', '/verify'];

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const myScansRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const wm = useWindowManager();
  const orchestrator = useScanOrchestrator();
  // Key to force HistoryWindow remount after scan completes (re-fetches data)
  const [historyKey, setHistoryKey] = useState(0);
  const prevScanIdRef = useRef<string | null>(null);
  // Overlay state for auth + profile + chat
  const [mobileOverlay, setMobileOverlay] = useState<'login' | 'register' | 'profile' | 'chat' | null>(null);
  const [chatContext, setChatContext] = useState<{ scanId: string; domain: string } | null>(null);
  // Paid scan detection for conditional layout
  const [paidScans, setPaidScans] = useState<MobilePaidScan[]>([]);
  const [paidScansLoaded, setPaidScansLoaded] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Track hero visibility for sticky CTA
  useEffect(() => {
    if (!isMobile || !heroRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

  // Force HistoryWindow remount when a scan completes (activeScanId goes from non-null to null)
  useEffect(() => {
    if (prevScanIdRef.current && !orchestrator.activeScanId) {
      setHistoryKey((k) => k + 1);
    }
    prevScanIdRef.current = orchestrator.activeScanId;
  }, [orchestrator.activeScanId]);

  // Fetch paid scans for conditional layout (GhostChat section)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPaidScans([]);
      setPaidScansLoaded(true);
      return;
    }
    const supabase = createClient();
    supabase
      .from('scans')
      .select('id, url, marketing_iq, created_at, chat_messages(count)')
      .eq('user_id', user.id)
      .eq('tier', 'paid')
      .eq('status', 'complete')
      .eq('chat_messages.role', 'user')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setPaidScans((data as MobilePaidScan[] | null) ?? []);
        setPaidScansLoaded(true);
      });
  }, [user?.id, authLoading, historyKey]); // refetch when historyKey changes (scan completes)

  const isPaidUser = paidScans.length > 0;

  // Clear auth overlay when user logs in
  useEffect(() => {
    if (isAuthenticated && (mobileOverlay === 'login' || mobileOverlay === 'register')) {
      setMobileOverlay(null);
    }
  }, [isAuthenticated, mobileOverlay]);

  // Auto-scan after registration: detect pending URL in localStorage
  useEffect(() => {
    if (!isMobile || authLoading || !isAuthenticated) return;

    let raw: string | null = null;
    try { raw = localStorage.getItem('alphascan_pending_url'); } catch { /* */ }
    if (!raw) return;

    let parsed: { url: string; timestamp: number };
    try {
      parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem('alphascan_pending_url');
        return;
      }
    } catch {
      localStorage.removeItem('alphascan_pending_url');
      return;
    }

    localStorage.removeItem('alphascan_pending_url');

    // Fire auto-scan (Turnstile bypassed for recent sign-ins)
    (async () => {
      try {
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: parsed.url, turnstileToken: '', autoScan: true }),
        });
        if (!res.ok) return;
        const { scanId, cached } = await res.json();
        const domain = new URL(parsed.url).hostname;
        analytics.scanStarted(domain, 'full');

        orchestrator.setMobileCompleteHandler(() => {
          setTimeout(() => {
            myScansRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        });
        orchestrator.startScan(scanId, domain, cached);
      } catch { /* ignore */ }
    })();
  }, [isMobile, authLoading, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToPricing = useCallback(() => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToMyScans = useCallback(() => {
    myScansRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const openChatOverlay = useCallback((scanId: string, domain: string) => {
    setChatContext({ scanId, domain });
    setMobileOverlay('chat');
  }, []);

  // Mobile credit purchase: POST to checkout API, redirect to Stripe
  const handlePurchaseCredits = useCallback(async (product: string, scanId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, scanId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      }
    } catch { /* ignore — Stripe redirect failed */ }
  }, []);

  const openAuthOverlay = useCallback((mode: 'login' | 'register') => {
    // Register auth window if not already (DesktopShell doesn't mount on mobile)
    if (!wm.windows['auth']) {
      wm.registerWindow('auth', { title: 'auth.exe', width: 440, height: 480, variant: 'dialog' });
    }
    // Set openData so AuthWindow reads the correct initial tab
    // scanGate: true enables credential storage + verification polling (mobile email apps open links in webviews)
    wm.openWindow('auth', { tab: mode === 'register' ? 'register' : 'sign-in', scanGate: true });
    setMobileOverlay(mode);
  }, [wm]);

  // Desktop: pass through
  if (!isMobile) {
    return <>{children}</>;
  }

  // Mobile: pass through for auth, scan, and dashboard routes
  if (MOBILE_PASSTHROUGH.some((prefix) => pathname.startsWith(prefix))) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-gs-void flex flex-col overflow-hidden">
      <style>{`
        .mobile-scan-input-stack .flex.items-end {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 8px !important;
        }
        .mobile-scan-input-stack .flex.items-end > .flex-1 {
          flex: none !important;
          width: 100% !important;
        }
        .mobile-scan-input-stack input[type="text"] {
          height: 42px !important;
        }
        .mobile-scan-input-stack .flex.items-end > button {
          flex: none !important;
          width: 100% !important;
        }
        /* ── My Scans: card layout handles its own spacing ── */
        /* ── About footer: tighter bottom spacing ── */
        .mobile-about-footer > div { padding-bottom: 4px !important; }
        .mobile-about-footer .border-t { margin-top: 8px !important; padding-top: 8px !important; }
      `}</style>
      <div className="noise-grain opacity-[0.03]" aria-hidden="true" />

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">

        {/* ═══════ SECTION 1: HERO ═══════ */}
        <section ref={heroRef} className="flex flex-col items-center min-h-[100svh] pb-gs-6">

          {/* Dither strip — full bleed, top */}
          <DitherStrip />

          {/* ① Space above logo */}
          <div style={{ flex: 2 }} />

          {/* ASCII Title — full-bleed, scaled for mobile */}
          <div className="w-full overflow-hidden flex justify-center" style={{ padding: '0 4px' }}>
            <pre
              className="font-data leading-none whitespace-pre select-none text-center"
              style={{
                fontSize: 'clamp(3.2px, 1.92vw, 12px)',
                lineHeight: '1.05',
                color: 'var(--gs-base)',
                textShadow: '0 0 8px var(--gs-base), 0 0 20px rgba(255,178,239,0.3)',
              }}
            >
              {ASCII_TITLE}
            </pre>
          </div>

          {/* ② Space between logo and headline */}
          <div style={{ flex: 3 }} />

          {/* Chloe + Headline */}
          <div className="flex items-start gap-gs-3 select-none px-gs-4">
            <MobileChloeLaser size={64} />
            <div>
              <p
                className="font-display"
                style={{
                  fontSize: 'clamp(20px, 5.5vw, 26px)',
                  fontWeight: 300,
                  lineHeight: '1.3',
                  letterSpacing: '-0.01em',
                  color: 'var(--gs-light)',
                }}
              >
                Your website is losing you money.
              </p>
              <p
                className="font-marker"
                style={{
                  fontSize: 'clamp(24px, 6.5vw, 32px)',
                  lineHeight: '1.2',
                  letterSpacing: '-0.06em',
                  color: 'var(--gs-base)',
                  marginTop: '4px',
                }}
              >
                Let&apos;s fix that.
              </p>
            </div>
          </div>

          {/* ③ Space between headline and nudge — largest gap, pushes CTA block down */}
          <div style={{ flex: 8 }} />

          {/* Nudge CTA + Arrow */}
          <div className="flex flex-col items-center select-none">
            <p
              className="font-data text-center"
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gs-mid)',
              }}
            >
              MarTech breakdown.<br />
              Strategic insights.<br />
              Actionable recommendations.
            </p>
            <CurvedArrow />
          </div>

          {/* ④ Space between nudge and input */}
          <div style={{ flex: 1 }} />

          {/* Scan input — stacked vertically on mobile */}
          <div className="w-full max-w-md px-gs-4 mobile-scan-input-stack">
            <MobileScanFlow myScansRef={myScansRef} onRequestAuth={openAuthOverlay} />
          </div>

          {/* ⑤ Bottom breathing room — small, keeps Turnstile off viewport edge */}
          <div style={{ minHeight: '16px' }} />
        </section>

        {/* ═══════ MY SCANS (authenticated users only) ═══════ */}
        {isAuthenticated && (
          <>
            <SectionDivider />
            <section ref={myScansRef} className="py-gs-2">
              <div className="px-gs-6 pt-gs-3 pb-gs-6 text-center space-y-gs-2">
                <h2 className="font-display text-display-sm">My Scans</h2>
                <p className="font-data text-data-xs text-gs-muted">
                  Your scan history &amp; reports
                </p>
              </div>
              <div className="mobile-my-scans">
                <HistoryWindow key={historyKey} onChatOpen={openChatOverlay} />
              </div>
            </section>
          </>
        )}

        {/* ═══════ Marketing sections — hidden for paid users ═══════ */}
        {!isPaidUser && (
          <>
            <SectionDivider />

            {/* ═══════ SECTION 2: HOW IT WORKS ═══════ */}
            <section className="py-gs-2">
              <FeaturesWindow />
            </section>

            <SectionDivider />

            {/* ═══════ SECTION 3: WHAT YOU GET ═══════ */}
            <section className="py-gs-2">
              <ProductsWindow />
            </section>

            <SectionDivider />

            {/* ═══════ SECTION 4: PRICING ═══════ */}
            <section ref={pricingRef} className="px-gs-4 py-gs-4">
              <MobilePricingSection onFreeScan={scrollToHero} />
            </section>

            <SectionDivider />

            {/* ═══════ SECTION 5: SOCIAL PROOF ═══════ */}
            <section className="py-gs-2">
              <CustomersWindow />
            </section>
          </>
        )}

        <SectionDivider />

        {/* ═══════ DESKTOP CTA ═══════ */}
        <section className="px-gs-6 py-gs-8 space-y-gs-4">
          {/* Heading — full width, centered */}
          <div className="text-center">
            <p
              className="font-display"
              style={{
                fontSize: 'clamp(18px, 5vw, 24px)',
                fontWeight: 300,
                lineHeight: '1.3',
                letterSpacing: '-0.01em',
                color: 'var(--gs-light)',
              }}
            >
              the full experience
            </p>
            <p
              className="font-marker"
              style={{
                fontSize: 'clamp(22px, 6vw, 30px)',
                lineHeight: '1.2',
                letterSpacing: '-0.06em',
                color: 'var(--gs-base)',
                marginTop: '4px',
              }}
            >
              hits different on desktop.
            </p>
          </div>
          {/* Form block (left) + Ghost (right) */}
          <div className="flex items-center gap-gs-4">
            <div className="flex-1 min-w-0">
              <DesktopReminderForm />
              <p className="font-data text-data-xs text-gs-muted leading-relaxed mt-gs-3">
                window manager, 48 interactive slides, mini-games,
                ASCII movies, Chloé&apos;s desktop OS.
              </p>
            </div>
            <ChloeSprite state="smug" size={64} className="flex-shrink-0" />
          </div>
        </section>

        <SectionDivider />

        {/* ═══════ SECTION 7: ABOUT (doubles as footer) ═══════ */}
        <section className="py-gs-2 mobile-about-footer">
          <AboutWindow />
        </section>

        {/* Bottom padding for sticky bar */}
        <div style={{ height: '48px' }} />
      </main>

      {/* ═══════ STICKY BOTTOM BAR ═══════ */}
      {!heroVisible && (
        <div className="flex-shrink-0 h-[48px] flex items-center gap-gs-2 px-gs-3 bg-gs-deep/95 backdrop-blur-md border-t border-gs-mid/15">
          <AnimatedChloe state="idle" size={32} className="flex-shrink-0" />
          {!authLoading && (
            isAuthenticated ? (
              <>
                <div className="flex-1 grid grid-cols-2 gap-gs-2 min-w-0">
                  <button
                    onClick={scrollToHero}
                    className="bevel-button-primary h-[34px] font-system text-os-sm font-bold min-w-0 !px-0"
                  >
                    GhostScan&trade;
                  </button>
                  <button
                    onClick={scrollToMyScans}
                    className="h-[34px] font-system text-os-sm font-bold min-w-0 rounded-[8px] transition-colors neon-outline-btn"
                    style={{
                      border: '1.5px solid var(--gs-base)',
                      background: 'oklch(0.12 0.03 340)',
                      color: 'var(--gs-base)',
                    }}
                  >
                    My Scans
                  </button>
                </div>
                <button
                  onClick={() => setMobileOverlay('profile')}
                  className="flex-shrink-0 text-gs-light/70 active:text-gs-base transition-colors"
                  title="Profile"
                >
                  <UserCircle size={32} strokeWidth={1.5} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={scrollToHero}
                  className="bevel-button-primary flex-1 h-[34px] font-system text-os-sm font-bold min-w-0"
                >
                  GhostScan&trade;
                </button>
                <button
                  onClick={scrollToPricing}
                  className="bevel-button px-gs-3 h-[34px] font-system text-os-sm font-bold flex-shrink-0"
                >
                  Pricing
                </button>
                <button
                  onClick={() => openAuthOverlay('register')}
                  className="bevel-button px-gs-3 h-[34px] font-system text-os-sm font-bold flex-shrink-0"
                >
                  Register
                </button>
              </>
            )
          )}
        </div>
      )}

      {/* ═══════ OVERLAYS ═══════ */}

      {/* Auth overlay — uses AuthWindow (same as desktop, handles verify inline) */}
      {(mobileOverlay === 'login' || mobileOverlay === 'register') && (
        <div className="fixed inset-0 z-50 bg-gs-void flex flex-col overflow-hidden">
          <div className="flex-shrink-0 h-[44px] flex items-center gap-gs-3 px-gs-4 bg-gs-deep/95 backdrop-blur-md border-b border-gs-mid/15">
            <button
              onClick={() => setMobileOverlay(null)}
              className="font-data text-data-sm text-gs-base"
            >
              &larr; Back
            </button>
            <span className="font-system text-os-sm font-bold text-gs-light">
              {mobileOverlay === 'register' ? 'Create Account' : 'Sign In'}
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <AuthWindow />
          </div>
        </div>
      )}

      {/* Profile overlay */}
      {mobileOverlay === 'profile' && (
        <div className="fixed inset-0 z-50 bg-gs-void flex flex-col overflow-hidden">
          <div className="flex-shrink-0 h-[44px] flex items-center gap-gs-3 px-gs-4 bg-gs-deep/95 backdrop-blur-md border-b border-gs-mid/15">
            <button
              onClick={() => setMobileOverlay(null)}
              className="font-data text-data-sm text-gs-base"
            >
              &larr; Back
            </button>
            <span className="font-system text-os-sm font-bold text-gs-light">Profile</span>
          </div>
          <div className="flex-1 overflow-auto">
            <ProfileWindow />
          </div>
        </div>
      )}

      {/* Chat overlay — full viewport like auth/profile */}
      {mobileOverlay === 'chat' && chatContext && (
        <div className="fixed inset-0 z-50 bg-gs-void flex flex-col overflow-hidden">
          <div className="flex-shrink-0 h-[44px] flex items-center gap-gs-3 px-gs-4 bg-gs-deep/95 backdrop-blur-md border-b border-gs-mid/15">
            <button
              onClick={() => setMobileOverlay(null)}
              className="font-data text-data-sm text-gs-base"
            >
              &larr; Back
            </button>
            <span className="font-system text-os-sm font-bold text-gs-light truncate">
              Ask Chlo&eacute; &mdash; {chatContext.domain}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatWindow
              key={chatContext.scanId}
              scanId={chatContext.scanId}
              domain={chatContext.domain}
              containerHeight="100%"
              onAuthRequired={() => openAuthOverlay('login')}
              onPurchaseCredits={handlePurchaseCredits}
            />
          </div>
        </div>
      )}
    </div>
  );
}
