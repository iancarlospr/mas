'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { ScanInput } from '@/components/scan/scan-input';
import { MobilePricingSection } from '@/components/mobile/mobile-pricing-section';
import FeaturesWindow from '@/components/windows/features-window';
import ProductsWindow from '@/components/windows/products-window';
import CustomersWindow from '@/components/windows/customers-window';

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

/* ── Main component ──────────────────────────────────────────── */

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

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

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToPricing = useCallback(() => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Desktop: pass through
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-gs-void flex flex-col overflow-hidden">
      <div className="noise-grain opacity-[0.03]" aria-hidden="true" />

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">

        {/* ═══════ SECTION 1: HERO ═══════ */}
        <section ref={heroRef} className="flex flex-col items-center px-gs-4 pt-gs-6 pb-gs-4">

          {/* ASCII Title — scaled for mobile */}
          <div className="flex justify-center w-full overflow-hidden">
            <pre
              className="font-data leading-none whitespace-pre select-none text-center"
              style={{
                fontSize: 'clamp(4.5px, 2.6vw, 12px)',
                lineHeight: '1.05',
                color: 'var(--gs-base)',
                textShadow: '0 0 8px var(--gs-base), 0 0 20px rgba(255,178,239,0.3)',
              }}
            >
              {ASCII_TITLE}
            </pre>
          </div>

          {/* Dither strip */}
          <DitherStrip />

          {/* Chloe + Headline */}
          <div className="flex items-start gap-gs-3 select-none" style={{ marginTop: '24px' }}>
            <ChloeSprite state="idle" size={64} className="flex-shrink-0 mt-[4px]" />
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
                Babe, your website is losing you money.
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

          {/* Spacer */}
          <div style={{ height: '48px' }} />

          {/* Nudge CTA + Arrow */}
          <div className="flex flex-col items-center select-none" style={{ marginBottom: '12px' }}>
            <p
              className="font-data text-center"
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gs-mid)',
              }}
            >
              MarTech breakdown. Strategic insights. Actionable recommendations.
            </p>
            <CurvedArrow />
          </div>

          {/* Scan input */}
          <div className="w-full max-w-md">
            <ScanInput variant="dialog" />
          </div>
        </section>

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

        <SectionDivider />

        {/* ═══════ SECTION 6: DESKTOP CTA ═══════ */}
        <section className="px-gs-6 py-gs-8 text-center space-y-gs-4">
          <ChloeSprite state="smug" size={64} className="mx-auto" />
          <p className="font-data italic text-data-sm text-gs-red">
            the full OS experience hits different on desktop.
          </p>
          <p className="font-data text-data-xs text-gs-muted leading-relaxed">
            48 interactive slides, Chloé&apos;s Bedroom OS, window manager,
            mini-games, ASCII movies — trust me babe.
          </p>
          <p className="font-data text-[10px] text-gs-mid/40 mt-gs-2">
            marketingalphascan.com
          </p>
        </section>

        {/* Bottom padding for sticky bar */}
        <div style={{ height: '56px' }} />
      </main>

      {/* ═══════ STICKY BOTTOM BAR ═══════ */}
      {!heroVisible && (
        <div className="flex-shrink-0 h-[48px] flex items-center gap-gs-2 px-gs-3 bg-gs-deep/95 backdrop-blur-md border-t border-gs-mid/15">
          <ChloeSprite state="idle" size={32} className="flex-shrink-0" />
          <button
            onClick={scrollToHero}
            className="bevel-button-primary flex-1 py-gs-1 font-system text-os-sm font-bold"
          >
            Scan Your Site
          </button>
          <button
            onClick={scrollToPricing}
            className="bevel-button px-gs-3 py-gs-1 font-system text-os-xs font-bold flex-shrink-0"
          >
            Pricing
          </button>
        </div>
      )}
    </div>
  );
}
