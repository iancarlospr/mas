import { HeroScanFlow } from '@/components/scan/hero-scan-flow';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Landing Page
 * ═══════════════════════════════
 *
 * WHAT: The first thing anyone sees. The pitch for the product.
 * WHY:  Old page was generic navy SaaS. Now it's a GhostScan OS brand
 *       experience — retro aesthetic, Chloé, brand vocabulary, CRT grain.
 *       Feels like a MSCHF drop site, not a corporate landing (Plan Section 14).
 * HOW:  No desktop metaphor (that's post-scan only). This is the
 *       "promotional flyer for the OS" — hero with scan dialog, feature
 *       sections as "program descriptions", social proof as "compatibility list".
 */

const features = [
  {
    title: '42 Forensic Modules',
    description: 'DNS security, analytics architecture, ad pixel tracking, tag governance, consent compliance, and 37 more.',
    icon: '🔬',
    label: 'forensics.exe',
  },
  {
    title: 'GhostScan™ Detection',
    description: 'Active browser probing detects A/B tests, session recordings, behavioral triggers, and hidden experiments your analytics can\'t see.',
    icon: '👻',
    label: 'ghostscan.dll',
  },
  {
    title: 'AI Synthesis Engine',
    description: 'Chloé analyzes every finding, produces editorial insights, and generates a remediation roadmap.',
    icon: '🧠',
    label: 'chloe.protocol',
  },
  {
    title: 'MarketingIQ™ Score',
    description: 'A single 0-100 score measuring marketing technology effectiveness across 8 weighted categories.',
    icon: '📊',
    label: 'marketingiq.sys',
  },
  {
    title: 'Alpha Brief™ Report',
    description: 'A shareable dossier with data-dense charts, compliance audits, and a prioritized remediation plan.',
    icon: '📋',
    label: 'alphabrief.pdf',
  },
  {
    title: 'Ask Chloé (AI Chat)',
    description: 'Ask any question about scan results. Get specific, evidence-backed answers with receipts.',
    icon: '💬',
    label: 'askchloe.exe',
  },
];

const steps = [
  { num: '01', title: 'Drop a URL', description: 'Paste any website URL into the scan terminal.' },
  { num: '02', title: 'Chloé scans', description: '42 forensic modules extract the ground truth in 90 seconds.' },
  { num: '03', title: 'Get the receipts', description: 'MarketingIQ™ score, full dashboard, and actionable intelligence.' },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gs-black">
        {/* CRT grain overlay */}
        <div className="noise-grain" aria-hidden="true" />
        <div className="crt-scanlines" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-gs-4 py-gs-16 md:py-[120px]">
          <div className="text-center">
            {/* Chloé hero */}
            <div className="flex justify-center mb-gs-8">
              <ChloeSprite state="idle" size={128} glowing />
            </div>

            {/* Headline */}
            <h1 className="font-system text-[clamp(24px,5vw,56px)] font-bold text-gs-near-white leading-none max-w-4xl mx-auto mb-gs-6">
              Your MarTech stack is a landfill.
              <br />
              <span className="text-ghost-gradient">Let&apos;s run the forensics.</span>
            </h1>

            {/* Subhead */}
            <p className="font-data text-data-lg text-gs-mid-light max-w-2xl mx-auto mb-gs-10 leading-relaxed">
              42 forensic modules. 90 seconds. Chloé extracts the ground truth
              from any marketing stack — tracking gaps, compliance failures,
              and the things your analytics can&apos;t see.
            </p>

            {/* Scan input dialog */}
            <div className="flex justify-center">
              <HeroScanFlow />
            </div>

            <p className="mt-gs-4 font-data text-data-xs text-gs-mid-light/50">
              No credit card required. Free scan. 4 per day.
            </p>
          </div>
        </div>

        {/* Gradient fade to content */}
        <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-gs-near-white to-transparent" />
      </section>

      {/* ── Social Proof (Compatibility List) ─────────────── */}
      <section className="bg-gs-light bevel-raised py-gs-3">
        <div className="mx-auto max-w-7xl px-gs-4">
          <div className="flex flex-wrap justify-center gap-gs-6 font-data text-data-xs text-gs-mid">
            <span className="bevel-sunken px-gs-3 py-gs-1">10,000+ URLs scanned</span>
            <span className="bevel-sunken px-gs-3 py-gs-1">42 forensic modules</span>
            <span className="bevel-sunken px-gs-3 py-gs-1">GhostScan™ powered</span>
            <span className="bevel-sunken px-gs-3 py-gs-1">Chloé AI synthesis</span>
          </div>
        </div>
      </section>

      {/* ── Features (Program Descriptions) ───────────────── */}
      <section id="features" className="bg-gs-near-white py-gs-16">
        <div className="mx-auto max-w-7xl px-gs-4">
          <div className="text-center mb-gs-12">
            <h2 className="font-system text-[clamp(20px,3vw,36px)] font-bold text-gs-black">
              System Components
            </h2>
            <p className="mt-gs-3 font-data text-data-lg text-gs-mid max-w-xl mx-auto">
              The AlphaScan Method™ — a proprietary forensic framework.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gs-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bevel-raised bg-gs-light p-gs-6 hover:shadow-ghost-glow transition-shadow"
              >
                {/* File icon header */}
                <div className="flex items-center gap-gs-2 mb-gs-3">
                  <span className="text-2xl">{feature.icon}</span>
                  <span className="font-data text-data-xs text-gs-mid-light">{feature.label}</span>
                </div>
                <h3 className="font-system text-os-base font-bold text-gs-black mb-gs-2">
                  {feature.title}
                </h3>
                <p className="font-data text-data-sm text-gs-mid leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works (Terminal Steps) ─────────────────── */}
      <section className="bg-gs-black py-gs-16 relative">
        <div className="noise-grain" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-gs-4">
          <div className="text-center mb-gs-12">
            <h2 className="font-system text-[clamp(20px,3vw,36px)] font-bold text-gs-terminal terminal-glow">
              Execution Protocol
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gs-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-[64px] h-[64px] bevel-raised bg-gs-dark mb-gs-4"
                >
                  <span className="font-data text-data-2xl font-bold text-gs-cyan">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-system text-os-lg font-bold text-gs-near-white mb-gs-2">
                  {step.title}
                </h3>
                <p className="font-data text-data-sm text-gs-mid-light">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="bg-gs-black py-gs-16 relative">
        <div className="crt-scanlines" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-gs-4 text-center">
          <ChloeSprite state="smug" size={64} glowing className="mx-auto mb-gs-6" />
          <h2 className="font-system text-[clamp(20px,3vw,36px)] font-bold text-gs-near-white mb-gs-3">
            Ready to extract the ground truth?
          </h2>
          <p className="font-data text-data-lg text-gs-mid-light max-w-xl mx-auto mb-gs-8">
            Drop a URL. Chloé handles the rest.
          </p>
          <div className="flex justify-center">
            <HeroScanFlow />
          </div>
        </div>
      </section>
    </>
  );
}
