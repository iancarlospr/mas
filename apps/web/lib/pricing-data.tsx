'use client';

import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Pricing Data — Shared between PricingWindow and MobilePricingSection
   ═══════════════════════════════════════════════════════════════ */

export interface Feature {
  text: string;
  included: boolean;
}

export interface Tier {
  name: string;
  badge?: string;
  price: string;
  originalPrice?: string;
  perUnit?: string;
  desc: string;
  features: Feature[];
  cta: string;
  highlighted: boolean;
  /** Stripe checkout product ID — undefined = free tier */
  product?: 'alpha_brief' | 'alpha_brief_plus';
}

export const TIERS: Tier[] = [
  {
    name: 'Free Scan',
    price: '$0',
    desc: 'MarTech infrastructure snapshot.',
    features: [
      { text: '3 MarTech modules', included: true },
      { text: 'CMS & stack detection', included: true },
      { text: 'Full results — no redaction', included: true },
      { text: '45-module forensic scan', included: false },
      { text: 'Executive Brief + PRD', included: false },
      { text: 'PDF export', included: false },
      { text: 'GhostChat™ credits', included: false },
    ],
    cta: 'Start Free Scan',
    highlighted: false,
    product: undefined,
  },
  {
    name: 'Alpha Brief Plus',
    badge: 'Best Value',
    price: '$34.95',
    perUnit: '$11.65/scan',
    desc: '3 scans. Your site + 2 competitors.',
    features: [
      { text: '3 full forensic scans', included: true },
      { text: 'All 45 modules per scan', included: true },
      { text: 'Executive Brief + PRD', included: true },
      { text: 'PDF export + shareable link', included: true },
      { text: '200 GhostChat™ credits', included: true },
      { text: 'Deploy AI agents', included: true },
      { text: 'Priority scan queue', included: true },
    ],
    cta: 'Unlock Everything',
    highlighted: true,
    product: 'alpha_brief_plus',
  },
  {
    name: 'Alpha Brief',
    price: '$24.99',
    originalPrice: '$49.99',
    desc: '1 full forensic scan.',
    features: [
      { text: '1 full forensic scan', included: true },
      { text: 'All 45 modules', included: true },
      { text: 'Executive Brief + PRD', included: true },
      { text: 'PDF export + shareable link', included: true },
      { text: '25 GhostChat™ credits', included: true },
      { text: 'AI agents', included: false },
      { text: 'Priority queue', included: false },
    ],
    cta: 'Get Full Report',
    highlighted: false,
    product: 'alpha_brief',
  },
];

export const FAQ = [
  {
    q: 'What do I get with the free scan?',
    a: 'A MarTech infrastructure analysis across 3 modules: CMS detection, MarTech orchestration, and ecommerce/SaaS detection. Full results, no redaction.',
  },
  {
    q: 'What happens when I upgrade?',
    a: 'We run the full 45-module forensic scan across all 5 phases — passive, browser, GhostScan, external intelligence, and AI synthesis. Takes about 7–10 minutes — we go deep.',
  },
  {
    q: 'Why scan competitors?',
    a: 'Alpha Brief Plus gives you 3 scans — your site plus your top 2 competitors. See exactly what they\'re running, where they\'re ahead, and what you can take from their playbook.',
  },
  {
    q: 'Need more chat credits?',
    a: 'You can top up anytime — $1 for 15 credits or $4.99 for 100 credits. Available from the chat window after purchase.',
  },
];

export function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bevel-sunken overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-gs-3 py-gs-2 cursor-pointer hover:bg-gs-red/5 transition-colors"
      >
        <span className="font-data text-data-xs font-bold text-left">{q}</span>
        <span className="font-data text-data-xs text-gs-mid flex-shrink-0 ml-gs-2 transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
      </button>
      {open && (
        <div className="border-t border-gs-mid/15 px-gs-3 py-gs-3">
          <p className="font-data text-data-xs text-gs-muted leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export const PRICING_GLOW_STYLE = `
  @keyframes pricing-glow {
    0%, 100% { box-shadow: 0 0 12px oklch(0.75 0.2 340 / 0.15), inset 0 1px 0 oklch(0.75 0.2 340 / 0.1); }
    50% { box-shadow: 0 0 24px oklch(0.75 0.2 340 / 0.25), inset 0 1px 0 oklch(0.75 0.2 340 / 0.15); }
  }
  .pricing-highlight { animation: pricing-glow 3s ease-in-out infinite; }
`;
