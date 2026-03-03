'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWindowManager } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';

/* ═══════════════════════════════════════════════════════════════
   Pricing — CRO-Optimized Window

   Center bias: Plus in the middle (highlighted, taller).
   Price anchoring: crossed-out original price.
   Per-unit economics: $/scan on Plus.
   Loss aversion: features list shows what free is MISSING.
   Social proof: live scan counter.
   ═══════════════════════════════════════════════════════════════ */

interface Feature {
  text: string;
  included: boolean;
}

interface Tier {
  name: string;
  badge?: string;
  price: string;
  originalPrice?: string;
  perUnit?: string;
  desc: string;
  features: Feature[];
  cta: string;
  highlighted: boolean;
  /** Stripe checkout product ID — undefined = free tier (opens scan-input) */
  product?: 'alpha_brief' | 'alpha_brief_plus';
}

const TIERS: Tier[] = [
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

const FAQ = [
  {
    q: 'What do I get with the free scan?',
    a: 'A MarTech infrastructure analysis across 3 modules: CMS detection, MarTech orchestration, and ecommerce/SaaS detection. Full results, no redaction.',
  },
  {
    q: 'What happens when I upgrade?',
    a: 'We run the full 45-module forensic scan across all 5 phases — passive, browser, GhostScan, external intelligence, and AI synthesis. Takes about 90 seconds.',
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

function FaqItem({ q, a }: { q: string; a: string }) {
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

export default function PricingWindow() {
  const wm = useWindowManager();
  const { isAuthenticated } = useAuth();
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => {
        setScanCount((count ?? 0) + 101);
      });
  }, []);

  const handleTierClick = useCallback(async (tier: Tier) => {
    // Free tier — just open scan-input
    if (!tier.product) {
      wm.closeWindow('pricing');
      wm.openWindow('scan-input');
      return;
    }

    // Paid tiers — require auth
    if (!isAuthenticated) {
      wm.openWindow('auth');
      return;
    }

    // Checkout for scan credits (no scanId needed)
    setLoadingProduct(tier.product);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: tier.product }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Checkout failed.');
        setLoadingProduct(null);
        return;
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('Network error. Try again.');
      setLoadingProduct(null);
    }
  }, [wm, isAuthenticated]);

  return (
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-6">
      <style>{`
        @keyframes pricing-glow {
          0%, 100% { box-shadow: 0 0 12px oklch(0.75 0.2 340 / 0.15), inset 0 1px 0 oklch(0.75 0.2 340 / 0.1); }
          50% { box-shadow: 0 0 24px oklch(0.75 0.2 340 / 0.25), inset 0 1px 0 oklch(0.75 0.2 340 / 0.15); }
        }
        .pricing-highlight { animation: pricing-glow 3s ease-in-out infinite; }
      `}</style>

      {/* Header + social proof */}
      <div className="text-center space-y-gs-2">
        <h1 className="font-display text-display-sm">Choose Your Edition</h1>
        <p className="font-data text-data-xs text-gs-muted">
          No subscriptions. No hidden fees. One-time per scan.
        </p>
        {scanCount != null && (
          <p className="font-data text-[10px] text-gs-mid">
            Join {scanCount.toLocaleString()}+ marketers who already scanned
          </p>
        )}
      </div>

      {/* Pricing Tiers — center bias layout */}
      <div className="grid grid-cols-3 gap-gs-3 items-start">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative bevel-raised space-y-gs-3 ${
              tier.highlighted
                ? 'bg-gs-red/5 border-2 border-gs-red p-gs-4 pricing-highlight'
                : 'bg-gs-chrome p-gs-3'
            }`}
          >
            {/* Badge */}
            {tier.badge && (
              <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 bg-gs-red text-gs-void font-system text-[9px] font-bold uppercase tracking-wider px-gs-2 py-[2px] rounded-sm whitespace-nowrap">
                {tier.badge}
              </div>
            )}

            {/* Name + Price */}
            <div className={tier.badge ? 'pt-gs-1' : ''}>
              <h3 className="font-system text-os-sm font-bold">{tier.name}</h3>
              <div className="flex items-baseline gap-gs-1 mt-gs-1">
                {tier.originalPrice && (
                  <span className="font-data text-data-sm text-gs-mid line-through">
                    {tier.originalPrice}
                  </span>
                )}
                <span className={`font-data font-bold ${tier.highlighted ? 'text-[24px]' : 'text-data-2xl'}`}>
                  {tier.price}
                </span>
              </div>
              {tier.perUnit && (
                <span className="font-data text-[10px] text-gs-red font-bold">
                  {tier.perUnit}
                </span>
              )}
              <p className="font-data text-data-xs text-gs-muted mt-gs-1">{tier.desc}</p>
            </div>

            {/* Feature checklist — included vs excluded */}
            <ul className="space-y-[5px]">
              {tier.features.map((f) => (
                <li key={f.text} className="flex items-start gap-gs-1 text-[11px]">
                  {f.included ? (
                    <>
                      <span className="text-gs-terminal flex-shrink-0 font-bold">+</span>
                      <span className="text-gs-light/85">{f.text}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gs-mid/30 flex-shrink-0">—</span>
                      <span className="text-gs-mid/30 line-through">{f.text}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => handleTierClick(tier)}
              disabled={loadingProduct === tier.product}
              className={`${tier.highlighted ? 'bevel-button-primary' : 'bevel-button'} w-full py-gs-1 font-system text-os-xs font-bold`}
            >
              {loadingProduct === tier.product ? 'Processing...' : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="font-data text-data-xs text-gs-critical text-center">{error}</p>
      )}

      {/* FAQ */}
      <div className="space-y-gs-2">
        <h2 className="font-system text-os-sm font-bold">FAQ</h2>
        {FAQ.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}
