'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChloeSprite, type ChloeState } from '@/components/chloe/chloe-sprite';
import { MatrixRain } from '@/components/scan/matrix-rain';
import { DitherEdge, DitherOverlay } from '@/components/os/dither';
import { ScrollReveal, containerVariants, cardVariants } from '@/components/charts/animation-utils';
import { BrandPanel } from './brand-panel';
import { BrandSwatch } from './brand-swatch';
import { cn } from '@/lib/utils';

/* ── Static image imports (bundled into _next/static/media/) ──── */
/* Vercel public/ dir isn't served in this monorepo layout, so we
   import images directly so they land in the build output.        */
import ogBackgroundImg from '../../public/og-background.jpg';
import ogImageImg from '../../public/og-image.png';
import heroCoverImg from '../../public/boss-deck/hero-cover.jpg';
import heroHorizonImg from '../../public/boss-deck/hero-horizon.jpg';

/* =================================================================
   AlphaScan Brand Book — The Complete Visual Identity

   Psychedelic pixel art meets luxury fashion lookbook.
   Pink monochrome OKLCH palette, dither textures, frosted glass,
   grain overlays, and Chloé's sassy personality throughout.
   ================================================================= */

const ASCII_BRAND = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

/* ── Constants ─────────────────────────────────────────────────── */

const CHLOE_STATES: { state: ChloeState; label: string; desc: string }[] = [
  { state: 'idle', label: 'Idle', desc: 'Default resting state' },
  { state: 'scanning', label: 'Scanning', desc: 'Wide eyes, alert mode' },
  { state: 'found', label: 'Found', desc: 'Shocked discovery' },
  { state: 'critical', label: 'Critical', desc: 'Laser eyes, menacing' },
  { state: 'smug', label: 'Smug', desc: 'Half-lidded confidence' },
  { state: 'chat', label: 'Chat', desc: 'Attentive, blushing' },
  { state: 'sleeping', label: 'Sleeping', desc: 'Closed eyes, ZZZ' },
  { state: 'mischief', label: 'Mischief', desc: 'Sideways glance, grin' },
  { state: 'celebrating', label: 'Celebrating', desc: 'Big smile, open mouth' },
];

const CORE_COLORS = [
  { name: 'Void', cssVar: 'var(--gs-void)', hex: '#080808', oklch: 'oklch(0.03 0 0)', dark: true },
  { name: 'Deep', cssVar: 'var(--gs-deep)', hex: '#2A1F27', oklch: 'oklch(0.18 0.02 340)', dark: true },
  { name: 'Mid', cssVar: 'var(--gs-mid)', hex: '#4A3844', oklch: 'oklch(0.35 0.05 340)', dark: true },
  { name: 'Base', cssVar: 'var(--gs-base)', hex: '#FFB2EF', oklch: '#FFB2EF', dark: false },
  { name: 'Bright', cssVar: 'var(--gs-bright)', hex: '#FFC8F4', oklch: 'oklch(0.88 0.13 340)', dark: false },
  { name: 'Light', cssVar: 'var(--gs-light)', hex: '#FFF0FA', oklch: 'oklch(0.96 0.04 340)', dark: false },
];

const FUNCTIONAL_COLORS = [
  { name: 'Terminal', cssVar: 'var(--gs-terminal)', hex: '#00FF88', oklch: 'oklch(0.80 0.25 145)', dark: false },
  { name: 'Critical', cssVar: 'var(--gs-critical)', hex: '#FF5050', oklch: 'oklch(0.55 0.22 25)', dark: true },
  { name: 'Warning', cssVar: 'var(--gs-warning)', hex: '#FFC800', oklch: 'oklch(0.78 0.15 75)', dark: false },
];

const VOICE_LINES = [
  "Your MarTech stack is a landfill. Let's run the forensics.",
  'Drop a URL. I handle the rest.',
  "I see everything your analytics can't. Try me.",
  "You're back. Smart move.",
  'Miss me? Your competitors sure did.',
  "Initiating protocol. Don't touch anything.",
  "Running 42 forensic modules. Sit tight.",
  'Found something ugly.',
  "Oh. That's not good.",
  "Receipts acquired. You'll want to see this.",
  "Your competitors aren't taking breaks.",
  "I don't sleep. I audit.",
  "Fun fact: I can see your Meta pixel from here. It's crying.",
  "4 scans a day. You're out. Come back tomorrow.",
  "DECLASSIFIED. Now you're dangerous.",
];

const APPROVED_VOCAB = ['Unclockable', 'Forensic', 'Receipts', 'Ground Truth', 'Protocol', 'Declassified'];
const BANNED_VOCAB = ['Hack growth', 'Crush it', '10x', 'Synergy', 'Empower', 'Seamless', 'Magic'];

const REMOTION_COMPOSITIONS = [
  { name: 'MarketingReel', dims: '1080×1920', format: 'Vertical (Reels/TikTok)', duration: '43s' },
  { name: 'ProgressionReel', dims: '1920×1080', format: 'Landscape', duration: '2:22' },
  { name: 'AppDemo', dims: '1832×1552', format: 'Native App', duration: '56s' },
  { name: 'BuilderReel', dims: '1920×1080', format: 'Landscape', duration: '—' },
];

/* ── Grain Overlay (reusable) ──────────────────────────────────── */

function GrainOverlay({ opacity = 0.04 }: { opacity?: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
        opacity,
      }}
      aria-hidden="true"
    />
  );
}

/* ── Section Header ────────────────────────────────────────────── */

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-8 md:mb-12">
      <div className="flex items-baseline gap-3 mb-2">
        <span
          className="font-data font-bold"
          style={{ fontSize: 11, color: 'var(--gs-mid)', letterSpacing: '0.12em' }}
        >
          {number}
        </span>
        <span
          className="font-display font-bold uppercase"
          style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            color: 'var(--gs-light)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          {title}
        </span>
      </div>
      {subtitle && (
        <p
          className="font-data"
          style={{ fontSize: 13, color: 'var(--gs-mid)', maxWidth: 600, lineHeight: 1.5 }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Typewriter Hook ───────────────────────────────────────────── */

function useTypewriter(lines: string[], speed = 40, pause = 3000) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const line = lines[lineIndex % lines.length]!;

    if (!isDeleting && charIndex < line.length) {
      const id = setTimeout(() => setCharIndex((c) => c + 1), speed);
      return () => clearTimeout(id);
    }

    if (!isDeleting && charIndex === line.length) {
      const id = setTimeout(() => setIsDeleting(true), pause);
      return () => clearTimeout(id);
    }

    if (isDeleting && charIndex > 0) {
      const id = setTimeout(() => setCharIndex((c) => c - 1), speed / 2);
      return () => clearTimeout(id);
    }

    if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setLineIndex((i) => (i + 1) % lines.length);
    }
  }, [charIndex, isDeleting, lineIndex, lines, speed, pause]);

  const line = lines[lineIndex % lines.length]!;
  return line.slice(0, charIndex);
}

/* ── Playground Laser (canvas, copies laser-beams.tsx exactly) ── */

