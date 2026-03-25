import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Pricing Cards (Retro Software Editions)
 * ═══════════════════════════════════════════════════════════
 *
 * 3-tier pricing: Free, Alpha Brief, Alpha Brief Plus.
 * Chat credits sold separately as add-ons (not in main grid).
 */

const tiers = [
  {
    name: 'Free Preview',
    edition: 'Standard Edition',
    price: 'Free',
    originalPrice: null,
    description: 'Instant GhostScan™ preview.',
    cta: 'Try the Preview',
    ctaHref: '/register',
    features: [
      'Instant GhostScan™ preview',
      'See what Chloé finds',
      'Create your account to continue',
    ],
    highlighted: false,
  },
  {
    name: 'Alpha Brief',
    edition: 'Professional Edition',
    price: '$24.99',
    originalPrice: null,
    description: 'Full 45-module forensic scan + AI executive brief.',
    cta: 'Get Alpha Brief',
    ctaHref: '/register',
    features: [
      '1 full forensic scan (45 modules)',
      'Executive Brief + PRD + Boss Deck',
      'Stack Analyzer',
      'PDF export + .MD for NotebookLM',
      '25 GhostChat™ credits',
    ],
    highlighted: true,
  },
  {
    name: 'Alpha Brief Plus',
    edition: 'Enterprise Edition',
    price: '$34.95',
    originalPrice: null,
    description: 'Everything + agents + deep analysis.',
    cta: 'Get Alpha Brief Plus',
    ctaHref: '/register',
    features: [
      '3 full forensic scans (45 modules)',
      'Everything in Alpha Brief',
      '200 GhostChat™ credits',
      'Deploy AI agents on your data',
      'Priority scan queue',
    ],
    highlighted: false,
  },
];

export function PricingCards() {
  return (
    <div className="space-y-gs-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gs-6 max-w-4xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              'relative bevel-raised bg-gs-chrome p-gs-6 flex flex-col',
              tier.highlighted && 'shadow-ghost-glow border-2 border-gs-red',
            )}
          >
            {/* Edition label */}
            <div className="bevel-sunken bg-gs-paper px-gs-3 py-gs-1 mb-gs-4 inline-block self-start">
              <span className="font-system text-os-xs text-gs-muted">
                {tier.edition}
              </span>
            </div>

            {tier.highlighted && (
              <div className="absolute -top-[12px] right-gs-4 bevel-button-primary text-os-xs px-gs-3 py-gs-1">
                Most Popular
              </div>
            )}

            <h3 className="font-system text-os-lg font-bold text-gs-ink">
              {tier.name}
            </h3>
            <p className="font-data text-data-sm text-gs-muted mt-gs-1">
              {tier.description}
            </p>

            {/* Price */}
            <div className="mt-gs-6 mb-gs-6">
              {tier.originalPrice && (
                <span className="font-data text-data-sm text-gs-muted line-through mr-gs-2">
                  {tier.originalPrice}
                </span>
              )}
              <span className="font-data text-data-hero text-gs-ink">
                {tier.price}
              </span>
              {tier.price !== 'Free' && (
                <span className="font-data text-data-xs text-gs-muted ml-gs-2">one-time</span>
              )}
            </div>

            {/* Feature checklist */}
            <ul className="space-y-gs-2 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-gs-2 font-data text-data-sm">
                  <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
                  <span className="text-gs-muted">{feature}</span>
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
    </div>
  );
}
