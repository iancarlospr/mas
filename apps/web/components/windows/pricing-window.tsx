'use client';

/* ═══════════════════════════════════════════════════════════════
   Pricing — Window Content

   Pricing tiers + FAQ. Clean, no-bullshit pricing page.
   ═══════════════════════════════════════════════════════════════ */

const TIERS = [
  {
    name: 'Free Scan',
    price: '$0',
    desc: 'Full 45-module scan. Preview results.',
    features: [
      '45 forensic modules',
      '5 execution phases',
      'MarketingIQ™ score',
      'Redacted results preview',
    ],
    cta: 'Scan Now',
    highlighted: false,
  },
  {
    name: 'Alpha Brief',
    price: '$9.99',
    desc: 'Full scan results + AI executive brief.',
    features: [
      'Everything in Free',
      'Full declassified results',
      'AI Executive Brief',
      'Roadmap & ROI analysis',
      'PDF export',
    ],
    cta: 'Unlock Results',
    highlighted: true,
  },
  {
    name: 'GhostChat',
    price: '$1.00',
    desc: 'Chat with Chloe about your results.',
    features: [
      'AI-powered Q&A',
      '15 chat credits',
      'Context-aware analysis',
      'Top-up: $4.99 / 100 credits',
    ],
    cta: 'Activate Chat',
    highlighted: false,
  },
];

const FAQ = [
  {
    q: 'What do I get with the free scan?',
    a: 'A full 45-module forensic analysis with MarketingIQ score. Results are partially redacted — upgrade to see everything.',
  },
  {
    q: 'How long does a scan take?',
    a: 'About 90 seconds for the full analysis, including browser forensics and external intelligence gathering.',
  },
  {
    q: 'Can I scan competitor sites?',
    a: 'Yes. AlphaScan works on any public URL. Scan competitors to see exactly what they\'re running.',
  },
  {
    q: 'Is my data stored?',
    a: 'Scan results are stored in your account. We never share or sell your data. Delete anytime.',
  },
];

export default function PricingWindow() {
  return (
    <div className="p-gs-6 space-y-gs-8">
      <div className="text-center space-y-gs-2">
        <h1 className="font-display text-display-sm">Choose Your Edition</h1>
        <p className="text-data-base text-gs-muted">No subscriptions. Pay per scan.</p>
      </div>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-3 gap-gs-4">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`bevel-raised p-gs-4 space-y-gs-3 ${
              tier.highlighted ? 'bg-gs-red/5 border-2 border-gs-red' : 'bg-gs-chrome'
            }`}
          >
            <div>
              <h3 className="font-system text-os-base font-bold">{tier.name}</h3>
              <div className="font-data text-data-2xl font-bold mt-gs-1">{tier.price}</div>
              <p className="font-data text-data-xs text-gs-muted mt-gs-1">{tier.desc}</p>
            </div>
            <ul className="space-y-gs-1 text-data-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-gs-2">
                  <span className="text-gs-red shrink-0">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={tier.highlighted ? 'bevel-button-primary w-full' : 'bevel-button w-full'}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="space-y-gs-4">
        <h2 className="font-system text-os-base font-bold">FAQ</h2>
        {FAQ.map((item) => (
          <div key={item.q} className="bevel-sunken p-gs-3 space-y-gs-1">
            <h3 className="font-data text-data-sm font-bold">{item.q}</h3>
            <p className="font-data text-data-sm text-gs-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
