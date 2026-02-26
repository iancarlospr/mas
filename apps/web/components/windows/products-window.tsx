'use client';

/* ═══════════════════════════════════════════════════════════════
   Products — Window Content

   Feature grid showing the 6 "System Components."
   Replaces the feature grid from (marketing)/page.tsx.
   ═══════════════════════════════════════════════════════════════ */

const PRODUCTS = [
  {
    icon: '01',
    name: 'Stack Forensics',
    desc: 'Every script, pixel, and SDK — identified, categorized, and scored. We find what they\'re running.',
  },
  {
    icon: '02',
    name: 'GhostScan™',
    desc: 'Deep browser interaction that triggers hidden scripts, lazy modals, and shadow DOM. Nothing hides.',
  },
  {
    icon: '03',
    name: 'Performance Audit',
    desc: 'Core Web Vitals, resource budgets, render-blocking analysis. Real Lighthouse, not cached junk.',
  },
  {
    icon: '04',
    name: 'Privacy & Consent',
    desc: 'Cookie audit, consent manager detection, GDPR/CCPA compliance gaps. The legal exposures.',
  },
  {
    icon: '05',
    name: 'Competitive Intel',
    desc: 'Traffic estimates, SEO profiles, backlink analysis, tech stack comparison vs. competitors.',
  },
  {
    icon: '06',
    name: 'AI Executive Brief',
    desc: 'Gemini Pro synthesizes all 45 modules into actionable insights, roadmap, and ROI projections.',
  },
];

export default function ProductsWindow() {
  return (
    <div className="p-gs-6 space-y-gs-6">
      <h1 className="font-display text-display-sm">System Components</h1>
      <p className="text-data-base text-gs-muted">
        AlphaScan reverse-engineers any URL through 45 forensic modules in 5 phases.
      </p>

      <div className="grid grid-cols-2 gap-gs-4">
        {PRODUCTS.map((p) => (
          <div key={p.name} className="bevel-raised bg-gs-chrome p-gs-4 space-y-gs-2">
            <div className="flex items-center gap-gs-2">
              <span className="font-data text-data-sm font-bold text-gs-red">{p.icon}</span>
              <h3 className="font-system text-os-base font-bold">{p.name}</h3>
            </div>
            <p className="font-data text-data-sm text-gs-muted">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
