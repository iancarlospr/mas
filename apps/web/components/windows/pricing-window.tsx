'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWindowManager } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';
import { TIERS, FAQ, FaqItem, PRICING_GLOW_STYLE } from '@/lib/pricing-data';
import type { Tier } from '@/lib/pricing-data';

/* ═══════════════════════════════════════════════════════════════
   Pricing — CRO-Optimized Window

   Center bias: Plus in the middle (highlighted, taller).
   Price anchoring: crossed-out original price.
   Per-unit economics: $/scan on Plus.
   Loss aversion: features list shows what free is MISSING.
   Social proof: live scan counter.
   ═══════════════════════════════════════════════════════════════ */

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
      <style>{PRICING_GLOW_STYLE}</style>

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
                      <span className="text-gs-mid/30 flex-shrink-0">·</span>
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
