'use client';

/* ═══════════════════════════════════════════════════════════════
   About GhostScan OS — Window Content

   System specs, method, copyright. Replaces (marketing)/about.
   ═══════════════════════════════════════════════════════════════ */

export default function AboutWindow() {
  return (
    <div className="p-gs-6 space-y-gs-6 font-data text-data-base text-gs-ink">
      {/* Header */}
      <div className="text-center space-y-gs-2">
        <div className="text-[48px]">👻</div>
        <h1 className="font-display text-display-base">GhostScan OS</h1>
        <p className="text-gs-muted text-data-sm">Forensic Marketing Intelligence</p>
        <p className="text-data-xs text-gs-muted">Version 1.0 · Build 2026.02</p>
      </div>

      {/* System Specs */}
      <div className="bevel-sunken p-gs-4 space-y-gs-2">
        <h2 className="font-system text-os-base font-bold">System Information</h2>
        <table className="w-full text-data-sm">
          <tbody>
            {[
              ['Engine', 'Patchright + BullMQ + Redis'],
              ['AI', 'Google Gemini 2.5 (Flash + Pro)'],
              ['Modules', '45 forensic analysis modules'],
              ['Phases', '5 sequential execution phases'],
              ['Browser', 'Stealth Chromium (undetectable)'],
              ['Speed', '< 90 seconds per full scan'],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-gs-chrome-dark/20">
                <td className="py-gs-1 pr-gs-4 font-bold text-gs-muted">{label}</td>
                <td className="py-gs-1">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The Method */}
      <div className="space-y-gs-3">
        <h2 className="font-system text-os-base font-bold">The AlphaScan Method</h2>
        <div className="space-y-gs-2">
          {[
            { phase: '01', name: 'Passive Recon', desc: 'HTTP headers, DNS, robots.txt, sitemap analysis' },
            { phase: '02', name: 'Browser Forensics', desc: 'Full Chromium render, JS execution, cookie audit' },
            { phase: '03', name: 'GhostScan™', desc: 'Deep interaction — forms, modals, lazy-loaded content' },
            { phase: '04', name: 'External Intel', desc: '3rd-party APIs — SEO, backlinks, traffic, competitors' },
            { phase: '05', name: 'AI Synthesis', desc: 'Gemini Pro analysis, executive brief, roadmap, ROI' },
          ].map((p) => (
            <div key={p.phase} className="flex gap-gs-3 items-start">
              <span className="font-system text-os-sm text-gs-red font-bold shrink-0 w-8">
                {p.phase}
              </span>
              <div>
                <span className="font-bold">{p.name}</span>
                <span className="text-gs-muted"> — {p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div className="text-center text-data-xs text-gs-muted pt-gs-4 border-t border-gs-chrome-dark/20">
        <p>© 2026 AlphaScan. All rights reserved.</p>
        <p>Built with obsessive attention to detail.</p>
      </div>
    </div>
  );
}
