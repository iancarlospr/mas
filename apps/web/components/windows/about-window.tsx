'use client';

import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   About — Module Directory + Legal Footer

   Full list of 45 forensic modules organized by category.
   Legal links open in new browser tabs.
   ═══════════════════════════════════════════════════════════════ */

interface ModuleCategory {
  name: string;
  modules: { id: string; name: string }[];
}

const CATEGORIES: ModuleCategory[] = [
  {
    name: 'Security & Compliance',
    modules: [
      { id: 'M01', name: 'DNS & Security Baseline' },
      { id: 'M12', name: 'Legal, Security & Compliance' },
      { id: 'M40', name: 'Subdomain & Attack Surface' },
    ],
  },
  {
    name: 'Analytics & Measurement',
    modules: [
      { id: 'M05', name: 'Analytics Architecture' },
      { id: 'M06', name: 'Paid Media Infrastructure' },
      { id: 'M06b', name: 'PPC Landing Page Analysis' },
      { id: 'M08', name: 'Tag Governance' },
      { id: 'M09', name: 'Behavioral Intelligence' },
    ],
  },
  {
    name: 'Performance & Experience',
    modules: [
      { id: 'M03', name: 'Page Load & Resource Performance' },
      { id: 'M10', name: 'Accessibility Overlay Detection' },
      { id: 'M11', name: 'Console & Error Logging' },
      { id: 'M13', name: 'Performance & Carbon' },
      { id: 'M14', name: 'Mobile & Responsive' },
    ],
  },
  {
    name: 'SEO & Content',
    modules: [
      { id: 'M04', name: 'Page Metadata' },
      { id: 'M15', name: 'Social & Sharing' },
      { id: 'M26', name: 'Rankings' },
      { id: 'M34', name: 'Losing Keywords' },
      { id: 'M39', name: 'Sitemap & Indexing' },
    ],
  },
  {
    name: 'Paid Media',
    modules: [
      { id: 'M21', name: 'Ad Library Recon' },
      { id: 'M28', name: 'Top Paid Keywords' },
      { id: 'M29', name: 'Competitors' },
    ],
  },
  {
    name: 'MarTech & Infrastructure',
    modules: [
      { id: 'M02', name: 'CMS & Infrastructure' },
      { id: 'M07', name: 'MarTech Orchestration' },
      { id: 'M20', name: 'Ecommerce/SaaS Detection' },
    ],
  },
  {
    name: 'Brand & Digital Presence',
    modules: [
      { id: 'M16', name: 'PR & Media' },
      { id: 'M17', name: 'Careers & HR' },
      { id: 'M18', name: 'Investor Relations' },
      { id: 'M19', name: 'Support & Success' },
      { id: 'M22', name: 'News Sentiment Scanner' },
      { id: 'M23', name: 'Social Sentiment Scanner' },
      { id: 'M37', name: 'Review Velocity' },
      { id: 'M38', name: 'Local Pack' },
    ],
  },
  {
    name: 'Market Intelligence',
    modules: [
      { id: 'M24', name: 'Monthly Visits' },
      { id: 'M25', name: 'Traffic by Country' },
      { id: 'M27', name: 'Paid Traffic Cost' },
      { id: 'M30', name: 'Traffic Sources' },
      { id: 'M31', name: 'Domain Trust' },
      { id: 'M33', name: 'Brand Search' },
      { id: 'M36', name: 'Google Shopping' },
    ],
  },
  {
    name: 'AI Synthesis',
    modules: [
      { id: 'M41', name: 'Individual Module AI Synthesis' },
      { id: 'M43', name: 'PRD Generation' },
      { id: 'M45', name: 'Stack Analyzer' },
      { id: 'M46', name: 'Boss Deck' },
      { id: 'MD', name: 'Markdown Export for NotebookLM' },
    ],
  },
];

const TOTAL_MODULES = CATEGORIES.reduce((sum, cat) => sum + cat.modules.length, 0);