function PlaygroundLaser({ ghostRef, containerRef }: {
  ghostRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const hueRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!ghostRef.current || !container) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      canvas.width = containerRect.width;
      canvas.height = containerRect.height;

      // Get the sprite canvas inside the ghost div — tracks float animation
      const spriteCanvas = ghostRef.current.querySelector('canvas');
      if (!spriteCanvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const ghostRect = spriteCanvas.getBoundingClientRect();

      // Eye positions relative to the container (same ratios as laser-beams.tsx)
      const eyeLX = ghostRect.left - containerRect.left + (18 / 64) * ghostRect.width;
      const eyeRX = ghostRect.left - containerRect.left + (42 / 64) * ghostRect.width;
      const eyeY = ghostRect.top - containerRect.top + (26 / 84) * ghostRect.height;

      // Target positions — fire left and right to panel edges
      const targetLX = 0;
      const targetRX = containerRect.width;
      const targetLY = eyeY;
      const targetRY = eyeY;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hueRef.current = (hueRef.current + 2) % 360;
      const orbPulse = 1 + Math.sin(hueRef.current * 0.1) * 0.25;

      // Draw beams — one left, one right
      const targets = [
        { eyeX: eyeLX, tx: targetLX, ty: targetLY },
        { eyeX: eyeRX, tx: targetRX, ty: targetRY },
      ];

      for (const { eyeX, tx, ty } of targets) {
        const dx = tx - eyeX;
        const dy = ty - eyeY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        const px = -dy / len;
        const py = dx / len;
        const pulse = 1 + Math.sin(hueRef.current * 0.08) * 0.3;
        const widthAtEye = 45 * pulse;
        const widthAtTarget = 14;

        // Rainbow gradient — from ghost outward (reversed hue)
        const gradient = ctx.createLinearGradient(eyeX, eyeY, tx, ty);
        for (let i = 0; i <= 6; i++) {
          gradient.addColorStop(i / 6, `hsl(${(hueRef.current - i * 50 + 360) % 360}, 100%, 65%)`);
        }

        // Outer glow — massive spread
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(eyeX + px * (widthAtEye + 22), eyeY + py * (widthAtEye + 22));
        ctx.lineTo(eyeX - px * (widthAtEye + 22), eyeY - py * (widthAtEye + 22));
        ctx.lineTo(tx - px * (widthAtTarget + 10), ty - py * (widthAtTarget + 10));
        ctx.lineTo(tx + px * (widthAtTarget + 10), ty + py * (widthAtTarget + 10));
        ctx.closePath();
        ctx.fill();

        // Core beam
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(eyeX + px * widthAtEye, eyeY + py * widthAtEye);
        ctx.lineTo(eyeX - px * widthAtEye, eyeY - py * widthAtEye);
        ctx.lineTo(tx - px * widthAtTarget, ty - py * widthAtTarget);
        ctx.lineTo(tx + px * widthAtTarget, ty + py * widthAtTarget);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Eye orbs ON TOP — massive pulsing rainbow
      for (const eyeX of [eyeLX, eyeRX]) {
        const halo = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 60 * orbPulse);
        halo.addColorStop(0, `hsla(${hueRef.current}, 100%, 92%, 0.9)`);
        halo.addColorStop(0.25, `hsla(${(hueRef.current + 40) % 360}, 100%, 80%, 0.5)`);
        halo.addColorStop(0.5, `hsla(${(hueRef.current + 90) % 360}, 100%, 70%, 0.25)`);
        halo.addColorStop(0.75, `hsla(${(hueRef.current + 140) % 360}, 100%, 60%, 0.1)`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 60 * orbPulse, 0, Math.PI * 2);
        ctx.fill();

        const mid = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 28 * orbPulse);
        mid.addColorStop(0, `hsla(${hueRef.current}, 100%, 95%, 1)`);
        mid.addColorStop(0.5, `hsla(${hueRef.current}, 100%, 85%, 0.8)`);
        mid.addColorStop(1, `hsla(${(hueRef.current + 30) % 360}, 100%, 70%, 0.3)`);
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 28 * orbPulse, 0, Math.PI * 2);
        ctx.fill();

        const core = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 12 * orbPulse);
        core.addColorStop(0, 'hsla(60, 100%, 95%, 1)');
        core.addColorStop(0.6, `hsla(${hueRef.current}, 100%, 90%, 0.95)`);
        core.addColorStop(1, `hsla(${hueRef.current}, 100%, 75%, 0.6)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 12 * orbPulse, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ghostRef, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}

/* ═════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════ */

export default function BrandBook() {
  const [frame, setFrame] = useState(0);
  const [activeSprite, setActiveSprite] = useState<ChloeState>('idle');
  const [spriteGlowing, setSpriteGlowing] = useState(true);
  const [spriteFlipped, setSpriteFlipped] = useState(false);
  const [spriteLaser, setSpriteLaser] = useState(false);
  const playgroundGhostRef = useRef<HTMLDivElement>(null);
  const playgroundContainerRef = useRef<HTMLDivElement>(null);

  // Shared animation frame counter for all ChloeSprite instances
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Voice typewriter
  const voiceText = useTypewriter(VOICE_LINES, 35, 2500);

  // Override body overflow:hidden (set for desktop OS) so standalone page scrolls
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="min-h-screen bg-gs-void overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>

      {/* ── SECTION 0: HERO ─────────────────────────────────────── */}
      <div className="relative">
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Motion identity — glitchy logo reveal video loop */}
        <video
          ref={(el) => {
            if (!el || (el as HTMLVideoElement & { _glitch?: boolean })._glitch) return;
            (el as HTMLVideoElement & { _glitch?: boolean })._glitch = true;
            el.playbackRate = 0.25;
            // Glitch loop: random pauses, rewinds, and speed stutters
            const glitch = () => {
              const roll = Math.random();
              if (roll < 0.3) {
                // Freeze for 0.4–1.2s
                el.pause();
                setTimeout(() => { el.play(); }, 400 + Math.random() * 800);
              } else if (roll < 0.5) {
                // Rewind 0.3–1.5s then resume
                el.currentTime = Math.max(0, el.currentTime - 0.3 - Math.random() * 1.2);
              } else if (roll < 0.65) {
                // Brief speed burst then back to slow
                el.playbackRate = 0.6 + Math.random() * 0.4;
                setTimeout(() => { el.playbackRate = 0.25; }, 200 + Math.random() * 400);
              }
              setTimeout(glitch, 800 + Math.random() * 2200);
            };
            setTimeout(glitch, 2000);
          }}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{ opacity: 0.12, filter: 'blur(2px) saturate(1.3)' }}
          aria-hidden="true"
        >
          <source src="/brand-hero.mp4" type="video/mp4" />
        </video>

        {/* Radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(8,8,8,0.85) 70%)',
          }}
          aria-hidden="true"
        />

        <GrainOverlay opacity={0.05} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-4 w-full">
          {/* ASCII Logo — responsive: scales down on small screens */}
          <motion.div
            className="w-full flex justify-center"
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <pre
              className="font-data leading-none whitespace-pre select-none text-center origin-center"
              style={{
                fontSize: 'clamp(4px, 1.45vw, 11px)',
                lineHeight: '1.05',
                color: 'var(--gs-base)',
                textShadow: '0 0 8px #FFB2EF, 0 0 24px rgba(255,178,239,0.3)',
                padding: '24px 0',
              }}
            >
              {ASCII_BRAND}
            </pre>
          </motion.div>

          {/* Chloé */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, type: 'spring', damping: 20 }}
          >
            <div style={{ animation: 'ghost-float 3s ease-in-out infinite' }}>
              <ChloeSprite state="smug" size={256} glowing frame={frame} />
            </div>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            className="mt-8 font-data select-none"
            style={{
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--gs-mid)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Brand Guidelines
          </motion.p>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <span className="font-data text-gs-mid" style={{ fontSize: 20 }}>↓</span>
        </motion.div>

      </section>
      {/* Dither edge — outside overflow-hidden so it's visible */}
      <DitherEdge position="bottom" />
      </div>

      {/* ── SECTION 0B: IDEAL CUSTOMER ───────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,178,239,0.04) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="01"
              title="Ideal Customer"
              subtitle="Who AlphaScan is for, why the brand looks and feels the way it does, and the pain that drives every design decision."
            />
          </ScrollReveal>

          {/* Intro text — outside cards */}
          <ScrollReveal>
            <div className="mb-8">
              <p className="font-data" style={{ fontSize: 13, color: 'var(--gs-mid)', lineHeight: 1.7 }}>
                Who AlphaScan is for, why the brand looks and feels the way it does, and the pain that drives every design decision. Approximately 70% of the target audience is women. The rest are culturally progressive men who aren&apos;t put off by a pink interface — the palette is a data-driven design decision, not decoration. The audience spans freelancers running Shopify stores, marketing managers at 20-person companies, and startups with a $3K/month ad budget. They run campaigns, manage agencies, and report to leadership — but have no way to verify whether the marketing stack actually works.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Left: Profile */}
            <ScrollReveal className="flex">
              <BrandPanel title="icp_profile.dat" className="flex-1">
                <div className="p-6 space-y-4">
                  <p className="font-display font-bold uppercase" style={{ fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--gs-light)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    A marketer.{' '}
                    <span style={{ color: 'var(--gs-base)' }}>Not a developer.</span>
                  </p>
                  {[
                    { label: 'Role', value: 'Marketing manager, director, freelancer, or solo operator' },
                    { label: 'Company', value: 'Freelancers, small businesses, startups — typically under 50 employees' },
                    { label: 'Budget', value: 'Spending on ads, agencies, and tools — but can\'t justify $5K–$15K for a consultancy audit' },
                    { label: 'Technical', value: 'Knows enough to be dangerous. Can read a dashboard, can\'t read source code' },
                    { label: 'Geography', value: 'Global from day one — Miami, Mexico City, London, São Paulo, Singapore' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2" style={{ fontSize: 12 }}>
                      <span className="font-data font-bold flex-shrink-0" style={{ color: 'var(--gs-base)', minWidth: 70 }}>{label}</span>
                      <span className="font-data" style={{ color: 'var(--gs-light)', opacity: 0.7, lineHeight: 1.4 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Right: The Pain */}
            <ScrollReveal delay={0.15} className="flex">
              <BrandPanel title="pain_points.log" variant="terminal" className="flex-1">
                <div className="p-6 space-y-4" style={{ background: '#0A0A0A' }}>
                  <p className="font-data font-bold" style={{ fontSize: 11, color: 'var(--gs-terminal)', letterSpacing: '0.06em' }}>
                    THE PAIN
                  </p>
                  {[
                    { icon: '>', text: 'Paying an agency $2.5K–$8K/month that can\'t tell you the Meta pixel broke 3 months ago' },
                    { icon: '>', text: 'Staring at dashboards wondering "is this right?" — decisions based on bad data don\'t look wrong until the results don\'t come' },
                    { icon: '>', text: 'Each specialist sees their lane, nobody sees the full picture — the gap between what each vendor sees and what\'s actually happening is where money goes to die' },
                    { icon: '>', text: 'Told you need a $5K–$15K audit and 6 weeks to find what\'s broken — "not realistic for a freelancer or a 20-person company"' },
                    { icon: '>', text: '14 third-party scripts on average, 2–4 of which are dead weight — Hotjar from 2023, the chatbot experiment that lasted two months, an A/B tool nobody logs into' },
                  ].map(({ icon, text }, i) => (
                    <div key={i} className="flex gap-2" style={{ fontSize: 12 }}>
                      <span className="font-data flex-shrink-0" style={{ color: 'var(--gs-terminal)' }}>{icon}</span>
                      <span className="font-data" style={{ color: 'var(--gs-light)', opacity: 0.6, lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </BrandPanel>
            </ScrollReveal>
          </div>

          {/* Why the brand looks this way */}
          <ScrollReveal delay={0.2}>
            <div className="mt-6">
              <BrandPanel title="brand_rationale.md">
                <div className="p-6 space-y-5">
                  <p className="font-display font-bold uppercase" style={{ fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--gs-light)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    Why pink. Why a ghost.
                    <br />
                    <span style={{ color: 'var(--gs-base)' }}>Why any of this.</span>
                  </p>

                  <div className="space-y-4">
                    {[
                      {
                        title: 'Pink monochrome, not corporate blue',
                        body: 'When approximately 70% of your users are women, you design for that audience. Not pastel corporate pink — dark void pink that functions as a black replacement. Moody and serious, not playful. Dark enough for long working sessions. Distinctive enough that you know exactly what app you\'re looking at from across the room.',
                      },
                      {
                        title: 'A ghost mascot with laser eyes',
                        body: 'Marketing is already full of bland dashboards that say "Action Required" in gray Helvetica. Nobody needs another neutral, corporate-voiced tool that speaks in passive voice. Chloé is the personality layer that turns "marketing audit tool" into "that ghost app." She\'s made of the same pixels she audits. She has opinions about your setup and she\'s not going to keep them to herself.',
                      },
                      {
                        title: 'Best-friend energy, not enterprise tone',
                        body: 'She tells you your consent banner is a liability. She doesn\'t hedge. She delivers bad news like a best friend who cares enough to be honest. The audience deserves direct answers, not "consider potentially exploring the possibility of" — that corporate language is exactly what they\'re trying to escape.',
                      },
                      {
                        title: 'Desktop OS metaphor',
                        body: 'Marketing audits are boring. Dashboards are boring. Every SaaS tool in the marketing space looks exactly the same — built by enterprise design systems that optimize for "inoffensive" and land on "forgettable." The desktop interface makes people feel something. Makes them want to screenshot and share. Engagement metrics that enterprise UX would kill for, built by making people smile.',
                      },
                    ].map(({ title, body }) => (
                      <div key={title}>
                        <p className="font-data font-bold" style={{ fontSize: 13, color: 'var(--gs-base)' }}>{title}</p>
                        <p className="font-data mt-1" style={{ fontSize: 12, color: 'var(--gs-mid)', lineHeight: 1.6 }}>{body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── SECTION 1: LOGO SYSTEM ──────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader number="01" title="Logo System" subtitle="The primary mark is an ASCII art rendering. The brand operates in terminals, not boardrooms." />
          </ScrollReveal>

          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            {/* ASCII Logo — full width */}
            <motion.div variants={cardVariants}>
              <BrandPanel title="primary — ascii.exe">
                <div className="p-6 overflow-hidden">
                  <div className="w-full flex justify-center">
                    <pre
                      className="font-data leading-none whitespace-pre select-all text-center"
                      style={{
                        fontSize: 'clamp(4px, 1.3vw, 10px)',
                        lineHeight: '1.05',
                        color: 'var(--gs-base)',
                        textShadow: '0 0 6px #FFB2EF, 0 0 16px rgba(255,178,239,0.25)',
                      }}
                    >
                      {ASCII_BRAND}
                    </pre>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {['Geist Mono', '12px', '#FFB2EF', 'min-width: 440px'].map((spec) => (
                      <span
                        key={spec}
                        className="font-data px-2 py-0.5 rounded-full"
                        style={{
                          fontSize: 10,
                          background: 'rgba(255,178,239,0.08)',
                          color: 'var(--gs-mid)',
                          border: '1px solid rgba(255,178,239,0.12)',
                        }}
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </motion.div>

            {/* Text Mark + Icon — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={cardVariants} className="flex">
                <BrandPanel title="secondary — text mark" className="flex-1">
                  <div className="p-8 flex flex-col items-center justify-center" style={{ minHeight: 240 }}>
                    <div className="text-center">
                      <span
                        className="font-display font-extrabold uppercase block"
                        style={{ fontSize: 72, color: 'var(--gs-light)', letterSpacing: '-0.02em', lineHeight: 0.95 }}
                      >
                        ALPHA
                      </span>
                      <span
                        className="font-display font-extrabold uppercase block"
                        style={{
                          fontSize: 72,
                          color: 'var(--gs-base)',
                          letterSpacing: '-0.02em',
                          lineHeight: 0.95,
                          textShadow: '0 0 24px rgba(255,178,239,0.3)',
                        }}
                      >
                        SCAN
                      </span>
                    </div>
                    <p className="font-data mt-4" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                      Barlow Condensed · 800 · letter-spacing: -0.02em
                    </p>
                  </div>
                </BrandPanel>
              </motion.div>

              <motion.div variants={cardVariants} className="flex">
                <BrandPanel title="icon — chloé ghost sprite" className="flex-1">
                  <div className="p-6 flex flex-col items-center justify-center" style={{ minHeight: 240 }}>
                    <div className="flex items-end justify-center gap-8">
                      {([64, 128] as const).map((size) => (
                        <div key={size} className="flex flex-col items-center gap-2">
                          <div style={{ filter: 'drop-shadow(0 0 8px var(--gs-base)) drop-shadow(0 0 16px rgba(255,178,239,0.2))' }}>
                            <ChloeSprite state="idle" size={size} glowing frame={frame} />
                          </div>
                          <span className="font-data" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                            {size}px
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="font-data text-center mt-4" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                      32×42 pixel grid · canvas-rendered · ghost-glow drop-shadow
                    </p>
                  </div>
                </BrandPanel>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: COLOR PALETTE ────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />

        {/* Radial pink vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,178,239,0.03) 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="02"
              title="Color Palette"
              subtitle="Monochromatic pink built on OKLCH hue 340. Darks are neutral/achromatic — chroma ramps gradually toward base."
            />
          </ScrollReveal>

          {/* Gradient strip */}
          <ScrollReveal delay={0.1}>
            <div
              className="w-full h-3 rounded-full mb-8"
              style={{
                background: 'linear-gradient(to right, #080808, #2A1F27, #4A3844, #FFB2EF, #FFC8F4, #FFF0FA)',
              }}
            />
          </ScrollReveal>

          {/* Core palette swatches */}
          <ScrollReveal delay={0.2}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
              {CORE_COLORS.map((c) => (
                <BrandSwatch key={c.name} {...c} className="min-h-[140px]" />
              ))}
            </div>
          </ScrollReveal>

          {/* Functional colors */}
          <ScrollReveal delay={0.3}>
            <p
              className="font-data font-bold mb-3"
              style={{ fontSize: 11, color: 'var(--gs-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Functional Colors
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {FUNCTIONAL_COLORS.map((c) => (
                <BrandSwatch key={c.name} {...c} functional className="min-h-[80px]" />
              ))}
            </div>
          </ScrollReveal>

          {/* Palette in Action */}
          <ScrollReveal delay={0.4}>
            <BrandPanel title="palette_in_action.exe">
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Mini UI demo */}
                  <div
                    className="flex-1 p-5 rounded-gs-lg border border-gs-mid/20"
                    style={{
                      background: 'oklch(0.14 0.02 340 / 0.6)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <h3
                      className="font-display font-bold uppercase"
                      style={{ fontSize: 20, color: 'var(--gs-light)', letterSpacing: '-0.02em' }}
                    >
                      Frosted Panel
                    </h3>
                    <p className="font-data mt-2" style={{ fontSize: 12, color: 'var(--gs-mid)', lineHeight: 1.5 }}>
                      Body text lives in the mid-tone range, preserving readability against dark surfaces.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button
                        className="font-data px-4 py-2 rounded-gs"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          background: 'var(--gs-base)',
                          color: 'var(--gs-void)',
                          border: '1px solid var(--gs-bright)',
                        }}
                      >
                        Primary Action
                      </button>
                      <button
                        className="font-data px-4 py-2 rounded-gs"
                        style={{
                          fontSize: 12,
                          background: 'oklch(0.18 0.02 340 / 0.8)',
                          color: 'var(--gs-light)',
                          border: '1px solid var(--gs-mid)',
                        }}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>

                  {/* Text hierarchy */}
                  <div className="flex-1 space-y-3">
                    <p className="font-display font-bold" style={{ fontSize: 24, color: 'var(--gs-light)' }}>
                      Display — Light
                    </p>
                    <p className="font-data" style={{ fontSize: 14, color: 'var(--gs-bright)' }}>
                      Emphasis — Bright
                    </p>
                    <p className="font-data" style={{ fontSize: 13, color: 'var(--gs-base)' }}>
                      Accent — Base (THE pink)
                    </p>
                    <p className="font-data" style={{ fontSize: 12, color: 'var(--gs-mid)' }}>
                      Body copy — Mid
                    </p>
                    <p className="font-data" style={{ fontSize: 11, color: 'var(--gs-deep)' }}>
                      Muted — Deep
                    </p>
                  </div>
                </div>
              </div>
            </BrandPanel>
          </ScrollReveal>
        </div>
      </section>

      {/* ── SECTION 3: TYPOGRAPHY ───────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="03"
              title="Typography"
              subtitle="Four typefaces, each with a distinct personality. Responsive sizes via clamp() for viewport scaling."
            />
          </ScrollReveal>

          <div className="space-y-6">
            {/* Geist Mono */}
            <ScrollReveal>
              <BrandPanel title="geist_mono.ttf — The System Font">
                <div className="p-6 space-y-4">
                  <p className="font-data" style={{ fontSize: 48, fontWeight: 800, color: 'var(--gs-light)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    Geist Mono
                  </p>
                  <p className="font-data" style={{ fontSize: 13, color: 'var(--gs-mid)', lineHeight: 1.6 }}>
                    ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !@#$%^&amp;*()
                  </p>
                  <div className="space-y-1">
                    {[
                      { label: 'data-hero', size: 48, weight: 800 },
                      { label: 'data-2xl', size: 24, weight: 700 },
                      { label: 'data-xl', size: 18, weight: 700 },
                      { label: 'data-lg', size: 15, weight: 400 },
                      { label: 'data-base', size: 13, weight: 400 },
                      { label: 'data-sm', size: 12, weight: 400 },
                      { label: 'data-xs', size: 11, weight: 400 },
                    ].map((s) => (
                      <div key={s.label} className="flex items-baseline gap-3">
                        <span className="font-data" style={{ fontSize: 10, color: 'var(--gs-mid)', width: 70, flexShrink: 0 }}>{s.label}</span>
                        <span className="font-data" style={{ fontSize: s.size, fontWeight: s.weight, color: 'var(--gs-light)' }}>
                          42 modules. AI-powered.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Barlow Condensed */}
            <ScrollReveal>
              <BrandPanel title="barlow_condensed.ttf — The Voice">
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    {[
                      { label: 'display-hero', size: 'clamp(56px, 8vw, 96px)', weight: 800 },
                      { label: 'display-xl', size: 'clamp(48px, 6vw, 72px)', weight: 800 },
                      { label: 'display-lg', size: 'clamp(36px, 5vw, 52px)', weight: 700 },
                      { label: 'display-base', size: 'clamp(28px, 4vw, 36px)', weight: 700 },
                      { label: 'display-sm', size: 'clamp(20px, 3vw, 28px)', weight: 700 },
                    ].map((s) => (
                      <div key={s.label}>
                        <span className="font-data block" style={{ fontSize: 10, color: 'var(--gs-mid)', marginBottom: 2 }}>{s.label}</span>
                        <span
                          className="font-display font-bold uppercase block"
                          style={{
                            fontSize: s.size,
                            fontWeight: s.weight,
                            color: 'var(--gs-light)',
                            letterSpacing: '-0.03em',
                            lineHeight: 1,
                          }}
                        >
                          FORENSIC INTELLIGENCE
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* JetBrains Mono */}
            <ScrollReveal>
              <BrandPanel title="terminal.exe" variant="terminal">
                <div
                  className="p-6"
                  style={{
                    background: '#0A0A0A',
                    position: 'relative',
                  }}
                >
                  {/* CRT scanlines */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.02) 2px, rgba(0,255,136,0.02) 4px)',
                    }}
                    aria-hidden="true"
                  />

                  <div className="relative space-y-1" style={{ fontFamily: 'var(--font-terminal)', fontSize: 13, lineHeight: 1.5 }}>
                    <p style={{ color: 'var(--gs-terminal)', textShadow: '0 0 4px var(--gs-terminal), 0 0 8px rgba(0,255,136,0.3)' }}>
                      JetBrains Mono — Terminal Only
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; initiating GhostScan™ protocol...
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; loading stealth profile [chrome-134.0.6998.89]
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; browser context ready (Pixel 8 viewport)
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; M01 MetaTag Analysis: <span style={{ color: '#FFB2EF' }}>EXTRACTED</span>
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; M03 Performance Vitals: <span style={{ color: '#FFB2EF' }}>EXTRACTED</span>
                    </p>
                    <p style={{ color: 'var(--gs-terminal)' }}>
                      &gt; scan complete. 42 modules. <span style={{ color: '#00FF88' }}>SUCCESS</span>
                    </p>
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Permanent Marker */}
            <ScrollReveal>
              <BrandPanel title="chloé_handwriting.ttf — Personality">
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    {[
                      { label: 'chloé-xl', size: 28 },
                      { label: 'chloé-lg', size: 20 },
                      { label: 'chloé', size: 16 },
                    ].map((s) => (
                      <div key={s.label}>
                        <span className="font-data block" style={{ fontSize: 10, color: 'var(--gs-mid)', marginBottom: 2 }}>{s.label}</span>
                        <span
                          className="font-marker"
                          style={{
                            fontSize: s.size,
                            color: 'var(--gs-base)',
                            textShadow: '0 0 16px rgba(255,178,239,0.2)',
                          }}
                        >
                          {s.size === 28
                            ? "Let's fix that."
                            : s.size === 20
                              ? 'Your MarTech stack is a landfill.'
                              : "I don't sleep. I audit."}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── DIVIDER: Psychedelic Break ──────────────────────────── */}
      <section className="relative" style={{ height: 200 }}>
        <img
          src={ogBackgroundImg.src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.6 }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, var(--gs-void) 0%, transparent 20%, transparent 80%, var(--gs-void) 100%)',
          }}
        />
        <GrainOverlay opacity={0.06} />
        <DitherEdge position="top" />
        <DitherEdge position="bottom" />
      </section>

      {/* ── SECTION 4: CHLOÉ MASCOT ─────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.04} />

        {/* Pink vignette behind Chloé section */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,178,239,0.05) 0%, transparent 50%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="04"
              title="Chloé"
              subtitle="The ghost mascot. 32×42 pixel grid, pink monochrome palette, 9 expression states. She's a desktop pet — she wanders, perches, peeks, and shoots laser eyes."
            />
          </ScrollReveal>

          {/* Ghost Grid — 3x3 of all states */}
          <ScrollReveal>
            <BrandPanel title="ghost_states.exe — All 9 Expressions">
              <div className="p-6">
                <motion.div
                  className="grid grid-cols-3 gap-4 md:gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  {CHLOE_STATES.map(({ state, label, desc }) => (
                    <motion.div
                      key={state}
                      variants={cardVariants}
                      className="flex flex-col items-center gap-2 p-3 rounded-gs cursor-pointer group"
                      style={{
                        background: 'oklch(0.12 0.01 340 / 0.5)',
                        border: '1px solid oklch(0.25 0.03 340 / 0.3)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      whileHover={{
                        borderColor: 'oklch(0.72 0.17 340 / 0.4)',
                        boxShadow: '0 0 16px oklch(0.82 0.15 340 / 0.15)',
                      }}
                      onClick={() => setActiveSprite(state)}
                    >
                      <div className="py-2 px-1" style={{ filter: 'drop-shadow(0 0 6px rgba(255,178,239,0.3))' }}>
                        <ChloeSprite state={state} size={64} glowing frame={frame} />
                      </div>
                      <span className="font-data font-bold" style={{ fontSize: 11, color: 'var(--gs-base)' }}>
                        {label}
                      </span>
                      <span className="font-data text-center" style={{ fontSize: 10, color: 'var(--gs-mid)', lineHeight: 1.3 }}>
                        {desc}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </BrandPanel>
          </ScrollReveal>

          {/* Pixel Art Spec Sheet */}
          <ScrollReveal delay={0.2}>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <BrandPanel title="sprite_spec.dat">
                <div className="p-6">
                  <p className="font-display font-bold uppercase mb-4" style={{ fontSize: 20, color: 'var(--gs-light)' }}>
                    Pixel Art Spec
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-data" style={{ fontSize: 12, color: 'var(--gs-mid)', width: 80 }}>Grid</span>
                      <span className="font-data font-bold" style={{ fontSize: 12, color: 'var(--gs-light)' }}>32×42 pixels</span>
                    </div>
                    {[
                      { label: 'Body', color: '#FFF0FA' },
                      { label: 'Shading', color: '#FFCAF3' },
                      { label: 'Outline', color: '#1A161A' },
                      { label: 'Eyes', color: '#FFB2EF' },
                      { label: 'Blush', color: '#FFD4E8' },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="font-data" style={{ fontSize: 12, color: 'var(--gs-mid)', width: 80 }}>{label}</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-sm border border-gs-mid/30"
                            style={{ background: color, boxShadow: `0 0 8px ${color}44` }}
                          />
                          <span className="font-data font-bold uppercase" style={{ fontSize: 11, color: 'var(--gs-light)' }}>
                            {color}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>

              {/* Interactive Playground */}
              <BrandPanel title="playground.exe — Interactive">
                <div ref={playgroundContainerRef} className="relative p-6 flex flex-col items-center overflow-hidden">
                  {/* Canvas laser beams — uses rAF, tracks ghost position, exact copy of laser-beams.tsx */}
                  {spriteLaser && (
                    <PlaygroundLaser ghostRef={playgroundGhostRef} containerRef={playgroundContainerRef} />
                  )}

                  {/* Ghost sprite with float animation */}
                  <div
                    ref={playgroundGhostRef}
                    style={{
                      filter: spriteGlowing ? 'drop-shadow(0 0 12px rgba(255,178,239,0.4))' : 'none',
                      position: 'relative',
                      zIndex: 5,
                    }}
                  >
                    <div style={{ animation: 'ghost-float 3s ease-in-out infinite' }}>
                      <ChloeSprite
                        state={spriteLaser ? 'scanning' : activeSprite}
                        size={256}
                        glowing={spriteGlowing}
                        flipped={spriteFlipped}
                        frame={spriteLaser ? 0 : frame}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {CHLOE_STATES.map(({ state, label }) => (
                      <button
                        key={state}
                        onClick={() => setActiveSprite(state)}
                        className="font-data px-2 py-1 rounded-gs transition-all"
                        style={{
                          fontSize: 10,
                          background: activeSprite === state ? 'var(--gs-base)' : 'oklch(0.18 0.02 340 / 0.8)',
                          color: activeSprite === state ? 'var(--gs-void)' : 'var(--gs-mid)',
                          border: `1px solid ${activeSprite === state ? 'var(--gs-bright)' : 'var(--gs-mid)'}`,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 justify-center">
                    <button
                      onClick={() => setSpriteGlowing((g) => !g)}
                      className="font-data px-3 py-1 rounded-gs"
                      style={{
                        fontSize: 10,
                        background: spriteGlowing ? 'rgba(255,178,239,0.15)' : 'oklch(0.18 0.02 340 / 0.8)',
                        color: spriteGlowing ? 'var(--gs-base)' : 'var(--gs-mid)',
                        border: '1px solid var(--gs-mid)',
                      }}
                    >
                      {spriteGlowing ? '✦ Glow ON' : '○ Glow OFF'}
                    </button>
                    <button
                      onClick={() => setSpriteFlipped((f) => !f)}
                      className="font-data px-3 py-1 rounded-gs"
                      style={{
                        fontSize: 10,
                        background: spriteFlipped ? 'rgba(255,178,239,0.15)' : 'oklch(0.18 0.02 340 / 0.8)',
                        color: spriteFlipped ? 'var(--gs-base)' : 'var(--gs-mid)',
                        border: '1px solid var(--gs-mid)',
                      }}
                    >
                      {spriteFlipped ? '↔ Flipped' : '→ Normal'}
                    </button>
                    <button
                      onClick={() => setSpriteLaser((l) => !l)}
                      className="font-data px-3 py-1 rounded-gs"
                      style={{
                        fontSize: 10,
                        background: spriteLaser ? 'rgba(255,80,80,0.15)' : 'oklch(0.18 0.02 340 / 0.8)',
                        color: spriteLaser ? 'var(--gs-critical)' : 'var(--gs-mid)',
                        border: `1px solid ${spriteLaser ? 'rgba(255,80,80,0.4)' : 'var(--gs-mid)'}`,
                      }}
                    >
                      {spriteLaser ? '⚡ Laser ON' : '○ Laser OFF'}
                    </button>
                  </div>

                  {/* Live JSX */}
                  <pre
                    className="font-data mt-4 p-3 rounded-gs w-full overflow-x-auto"
                    style={{
                      fontSize: 10,
                      color: 'var(--gs-terminal)',
                      background: '#0A0A0A',
                      border: '1px solid var(--gs-mid)',
                    }}
                  >
                    {`<ChloeSprite state="${activeSprite}" size={256}${spriteGlowing ? ' glowing' : ''}${spriteFlipped ? ' flipped' : ''}${spriteLaser ? ' laserEyes' : ''} />`}
                  </pre>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>

          {/* Personality Behaviors */}
          <ScrollReveal delay={0.3}>
            <div className="mt-6">
              <BrandPanel title="behaviors.cfg — Desktop Pet">
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { title: 'Wanders', desc: 'Roams viewport every 57s. 3 fast darts → settle to random position.' },
                      { title: 'Perches', desc: 'Sits on window titlebars. 35% probability on each wander cycle.' },
                      { title: 'Edge Peeks', desc: '15% probability — sneaks to screen edge and peers inward.' },
                      { title: 'Sleeps', desc: 'Falls asleep after 57s idle. ZZZ animation + sleep expression.' },
                      { title: 'Laser Eyes', desc: 'Rainbow beams fire every 22s. Sweeps URL input or random icons.' },
                      { title: 'Reacts', desc: 'Responds to scan events, payments, errors — 20+ contextual moods.' },
                    ].map((b) => (
                      <div
                        key={b.title}
                        className="p-3 rounded-gs"
                        style={{
                          background: 'oklch(0.12 0.01 340 / 0.5)',
                          border: '1px solid oklch(0.25 0.03 340 / 0.2)',
                        }}
                      >
                        <p className="font-data font-bold" style={{ fontSize: 12, color: 'var(--gs-base)' }}>{b.title}</p>
                        <p className="font-data mt-1" style={{ fontSize: 11, color: 'var(--gs-mid)', lineHeight: 1.4 }}>{b.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── SECTION 5: BRAND VOICE ──────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="05"
              title="Brand Voice"
              subtitle="High-Fashion Cuntiness. Direct, precise, slightly menacing in a fashionable way. Never apologetic."
            />
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Chloé Speaks */}
            <ScrollReveal>
              <BrandPanel title="chloé_speaks.log">
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-6">
                    <div className="p-2 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(255,178,239,0.3))' }}>
                      <ChloeSprite state="chat" size={64} glowing frame={frame} />
                    </div>
                    <div
                      className="flex-1 p-3 rounded-gs relative"
                      style={{
                        background: 'oklch(0.18 0.02 340 / 0.8)',
                        border: '1px solid rgba(255,178,239,0.15)',
                        minHeight: 60,
                      }}
                    >
                      <span
                        className="font-marker"
                        style={{
                          fontSize: 16,
                          color: 'var(--gs-base)',
                          textShadow: '0 0 12px rgba(255,178,239,0.2)',
                        }}
                      >
                        {voiceText}
                        <span className="animate-blink" style={{ color: 'var(--gs-base)' }}>|</span>
                      </span>
                    </div>
                  </div>

                  {/* Sample lines */}
                  <div className="space-y-2">
                    {VOICE_LINES.slice(0, 8).map((line, i) => (
                      <div
                        key={i}
                        className="font-data p-2 rounded-gs"
                        style={{
                          fontSize: 11,
                          color: 'var(--gs-mid)',
                          background: 'oklch(0.12 0.01 340 / 0.4)',
                          borderLeft: '2px solid var(--gs-base)',
                          lineHeight: 1.4,
                        }}
                      >
                        &ldquo;{line}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Right: Voice Guidelines */}
            <ScrollReveal delay={0.15}>
              <div className="space-y-6">
                <BrandPanel title="tone.cfg">
                  <div className="p-6">
                    <p
                      className="font-display font-bold uppercase"
                      style={{
                        fontSize: 'clamp(24px, 3vw, 36px)',
                        color: 'var(--gs-light)',
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                      }}
                    >
                      High-Fashion
                      <br />
                      <span style={{ color: 'var(--gs-base)' }}>Cuntiness</span>
                    </p>
                    <p className="font-data mt-3" style={{ fontSize: 12, color: 'var(--gs-mid)', lineHeight: 1.5 }}>
                      Direct. Precise. Slightly menacing in a fashionable way. Never says &ldquo;Oops!&rdquo; or &ldquo;Sorry!&rdquo; — she&apos;s never wrong.
                    </p>
                    <p className="font-data mt-2" style={{ fontSize: 11, color: 'var(--gs-mid)' }}>
                      Girlfriend energy. Never corporate. Never apologetic.
                    </p>
                  </div>
                </BrandPanel>

                <BrandPanel title="vocabulary.dat">
                  <div className="p-6">
                    {/* Approved */}
                    <p className="font-data font-bold mb-2" style={{ fontSize: 11, color: 'var(--gs-terminal)', letterSpacing: '0.06em' }}>
                      APPROVED
                    </p>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {APPROVED_VOCAB.map((word) => (
                        <span
                          key={word}
                          className="font-data px-2.5 py-1 rounded-full"
                          style={{
                            fontSize: 11,
                            background: 'rgba(0,255,136,0.08)',
                            color: 'var(--gs-terminal)',
                            border: '1px solid rgba(0,255,136,0.2)',
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>

                    {/* Banned */}
                    <p className="font-data font-bold mb-2" style={{ fontSize: 11, color: 'var(--gs-critical)', letterSpacing: '0.06em' }}>
                      BANNED
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {BANNED_VOCAB.map((word) => (
                        <span
                          key={word}
                          className="font-data px-2.5 py-1 rounded-full relative overflow-hidden"
                          style={{
                            fontSize: 11,
                            background: 'rgba(255,80,80,0.08)',
                            color: 'var(--gs-critical)',
                            border: '1px solid rgba(255,80,80,0.2)',
                            textDecoration: 'line-through',
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                </BrandPanel>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: VISUAL EFFECTS ───────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="06"
              title="Atmosphere"
              subtitle="Frosted glass, CRT scanlines, Bayer dither, noise grain, pink glow. Every surface breathes."
            />
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Frosted Glass */}
            <ScrollReveal>
              <BrandPanel title="frosted_glass.fx">
                <div className="p-6 relative" style={{ minHeight: 200 }}>
                  {/* Stacked panels demo */}
                  <div className="relative" style={{ height: 160 }}>
                    {[0.4, 0.6, 0.8].map((opacity, i) => (
                      <div
                        key={i}
                        className="absolute rounded-gs border border-gs-mid/20 p-3"
                        style={{
                          background: `oklch(0.14 0.02 340 / ${opacity})`,
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          top: i * 20,
                          left: i * 12,
                          right: 40 - i * 12,
                          bottom: 80 - i * 20,
                        }}
                      >
                        <span className="font-data" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                          opacity: {opacity} · blur: 16px
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* CRT Scanlines */}
            <ScrollReveal delay={0.1}>
              <BrandPanel title="scanlines.fx">
                <div className="p-6 relative" style={{ minHeight: 200 }}>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,178,239,0.03) 2px, rgba(255,178,239,0.03) 4px)',
                    }}
                  />
                  <div className="relative">
                    <p className="font-data" style={{ fontSize: 13, color: 'var(--gs-light)', lineHeight: 1.6 }}>
                      Repeating linear gradient overlay. 2px transparent + 2px tinted alternating bands. CRT phosphor aesthetic.
                    </p>
                    <pre className="font-data mt-3" style={{ fontSize: 10, color: 'var(--gs-mid)', whiteSpace: 'pre-wrap' }}>
                      {`repeating-linear-gradient(\n  0deg,\n  transparent 0px,\n  transparent 2px,\n  rgba(255,178,239,0.03) 2px,\n  rgba(255,178,239,0.03) 4px\n)`}
                    </pre>
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Bayer Dither */}
            <ScrollReveal delay={0.2}>
              <BrandPanel title="dither.fx">
                <div className="p-6 relative" style={{ minHeight: 200 }}>
                  <div className="space-y-4">
                    <div>
                      <p className="font-data mb-1" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>DitherEdge</p>
                      <div
                        className="h-2"
                        style={{
                          background: `repeating-conic-gradient(var(--gs-base) 0% 25%, transparent 0% 50%) 0 0 / 2px 2px`,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-data mb-1" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>DitherOverlay (0.08)</p>
                      <div
                        className="h-16 rounded-gs relative overflow-hidden"
                        style={{ background: 'oklch(0.12 0.01 340)' }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `repeating-conic-gradient(var(--gs-base) 0% 25%, transparent 0% 50%) 0 0 / 2px 2px`,
                            opacity: 0.08,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="font-data mb-1" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>DitherOverlay (0.20)</p>
                      <div
                        className="h-16 rounded-gs relative overflow-hidden"
                        style={{ background: 'oklch(0.12 0.01 340)' }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `repeating-conic-gradient(var(--gs-base) 0% 25%, transparent 0% 50%) 0 0 / 2px 2px`,
                            opacity: 0.20,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Noise Grain */}
            <ScrollReveal>
              <BrandPanel title="grain.fx">
                <div className="p-6" style={{ minHeight: 200 }}>
                  <div className="grid grid-cols-3 gap-3">
                    {[0.03, 0.08, 0.15].map((op) => (
                      <div key={op} className="relative rounded-gs overflow-hidden" style={{ height: 80, background: 'var(--gs-void)' }}>
                        <GrainOverlay opacity={op} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-data relative z-10" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                            {op}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="font-data mt-3" style={{ fontSize: 10, color: 'var(--gs-mid)', lineHeight: 1.4 }}>
                    SVG feTurbulence · fractalNoise · baseFreq 0.85 · 4 octaves · tiled 256px
                  </p>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Pink Glow */}
            <ScrollReveal delay={0.1}>
              <BrandPanel title="glow.fx">
                <div className="p-6 flex flex-col items-center gap-4" style={{ minHeight: 200 }}>
                  <div style={{ filter: 'drop-shadow(0 0 8px var(--gs-base)) drop-shadow(0 0 16px rgba(255,178,239,0.2))' }}>
                    <ChloeSprite state="idle" size={64} glowing frame={frame} />
                  </div>
                  <span
                    className="font-display font-bold uppercase"
                    style={{
                      fontSize: 24,
                      color: 'var(--gs-base)',
                      textShadow: '0 0 8px #FFB2EF, 0 0 20px rgba(255,178,239,0.3)',
                    }}
                  >
                    GHOST GLOW
                  </span>
                  <div
                    className="w-full p-3 rounded-gs text-center"
                    style={{
                      background: 'oklch(0.14 0.02 340 / 0.6)',
                      boxShadow: '0 0 16px oklch(0.82 0.15 340 / 0.2)',
                      border: '1px solid oklch(0.72 0.17 340 / 0.2)',
                    }}
                  >
                    <span className="font-data" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                      shadow-ghost-glow
                    </span>
                  </div>
                </div>
              </BrandPanel>
            </ScrollReveal>

            {/* Window Chrome */}
            <ScrollReveal delay={0.2}>
              <BrandPanel title="window_chrome.ui">
                <div className="p-6" style={{ minHeight: 200 }}>
                  {/* Mini window demo */}
                  <div className="rounded-gs-lg overflow-hidden border border-gs-mid/30 shadow-window">
                    {/* Active titlebar */}
                    <div className="flex items-center gap-2 px-3" style={{ height: 28, background: 'var(--gs-base)' }}>
                      <div className="flex items-center gap-[5px]">
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#FF5F57' }} />
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#FEBC2E' }} />
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#28C840' }} />
                      </div>
                      <span className="font-data flex-1 text-center" style={{ fontSize: 10, fontWeight: 600, color: 'var(--gs-void)' }}>
                        active_window.exe
                      </span>
                      <div className="w-[42px]" />
                    </div>
                    <div className="p-3" style={{ background: 'oklch(0.13 0.01 340 / 0.5)', height: 40 }} />
                  </div>

                  {/* Inactive titlebar */}
                  <div className="rounded-gs-lg overflow-hidden border border-gs-mid/30 mt-3" style={{ opacity: 0.7 }}>
                    <div className="flex items-center gap-2 px-3" style={{ height: 28, background: 'var(--gs-mid)' }}>
                      <div className="flex items-center gap-[5px]">
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#6E5A65' }} />
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#6E5A65' }} />
                        <div className="w-[8px] h-[8px] rounded-full" style={{ background: '#6E5A65' }} />
                      </div>
                      <span className="font-data flex-1 text-center" style={{ fontSize: 10, fontWeight: 600, color: 'var(--gs-deep)' }}>
                        inactive_window.exe
                      </span>
                      <div className="w-[42px]" />
                    </div>
                    <div className="p-3" style={{ background: 'oklch(0.13 0.01 340 / 0.3)', height: 40 }} />
                  </div>

                  <p className="font-data mt-3" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                    macOS traffic lights · pink titlebar (active) · muted mid (inactive)
                  </p>
                </div>
              </BrandPanel>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: MEDIA ASSETS ─────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.03} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <ScrollReveal>
            <SectionHeader
              number="07"
              title="Media Assets"
              subtitle="OG images, hero photography, showcase creatives, grain textures, and Remotion video compositions."
            />
          </ScrollReveal>

          {/* OG Background — full width */}
          <ScrollReveal>
            <BrandPanel title="og-background.jpg — 2752×1536">
              <div className="relative overflow-hidden rounded-b-gs-lg">
                <img
                  src={ogBackgroundImg.src}
                  alt="OG Background — psychedelic pixel art with rainbow beams and ghost faces"
                  className="w-full"
                  style={{ display: 'block' }}
                />
                <GrainOverlay opacity={0.04} />
              </div>
            </BrandPanel>
          </ScrollReveal>

          {/* OG Social Card */}
          <ScrollReveal delay={0.1}>
            <div className="mt-6">
              <BrandPanel title="og-image.png — 1200×630 (social card)">
                <div className="p-6 flex justify-center">
                  <div className="relative rounded-gs overflow-hidden border border-gs-mid/20" style={{ maxWidth: 600 }}>
                    <img
                      src={ogImageImg.src}
                      alt="OG Social Card with ASCII logo"
                      className="w-full"
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>

          {/* Boss Deck Heroes */}
          <ScrollReveal delay={0.2}>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { src: heroCoverImg.src, label: 'hero-cover.jpg', desc: 'Skyscrapers' },
                { src: heroHorizonImg.src, label: 'hero-horizon.jpg', desc: 'Ocean Horizon' },
              ].map(({ src, label, desc }) => (
                <BrandPanel key={label} title={label}>
                  <div className="relative overflow-hidden">
                    <img src={src} alt={desc} className="w-full" style={{ display: 'block' }} />
                    <GrainOverlay opacity={0.05} />
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2"
                      style={{ background: 'linear-gradient(transparent, rgba(8,8,8,0.8))' }}
                    >
                      <span className="font-data" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>{desc}</span>
                    </div>
                  </div>
                </BrandPanel>
              ))}
            </div>
          </ScrollReveal>

          {/* Live Brand Components */}
          <ScrollReveal delay={0.3}>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Roast Slide Plasma Background */}
              <BrandPanel title="roast_plasma.bg — Verdict Slide">
                <div className="relative overflow-hidden" style={{ height: 200 }}>
                  {/* Animated plasma — sine interference waves */}
                  <canvas
                    ref={(canvas) => {
                      if (!canvas || (canvas as HTMLCanvasElement & { _init?: boolean })._init) return;
                      (canvas as HTMLCanvasElement & { _init?: boolean })._init = true;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      canvas.width = 200;
                      canvas.height = 200;
                      let t = 0;
                      const draw = () => {
                        t += 0.02;
                        for (let x = 0; x < 200; x += 4) {
                          for (let y = 0; y < 200; y += 4) {
                            const v = Math.sin(x * 0.02 + t) + Math.sin(y * 0.03 + t * 0.7) + Math.sin((x + y) * 0.01 + t * 1.3);
                            const h = 300 + v * 20;
                            const l = 18 + v * 5;
                            ctx.fillStyle = `hsl(${h}, 75%, ${l}%)`;
                            ctx.fillRect(x, y, 4, 4);
                          }
                        }
                        requestAnimationFrame(draw);
                      };
                      draw();
                    }}
                    className="absolute inset-0 w-full h-full"
                    style={{ filter: 'blur(16px) saturate(1.2)', transform: 'scale(1.1)' }}
                  />
                  {/* Grain overlay */}
                  <GrainOverlay opacity={0.12} />
                  {/* Vignette */}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(8,8,8,0.6) 100%)' }}
                  />
                  {/* Label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="font-display font-bold uppercase relative z-10"
                      style={{
                        fontSize: 18,
                        color: 'var(--gs-light)',
                        textShadow: '0 0 20px rgba(255,178,239,0.4), 0 0 40px rgba(255,178,239,0.2)',
                      }}
                    >
                      Plasma Canvas
                    </span>
                  </div>
                </div>
              </BrandPanel>

              {/* Matrix Rain */}
              <BrandPanel title="matrix_rain.fx — Scan Sequence" variant="terminal">
                <div className="relative overflow-hidden" style={{ height: 200, background: '#0A0A0A' }}>
                  <MatrixRain charset="katakana" fontSize={12} speed={0.3} fadeOpacity={0.03} />
                  <div className="absolute inset-0 flex items-end justify-center pb-3">
                    <span
                      className="font-data relative z-10 px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 10,
                        background: 'rgba(0,0,0,0.6)',
                        color: 'var(--gs-terminal)',
                        border: '1px solid rgba(0,255,136,0.2)',
                      }}
                    >
                      katakana · 12px · speed 0.3
                    </span>
                  </div>
                </div>
              </BrandPanel>

              {/* GhostChat™ Icon — inline SVG ghost from scan-dashboard-content.tsx */}
              <BrandPanel title="ghostchat_icon.ui — GhostChat™">
                <div className="p-6 flex flex-col items-center justify-center gap-6" style={{ height: 200 }}>
                  {/* The actual GhostChat icon + label at multiple sizes */}
                  <div className="flex items-center gap-8">
                    {[16, 24, 32, 48].map((sz) => (
                      <div key={sz} className="flex flex-col items-center gap-2">
                        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="var(--gs-base)">
                          <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                          <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                          <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                        </svg>
                        <span className="font-data" style={{ fontSize: 9, color: 'var(--gs-mid)' }}>{sz}px</span>
                      </div>
                    ))}
                  </div>
                  {/* In-context usage */}
                  <div className="flex items-center gap-1.5" style={{ color: 'var(--gs-base)' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                    </svg>
                    <span className="font-data" style={{ fontSize: 13 }}>GhostChat&trade;</span>
                  </div>
                  <p className="font-data text-center" style={{ fontSize: 10, color: 'var(--gs-mid)' }}>
                    Inline SVG · 16×16 viewBox · scalloped bottom · fill: currentColor
                  </p>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>

          {/* Verified Seal + MarketingIQ + Score Gauge */}
          <ScrollReveal delay={0.35}>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verified Audit Seal — exact copy from closing-slide.tsx */}
              <BrandPanel title="audit_seal.svg — Verified Badge">
                <div className="p-6 flex items-center justify-center" style={{ height: 240, background: 'var(--gs-void)' }}>
                  <div style={{ width: 160, height: 160, filter: 'drop-shadow(0 0 10px rgba(255,178,239,0.12))' }}>
                    {(() => {
                      const s = 120, cx = s / 2, cy = s / 2;
                      const pk = 'rgba(255,178,239,';
                      const dots = Array.from({ length: 24 }, (_, i) => {
                        const angle = ((i * 15) - 90) * Math.PI / 180;
                        return { x: cx + 54 * Math.cos(angle), y: cy + 54 * Math.sin(angle), r: i % 3 === 0 ? 2 : 1 };
                      });
                      const diamonds = Array.from({ length: 8 }, (_, i) => {
                        const angle = ((i * 45) - 90) * Math.PI / 180;
                        return { x: cx + 57 * Math.cos(angle), y: cy + 57 * Math.sin(angle) };
                      });
                      return (
                        <svg viewBox={`0 0 ${s} ${s}`} width="160" height="160">
                          <circle cx={cx} cy={cy} r={56} fill="none" stroke={`${pk}0.35)`} strokeWidth="1.2" />
                          {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`${pk}${d.r > 1 ? '0.5' : '0.25'})`} />)}
                          {diamonds.map((p, i) => <path key={i} d={`M ${p.x} ${p.y-2.5} L ${p.x+1} ${p.y} L ${p.x} ${p.y+2.5} L ${p.x-1} ${p.y} Z`} fill={`${pk}0.4)`} />)}
                          <circle cx={cx} cy={cy} r={44} fill="none" stroke={`${pk}0.18)`} strokeWidth="0.5" strokeDasharray="3 3" />
                          <circle cx={cx} cy={cy} r={40} fill="none" stroke={`${pk}0.12)`} strokeWidth="0.5" />
                          <text x={cx} y={cy-18} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '6.5px', fontFamily: 'var(--font-data)', fill: `${pk}0.55)`, letterSpacing: '2.5px' }}>ALPHASCAN</text>
                          <line x1={cx-22} y1={cy-10} x2={cx+22} y2={cy-10} stroke={`${pk}0.2)`} strokeWidth="0.5" />
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontFamily: 'var(--font-display-face)', fontWeight: 700, fill: `${pk}0.65)`, letterSpacing: '2px' }}>VERIFIED</text>
                          <text x={cx} y={cy+13} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '7px', fontFamily: 'var(--font-data)', fill: `${pk}0.45)`, letterSpacing: '3px' }}>AUDIT</text>
                          <line x1={cx-22} y1={cy+21} x2={cx+22} y2={cy+21} stroke={`${pk}0.2)`} strokeWidth="0.5" />
                          <text x={cx} y={cy+32} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '9px', fontFamily: 'var(--font-data)', fontWeight: 700, fill: `${pk}0.5)`, letterSpacing: '1px' }}>MIQ 57</text>
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              </BrandPanel>

              {/* MarketingIQ™ */}
              <BrandPanel title="marketingiq.txt — Trademark">
                <div className="p-6 flex flex-col items-center justify-center gap-4" style={{ height: 240 }}>
                  <span
                    className="font-data uppercase"
                    style={{
                      fontSize: 11,
                      color: 'var(--gs-mid)',
                      letterSpacing: '0.3em',
                    }}
                  >
                    MarketingIQ™
                  </span>
                  <span
                    className="font-data"
                    style={{
                      fontSize: 64,
                      fontWeight: 800,
                      color: 'var(--gs-base)',
                      lineHeight: 1,
                      textShadow: '0 0 24px rgba(255,178,239,0.3)',
                    }}
                  >
                    87
                  </span>
                  <span
                    className="font-data uppercase"
                    style={{
                      fontSize: 12,
                      color: 'var(--gs-terminal)',
                      letterSpacing: '0.2em',
                    }}
                  >
                    Excellent
                  </span>
                  <p className="font-data text-center" style={{ fontSize: 10, color: 'var(--gs-mid)', lineHeight: 1.4 }}>
                    font-data · uppercase · 0.3em tracking · ™ entity
                  </p>
                </div>
              </BrandPanel>

              {/* MarketingIQ Score Gauge — double ring with category segments */}
              <BrandPanel title="score_gauge.svg — Double Ring">
                <div className="p-6 flex items-center justify-center" style={{ height: 240, background: 'var(--gs-void)' }}>
                  <div style={{ width: 200, height: 200, position: 'relative' }}>
                    <svg viewBox="0 0 360 360" style={{ width: '100%', height: '100%' }}>
                      {/* Inner track */}
                      <circle cx="180" cy="180" r="140" fill="none" stroke="rgba(255,178,239,0.06)" strokeWidth="8" />
                      {/* Score arc — amber/gold for 57 */}
                      <circle
                        cx="180" cy="180" r="140"
                        fill="none"
                        stroke="#FFC800"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(0.57) * 2 * Math.PI * 140} ${2 * Math.PI * 140}`}
                        transform="rotate(-90 180 180)"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(255,200,0,0.35))' }}
                      />
                      {/* Outer category segments */}
                      {[
                        { name: 'SEO', score: 80, color: '#00FF88' },
                        { name: 'PPC', score: 81, color: '#00FF88' },
                        { name: 'MarTech', score: 64, color: '#FFC800' },
                        { name: 'Analytics', score: 52, color: '#FFC800' },
                        { name: 'Security', score: 38, color: '#FF5050' },
                        { name: 'Perf', score: 45, color: '#FFC800' },
                        { name: 'Brand', score: 71, color: '#00FF88' },
                        { name: 'Social', score: 55, color: '#FFC800' },
                      ].map((cat, i) => {
                        const segAngle = 360 / 8;
                        const startDeg = i * segAngle;
                        const catProg = cat.score / 100;
                        return (
                          <g key={cat.name}>
                            <circle
                              cx="180" cy="180" r="158"
                              fill="none"
                              stroke={cat.color}
                              strokeWidth="4"
                              strokeLinecap="round"
                              opacity="0.7"
                              strokeDasharray={`${catProg * segAngle * Math.PI * 158 / 180} ${2 * Math.PI * 158}`}
                              transform={`rotate(${startDeg - 90} 180 180)`}
                            />
                            {/* Category label */}
                            <text
                              x={180 + 175 * Math.cos(((startDeg + segAngle * catProg * 0.5) - 90) * Math.PI / 180)}
                              y={180 + 175 * Math.sin(((startDeg + segAngle * catProg * 0.5) - 90) * Math.PI / 180)}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={cat.color}
                              fontSize="10"
                              fontFamily="var(--font-data)"
                              opacity="0.6"
                              transform={`rotate(${startDeg + segAngle * catProg * 0.5} ${180 + 175 * Math.cos(((startDeg + segAngle * catProg * 0.5) - 90) * Math.PI / 180)} ${180 + 175 * Math.sin(((startDeg + segAngle * catProg * 0.5) - 90) * Math.PI / 180)})`}
                            >
                              {cat.name} {cat.score}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {/* Center number */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="font-data" style={{ fontSize: 48, fontWeight: 700, color: 'var(--gs-light)', lineHeight: 0.85, letterSpacing: '-0.04em' }}>57</span>
                      <span className="font-data uppercase" style={{ fontSize: 8, color: 'var(--gs-mid)', letterSpacing: '0.2em', marginTop: 6 }}>MarketingIQ</span>
                    </div>
                  </div>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>

          {/* Remotion Compositions */}
          <ScrollReveal delay={0.4}>
            <div className="mt-6">
              <BrandPanel title="remotion_compositions.json — Video Assets">
                <div className="p-6">
                  <div className="space-y-2">
                    {REMOTION_COMPOSITIONS.map((comp) => (
                      <div
                        key={comp.name}
                        className="flex items-center justify-between p-3 rounded-gs"
                        style={{
                          background: 'oklch(0.12 0.01 340 / 0.5)',
                          border: '1px solid oklch(0.25 0.03 340 / 0.2)',
                        }}
                      >
                        <div>
                          <span className="font-data font-bold" style={{ fontSize: 12, color: 'var(--gs-base)' }}>
                            {comp.name}
                          </span>
                          <span className="font-data ml-2" style={{ fontSize: 11, color: 'var(--gs-mid)' }}>
                            {comp.format}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-data" style={{ fontSize: 11, color: 'var(--gs-mid)' }}>
                            {comp.dims}
                          </span>
                          <span className="font-data px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)', border: '1px solid rgba(255,178,239,0.12)' }}>
                            {comp.duration}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── SECTION 8: TAGLINES & COPY ──────────────────────────── */}
      <section className="relative py-16 md:py-24 px-4 md:px-8">
        <GrainOverlay opacity={0.04} />

        {/* Pink vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,178,239,0.04) 0%, transparent 50%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <ScrollReveal>
            <SectionHeader number="08" title="Copy" subtitle="The words that define the brand." />
          </ScrollReveal>

          {/* Primary tagline */}
          <ScrollReveal>
            <div className="text-center py-12 md:py-20">
              <motion.p
                className="font-display font-bold"
                style={{
                  fontSize: 'clamp(32px, 6vw, 72px)',
                  color: 'var(--gs-light)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                Your website is losing you money.
              </motion.p>
              <motion.p
                className="font-marker mt-2"
                style={{
                  fontSize: 'clamp(28px, 5vw, 56px)',
                  color: 'var(--gs-base)',
                  letterSpacing: '-0.04em',
                  textShadow: '0 0 24px rgba(255,178,239,0.3)',
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Let&apos;s fix that.
              </motion.p>
            </div>
          </ScrollReveal>

          {/* Dither separator */}
          <div
            className="my-4 h-1"
            style={{
              background: `repeating-conic-gradient(var(--gs-deep) 0% 25%, transparent 0% 50%) 0 0 / 2px 2px`,
              opacity: 0.6,
            }}
          />

          {/* Secondary taglines */}
          <ScrollReveal delay={0.1}>
            <div className="text-center py-12">
              <BrandPanel title="tagline_02.txt" variant="terminal">
                <div className="p-8 text-center" style={{ background: '#0A0A0A' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-terminal)',
                      fontSize: 'clamp(20px, 3vw, 36px)',
                      color: 'var(--gs-terminal)',
                      textShadow: '0 0 4px var(--gs-terminal), 0 0 12px rgba(0,255,136,0.2)',
                    }}
                  >
                    Stop guessing. Start scanning.
                  </span>
                </div>
              </BrandPanel>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="text-center py-6">
              <p
                className="font-data uppercase"
                style={{
                  fontSize: 'clamp(12px, 2vw, 16px)',
                  color: 'var(--gs-mid)',
                  letterSpacing: '0.08em',
                  lineHeight: 1.6,
                }}
              >
                MarTech breakdown. Strategic insights. Actionable recommendations.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="text-center py-8">
              <p className="font-data" style={{ fontSize: 'clamp(16px, 2.5vw, 24px)', color: 'var(--gs-light)', lineHeight: 1.5 }}>
                <span className="font-data font-bold" style={{ fontSize: 'clamp(36px, 5vw, 64px)', color: 'var(--gs-base)' }}>42</span>
                {' '}modules. AI-powered. Your full MarTech audit.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <div className="text-center py-12">
              <p
                className="font-display font-extrabold uppercase"
                style={{
                  fontSize: 'clamp(48px, 8vw, 96px)',
                  color: 'var(--gs-base)',
                  letterSpacing: '-0.02em',
                  lineHeight: 0.95,
                  textShadow: '0 0 32px rgba(255,178,239,0.3), 0 0 64px rgba(255,178,239,0.15)',
                }}
              >
                GhostScan™
              </p>
              <p className="font-data mt-3" style={{ fontSize: 11, color: 'var(--gs-mid)' }}>
                GhostScan is a trademark of Alpha Scan.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <section className="relative py-16 px-4">
        <GrainOverlay opacity={0.03} />
        <DitherEdge position="top" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div style={{ filter: 'drop-shadow(0 0 12px rgba(255,178,239,0.4))' }}>
            <ChloeSprite state="celebrating" size={128} glowing frame={frame} />
          </div>
          <p
            className="font-marker"
            style={{
              fontSize: 24,
              color: 'var(--gs-base)',
              textShadow: '0 0 16px rgba(255,178,239,0.3)',
            }}
          >
            That&apos;s the brand.
          </p>
          <p className="font-data" style={{ fontSize: 12, color: 'var(--gs-mid)', letterSpacing: '0.06em' }}>
            marketingalphascan.com
          </p>
          <p className="font-data mt-4" style={{ fontSize: 10, color: 'var(--gs-deep)' }}>
            &copy; {new Date().getFullYear()} Alpha Scan. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}
