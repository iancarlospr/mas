'use client';

/* ═══════════════════════════════════════════════════════════════
   Why AlphaScan? — Window Content

   Execution protocol + differentiators from landing page.
   ═══════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    num: '01',
    title: 'Drop a URL',
    desc: 'Any website. Any competitor. Any landing page. Chloe eats it all.',
  },
  {
    num: '02',
    title: 'Chloe scans everything',
    desc: '45 forensic modules fire in parallel. Passive recon, browser forensics, GhostScan™ deep interaction, external intelligence, AI synthesis.',
  },
  {
    num: '03',
    title: 'Get the receipts',
    desc: 'Full MarketingIQ™ score, executive brief, remediation roadmap, ROI projections. The ground truth about any marketing stack.',
  },
];

const DIFFERENTIATORS = [
  {
    icon: '01',
    title: 'Unclockable',
    desc: 'Our stealth browser is indistinguishable from a real user. No bot walls, no blocked scans, no cached junk.',
  },
  {
    icon: '02',
    title: 'Forensic depth',
    desc: 'We don\'t just check headers. We execute JavaScript, trigger interactions, audit cookies, probe consent managers.',
  },
  {
    icon: '03',
    title: 'AI synthesis',
    desc: 'Raw data is noise. AI synthesizes 45 modules into actionable intelligence you can act on Monday morning.',
  },
  {
    icon: '04',
    title: '90 seconds',
    desc: 'Not hours. Not days. A full forensic analysis in under 90 seconds. Results you can share immediately.',
  },
];

export default function FeaturesWindow() {
  return (
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-6">
      {/* Execution Protocol */}
      <div className="space-y-gs-4">
        <h1 className="font-display text-display-sm">Execution Protocol</h1>
        <div className="space-y-gs-4">
          {STEPS.map((step) => (
            <div key={step.num} className="flex gap-gs-4 items-start">
              <div className="w-12 h-12 flex items-center justify-center bg-gs-red text-white font-display text-display-sm shrink-0">
                {step.num}
              </div>
              <div className="space-y-gs-1">
                <h3 className="font-system text-os-base font-bold">{step.title}</h3>
                <p className="font-data text-data-sm text-gs-muted">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Differentiators */}
      <div className="space-y-gs-4">
        <h2 className="font-system text-os-base font-bold">Why Not Lighthouse?</h2>
        <div className="grid grid-cols-2 gap-gs-3">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title} className="bevel-sunken p-gs-3 space-y-gs-1">
              <div className="flex items-center gap-gs-2">
                <span className="font-data text-data-sm font-bold text-gs-red">{d.icon}</span>
                <span className="font-system text-os-sm font-bold">{d.title}</span>
              </div>
              <p className="font-data text-data-xs text-gs-muted">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
