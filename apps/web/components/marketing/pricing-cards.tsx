import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Pricing Cards (Retro Software Editions)
 * ═══════════════════════════════════════════════════════════
 *
 * WHAT: Pricing tiers rendered as retro software edition boxes.
 * WHY:  Old cards were generic SaaS. Now they match the GhostScan OS
 *       brand — bevel borders, system font, pixel art vibes.
 *       Think "Standard Edition" vs "Pro Edition" physical box art
 *       (Plan Section 14).
 * HOW:  Bevel-raised cards, JetBrains Mono prices, retro checkbox
 *       checklist. All content/pricing data preserved.
 */

const tiers = [
  {
    name: 'Free Scan',
    edition: 'Standard Edition',
    price: 'Free',
    originalPrice: null,
    description: 'Complete marketing audit — 42 forensic modules.',
    cta: 'Register Free',
    ctaHref: '/register',
    features: [
      'All 42 scan modules',
      'GhostScan™ active probing',
      'Dashboard with all findings',
      'Per-module AI insights',
      'PPC landing page audit',
      'DataForSEO market intelligence',
    ],
    highlighted: true,
  },
  {
    name: 'Alpha Brief™',
    edition: 'Professional Edition',
    price: '$9.99',
    originalPrice: '$29.99',
    description: 'Executive intelligence dossier. The full receipts.',
    cta: 'Declassify',
    ctaHref: '/register',
    features: [
      'Everything in Standard',
      'Alpha Brief™ executive report',
      'Remediation PRD with timeline',
      'ROI simulator & cost cutter',
      '15 Chloé chat questions',
      'Shareable report link',
    ],
    highlighted: false,
  },
];

const addOn = {
  name: 'Chat Credits',
  price: '$4.99',
  description: '100 additional questions for Chloé. She knows more than she lets on.',
};

export function PricingCards() {
  return (
    <div className="space-y-gs-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gs-6 max-w-3xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              'relative bevel-raised bg-gs-light p-gs-6 flex flex-col',
              tier.highlighted && 'shadow-ghost-glow',
            )}
          >
            {/* Edition label */}
            <div className="bevel-sunken bg-gs-near-white px-gs-3 py-gs-1 mb-gs-4 inline-block self-start">
              <span className="font-system text-os-xs text-gs-mid-dark">
                {tier.edition}
              </span>
            </div>

            {tier.highlighted && (
              <div className="absolute -top-[12px] right-gs-4 bevel-button-primary text-os-xs px-gs-3 py-gs-1">
                Most Popular
              </div>
            )}

            <h3 className="font-system text-os-lg font-bold text-gs-black">
              {tier.name}
            </h3>
            <p className="font-data text-data-sm text-gs-mid mt-gs-1">
              {tier.description}
            </p>

            {/* Price */}
            <div className="mt-gs-6 mb-gs-6">
              {tier.originalPrice && (
                <span className="font-data text-data-sm text-gs-mid-light line-through mr-gs-2">
                  {tier.originalPrice}
                </span>
              )}
              <span className="font-data text-data-hero text-gs-black">
                {tier.price}
              </span>
              {tier.price !== 'Free' && (
                <span className="font-data text-data-xs text-gs-mid ml-gs-2">one-time</span>
              )}
            </div>

            {/* Feature checklist */}
            <ul className="space-y-gs-2 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-gs-2 font-data text-data-sm">
                  <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
                  <span className="text-gs-mid-dark">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href={tier.ctaHref}
              className={cn(
                'mt-gs-6 text-center',
                tier.highlighted
                  ? 'bevel-button-primary text-os-base w-full'
                  : 'bevel-button text-os-base w-full',
              )}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Chat Credits add-on */}
      <div className="max-w-md mx-auto bevel-raised bg-gs-light p-gs-6 text-center">
        <span className="font-system text-os-xs text-gs-mid uppercase tracking-wider">
          Add-on
        </span>
        <h3 className="font-system text-os-lg font-bold text-gs-black mt-gs-1">
          {addOn.name}
        </h3>
        <p className="font-data text-data-sm text-gs-mid mt-gs-1 mb-gs-3">
          {addOn.description}
        </p>
        <span className="font-data text-data-2xl font-bold text-gs-black">
          {addOn.price}
        </span>
        <span className="font-data text-data-xs text-gs-mid ml-gs-2">one-time</span>
      </div>
    </div>
  );
}
