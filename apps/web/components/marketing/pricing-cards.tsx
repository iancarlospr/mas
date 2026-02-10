import Link from 'next/link';
import { cn } from '@/lib/utils';

const tiers = [
  {
    name: 'Peek',
    price: 'Free',
    originalPrice: null,
    description: 'Quick snapshot of any URL',
    cta: 'Start Scanning',
    ctaHref: '/#hero',
    features: [
      '6 passive scan modules',
      'DNS & security baseline',
      'CMS & infrastructure detection',
      'Page metadata analysis',
      'MarketingIQ teaser',
      'No registration required',
    ],
    highlighted: false,
  },
  {
    name: 'Full Scan',
    price: 'Free',
    originalPrice: null,
    description: 'Complete marketing audit',
    cta: 'Register Free',
    ctaHref: '/register',
    features: [
      'All 40+ scan modules',
      'GhostScan active probing',
      'Bento dashboard with all results',
      'Per-module AI insights',
      'PPC landing page audit',
      'DataForSEO market intelligence',
    ],
    highlighted: true,
  },
  {
    name: 'Alpha Brief',
    price: '$9.99',
    originalPrice: '$29.99',
    description: 'Executive intelligence report',
    cta: 'Unlock Report',
    ctaHref: '/register',
    features: [
      'Everything in Full Scan',
      'McKinsey-style PDF report',
      'Remediation PRD with timeline',
      'ROI simulator & cost cutter',
      '50 AI Chat messages',
      'Shareable report link',
    ],
    highlighted: false,
  },
];

const addOn = {
  name: 'Chat Credits',
  price: '$4.99',
  description: '100 additional AI Chat messages to dive deeper into any scan.',
};

export function PricingCards() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              'relative bg-surface border rounded-xl p-8 flex flex-col',
              tier.highlighted
                ? 'border-highlight shadow-xl scale-105 z-10'
                : 'border-border shadow-sm',
            )}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-highlight text-highlight-foreground text-xs font-heading font-700 px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}

            <h3 className="font-heading text-h4 text-primary">{tier.name}</h3>
            <p className="text-sm text-muted mt-1">{tier.description}</p>

            <div className="mt-6 mb-6">
              {tier.originalPrice && (
                <span className="text-sm text-muted line-through mr-2">
                  {tier.originalPrice}
                </span>
              )}
              <span className="font-heading text-h2 text-primary">
                {tier.price}
              </span>
              {tier.price !== 'Free' && (
                <span className="text-sm text-muted ml-1">one-time</span>
              )}
            </div>

            <ul className="space-y-3 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-success mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={cn(
                'mt-8 inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-heading font-700 transition-colors',
                tier.highlighted
                  ? 'bg-highlight text-highlight-foreground hover:bg-highlight/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Chat Credits add-on */}
      <div className="max-w-md mx-auto bg-surface border border-border rounded-xl p-6 text-center shadow-sm">
        <p className="text-xs font-heading font-700 uppercase tracking-wider text-muted mb-2">
          Add-on
        </p>
        <h3 className="font-heading text-h4 text-primary">{addOn.name}</h3>
        <p className="text-sm text-muted mt-1 mb-4">{addOn.description}</p>
        <span className="font-heading text-h3 text-primary">{addOn.price}</span>
        <span className="text-sm text-muted ml-1">one-time</span>
      </div>
    </div>
  );
}