function CategorySection({ category }: { category: ModuleCategory }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bevel-sunken overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-gs-3 py-gs-2 cursor-pointer hover:bg-gs-red/5 transition-colors"
      >
        <div className="flex items-center gap-gs-2">
          <span className="font-system text-os-xs font-bold text-gs-light">
            {category.name}
          </span>
        </div>
        <div className="flex items-center gap-gs-2">
          <span className="font-data text-data-xs text-gs-muted">
            {category.modules.length}
          </span>
          <span className="font-data text-data-xs text-gs-mid transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ▸
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gs-mid/15 px-gs-3 py-gs-2 space-y-[6px]">
          {category.modules.map((mod) => (
            <div key={mod.id} className="flex items-center gap-gs-2">
              <span className="text-gs-red text-[8px] flex-shrink-0">·</span>
              <span className="font-data text-data-xs text-gs-light/80 flex items-center gap-1">
                {mod.name}
                {mod.id === 'MD' && (
                  <svg width="10" height="10" viewBox="0 0 175 132" fill="currentColor" style={{ flexShrink: 0, opacity: 0.6 }}>
                    <path d="M87.27,1.14C39.07,1.14,0,39.88,0,87.69v41.44h16.09v-4.13c0-19.39,15.84-35.11,35.39-35.11s35.39,15.72,35.39,35.11v4.13h16.09v-4.13c0-28.2-23.05-51.05-51.48-51.05-11.07,0-21.32,3.46-29.72,9.37,8.79-17.32,26.88-29.21,47.77-29.21,29.51,0,53.44,23.74,53.44,53v22.02h16.09v-22.02c0-38.08-31.13-68.96-69.53-68.96-17.27,0-33.06,6.24-45.22,16.58,11.94-22.39,35.65-37.64,62.97-37.64,39.32,0,71.19,31.61,71.19,70.6v41.44h16.09v-41.44C174.55,39.88,135.48,1.14,87.27,1.14Z" />
                  </svg>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AboutWindow() {
  return (
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-6">
      {/* Header */}
      <div className="text-center space-y-gs-2">
        <h1 className="font-display text-display-sm">Module Directory</h1>
        <p className="font-data text-data-xs text-gs-muted">
          {TOTAL_MODULES} forensic modules across 5 execution phases
        </p>
      </div>

      {/* Module categories */}
      <div className="space-y-gs-2">
        {CATEGORIES.map((cat) => (
          <CategorySection key={cat.name} category={cat} />
        ))}
      </div>

      {/* Execution phases summary */}
      <div className="bevel-sunken p-gs-3 space-y-gs-2">
        <h2 className="font-system text-os-xs font-bold text-gs-light">
          Execution Phases
        </h2>
        <div className="space-y-[4px]">
          {[
            { phase: '01', name: 'Passive', desc: 'HTTP-only recon: headers, DNS, metadata' },
            { phase: '02', name: 'Browser', desc: 'Stealth Chromium render + data layer capture' },
            { phase: '03', name: 'GhostScan\u2122', desc: 'Deep interaction: forms, modals, shadow DOM' },
            { phase: '04', name: 'External', desc: '3rd-party APIs: SEO, traffic, competitors' },
            { phase: '05', name: 'Synthesis', desc: 'AI analysis: brief, PRD, Boss Deck, stack analysis, .MD export' },
          ].map((p) => (
            <div key={p.phase} className="flex items-baseline gap-gs-2">
              <span className="font-data text-[10px] text-gs-red font-bold w-[18px] flex-shrink-0">
                {p.phase}
              </span>
              <span className="font-data text-data-xs">
                <span className="font-bold text-gs-light/90">{p.name}</span>
                <span className="text-gs-muted"> · {p.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className="text-center space-y-gs-1">
        <p className="font-data text-data-xs text-gs-muted">
          AlphaScan v1.0 · Build 2026.03
        </p>
        <p className="font-data text-data-xs text-gs-muted">
          © 2026 MarketingAlphaScan. All rights reserved.
        </p>
      </div>

      {/* Legal footer — external links */}
      <div className="border-t pt-gs-3" style={{ borderColor: 'oklch(0.22 0.03 340)' }}>
        <div className="flex items-center justify-center gap-gs-4 flex-wrap">
          {[
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => window.open(link.href, '_blank', 'noopener,noreferrer')}
              className="font-data text-[10px] text-gs-mid hover:text-gs-red transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
