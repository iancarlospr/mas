'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { TIERS, FAQ, FaqItem, PRICING_GLOW_STYLE } from '@/lib/pricing-data';
import type { Tier } from '@/lib/pricing-data';

/* ═══════════════════════════════════════════════════════════════
   Mobile Pricing Section — Single-column layout

   No useWindowManager() dependency. Uses callbacks for
   free-tier CTA and router.push for auth gating.
   ═══════════════════════════════════════════════════════════════ */

interface MobilePricingSectionProps {
  onFreeScan: () => void;
}

export function MobilePricingSection({ onFreeScan }: MobilePricingSectionProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTierClick = useCallback(async (tier: Tier) => {
    if (!tier.product) {
      onFreeScan();
      return;
    }

    if (!isAuthenticated) {
      router.push('/register');
      return;
    }

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
  }, [isAuthenticated, onFreeScan, router]);

  return (
    <div className="space-y-gs-6">
      <style>{PRICING_GLOW_STYLE}</style>

      {/* Header */}
      <div className="text-center space-y-gs-2">
        <h2 className="font-display text-display-sm">Choose Your Edition</h2>
        <p className="font-data text-data-xs text-gs-muted">
          No subscriptions. No hidden fees. One-time per scan.
        </p>
      </div>

      {/* Tiers — single column */}
      <div className="space-y-gs-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative bevel-raised space-y-gs-3 ${
              tier.highlighted
                ? 'bg-gs-red/5 border-2 border-gs-red p-gs-4 pricing-highlight'
                : 'bg-gs-chrome p-gs-3'
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 bg-gs-red text-gs-void font-system text-[9px] font-bold uppercase tracking-wider px-gs-2 py-[2px] rounded-sm whitespace-nowrap">
                {tier.badge}
              </div>
            )}

            <div className={`flex items-start justify-between ${tier.badge ? 'pt-gs-1' : ''}`}>
              <div>
                <h3 className="font-system text-os-sm font-bold">{tier.name}</h3>
                <p className="font-data text-data-xs text-gs-muted mt-gs-1">{tier.desc}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-gs-3">
                <div className="flex items-baseline gap-gs-1">
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
              </div>
            </div>

            <ul className="space-y-[5px]">
              {tier.features.map((f) => (
                <li key={f.text} className="flex items-start gap-gs-1 text-[12px]">
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

            <button
              onClick={() => handleTierClick(tier)}
              disabled={loadingProduct === tier.product}
              className={`${tier.highlighted ? 'bevel-button-primary' : 'bevel-button'} w-full py-gs-2 font-system text-os-sm font-bold`}
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
        <h3 className="font-system text-os-sm font-bold">FAQ</h3>
        {FAQ.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}
