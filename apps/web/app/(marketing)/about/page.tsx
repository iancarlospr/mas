import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { softwareApplicationJsonLd } from '@/lib/json-ld';
import type { Metadata } from 'next';

export const revalidate = 86400;

/**
 * GhostScan OS — About Page
 * ═══════════════════════════════
 *
 * WHAT: "About This Program" styled as a Win95 Help > About dialog.
 * WHY:  Standard about pages are corporate filler. This one IS the brand —
 *       retro system info panels, spec sheets, Chloé as the narrator
 *       (Plan Section 14).
 * HOW:  Retro window panels, "system requirements" style tech stack,
 *       bevel-raised info boxes, Chloé anchoring the intro.
 */

export const metadata: Metadata = {
  title: 'About',
  description:
    'Forensic marketing intelligence powered by Alpha Scan. 45 modules, GhostScan™ detection, AI synthesis, MarketingIQ™ scoring.',
};

const techStack = [
  { label: 'Forensic Modules', value: '45' },
  { label: 'Scan Time', value: '~90 seconds' },
  { label: 'Detection Engine', value: 'GhostScan v2.0' },
  { label: 'AI Synthesis', value: 'Proprietary LLM Pipeline' },
  { label: 'Market Intelligence', value: 'Third-Party APIs' },
  { label: 'Browser Engine', value: 'Patchright (Chromium)' },
  { label: 'Scoring System', value: 'MarketingIQ 0-100' },
  { label: 'Output Format', value: 'Dashboard + PDF + Chat' },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />
      {/* Hero */}
      <section className="relative bg-gs-ink py-gs-16">
        <div className="noise-grain" aria-hidden="true" />
        <div className="crt-scanlines" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-gs-4 text-center">
          <ChloeSprite state="idle" size={64} glowing className="mx-auto mb-gs-6" />
          <h1 className="font-system text-[clamp(24px,4vw,44px)] font-bold text-gs-paper mb-gs-3">
            About GhostScan OS
          </h1>
          <p className="font-data text-data-lg text-gs-muted max-w-xl mx-auto">
            Version 2.0.26 &mdash; Forensic marketing intelligence.
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-gs-paper to-transparent" />
      </section>

      <section className="bg-gs-paper py-gs-16">
        <div className="mx-auto max-w-3xl px-gs-4 space-y-gs-8">
          {/* About window */}
          <div className="bevel-raised bg-gs-chrome">
            {/* Title bar */}
            <div className="h-[28px] bg-gs-red flex items-center px-gs-3">
              <span className="font-system text-os-xs text-gs-ink font-bold">
                About GhostScan OS
              </span>
            </div>

            <div className="p-gs-6 space-y-gs-6">
              <div className="flex items-start gap-gs-4">
                <div className="flex-shrink-0 text-[48px]">👻</div>
                <div>
                  <h2 className="font-system text-os-lg font-bold text-gs-ink">
                    MarketingAlphaScan
                  </h2>
                  <p className="font-data text-data-sm text-gs-muted mt-gs-1">
                    The AlphaScan Method&trade; &mdash; a proprietary forensic
                    framework that reverse-engineers any brand&apos;s complete
                    marketing technology stack, strategy, and performance.
                  </p>
                </div>
              </div>

              <div className="bevel-sunken bg-gs-paper p-gs-4">
                <p className="font-data text-data-sm text-gs-muted leading-relaxed">
                  45 forensic modules spanning DNS security, analytics architecture,
                  ad pixel tracking, tag governance, consent compliance, and
                  AI-powered synthesis. GhostScan&trade; active browser probing
                  detects what passive analysis can&apos;t see &mdash; A/B tests,
                  session recordings, behavioral triggers, and hidden experiments.
                </p>
              </div>

              <div className="bevel-sunken bg-gs-paper p-gs-4">
                <p className="font-data text-data-sm text-gs-muted leading-relaxed">
                  The result: a MarketingIQ&trade; score (0&ndash;100), an
                  executive-grade Alpha Brief&trade; dossier, and Chloe &mdash;
                  an AI analyst who knows your scan data better than you do.
                </p>
              </div>
            </div>
          </div>

          {/* System Requirements (Tech Stack) */}
          <div className="bevel-raised bg-gs-chrome">
            <div className="h-[28px] bg-gs-chrome flex items-center px-gs-3">
              <span className="font-system text-os-xs text-gs-ink font-bold">
                System Specifications
              </span>
            </div>

            <div className="p-gs-6">
              <div className="bevel-sunken bg-gs-paper p-gs-4">
                <table className="w-full">
                  <tbody>
                    {techStack.map((item) => (
                      <tr key={item.label} className="border-b border-gs-chrome last:border-0">
                        <td className="py-gs-2 pr-gs-4 font-system text-os-xs text-gs-muted w-1/2">
                          {item.label}
                        </td>
                        <td className="py-gs-2 font-data text-data-sm text-gs-ink font-bold">
                          {item.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* The Method */}
          <div className="bevel-raised bg-gs-chrome">
            <div className="h-[28px] bg-gs-chrome flex items-center px-gs-3">
              <span className="font-system text-os-xs text-gs-ink font-bold">
                The AlphaScan Method&trade;
              </span>
            </div>

            <div className="p-gs-6 space-y-gs-4">
              {[
                {
                  phase: 'Phase 1',
                  title: 'Passive Reconnaissance',
                  desc: 'HTTP-only analysis — DNS records, security headers, meta tags, structured data. No browser needed.',
                },
                {
                  phase: 'Phase 2',
                  title: 'Browser Forensics',
                  desc: 'Stealth Chromium probing — JavaScript execution, cookie analysis, storage forensics, network capture.',
                },
                {
                  phase: 'Phase 3',
                  title: 'GhostScan Detection',
                  desc: 'Deep interaction scanning — A/B test detection, session recording discovery, behavioral trigger mapping.',
                },
                {
                  phase: 'Phase 4',
                  title: 'Market Intelligence',
                  desc: 'External data enrichment — competitor analysis, keyword rankings, backlink profiles, ad spend estimation.',
                },
                {
                  phase: 'Phase 5',
                  title: 'AI Synthesis',
                  desc: 'AI-powered analysis — editorial insights, remediation roadmaps, ROI modeling, executive briefs.',
                },
              ].map((phase) => (
                <div key={phase.phase} className="flex gap-gs-4">
                  <div className="flex-shrink-0 bevel-raised bg-gs-ink w-[64px] h-[40px] flex items-center justify-center">
                    <span className="font-data text-data-xs text-gs-red font-bold">
                      {phase.phase}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-system text-os-sm font-bold text-gs-ink">
                      {phase.title}
                    </h3>
                    <p className="font-data text-data-xs text-gs-muted">
                      {phase.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="font-data text-data-xs text-gs-muted">
              &copy; {new Date().getFullYear()} MarketingAlphaScan. All rights reserved.
              <br />
              GhostScan&trade;, MarketingIQ&trade;, Alpha Brief&trade;, and
              AlphaScan Method&trade; are trademarks of MarketingAlphaScan.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
