'use client';

import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Products — Paid Deliverables Showcase

   Pure benefit copy, zero prices. NLP persuasion patterns:
   embedded commands, presuppositions, future pacing,
   loss aversion, sensory language, pattern interrupts.
   ═══════════════════════════════════════════════════════════════ */

interface Product {
  name: string;
  tagline: string;
  bullets: ReactNode[];
}

const PRODUCTS: Product[] = [
  {
    name: 'The Alpha Brief',
    tagline: 'The audit that agencies pray you never see.',
    bullets: [
      'See your entire digital presence the way a top-tier consultant would — every signal, every data point, every opportunity mapped out and ready for you to act on.',
      'Your campaigns, your tracking, your infrastructure — scored across 45 dimensions. You\'ll immediately see which areas are already strong and which ones are one tweak away from performing at a completely different level.',
      'A prioritized action plan that tells you exactly what can be done and why — each recommendation ranked by how quickly you\'ll see results.',
      'The level of insight that puts you in a completely different conversation with agencies, freelancers, or your own team. You\'ll walk in knowing more about your site than the people before you.',
    ],
  },
  {
    name: 'The PRD (Product Requirements Document)',
    tagline: 'Hand this to your boss. Watch their face.',
    bullets: [
      'A polished, exportable document your leadership team will actually read. Step-by-step remediation that even non-technical stakeholders find themselves understanding immediately.',
      'Every recommendation backed by data — traffic impact, revenue projections, competitive gaps. The kind of evidence that gets things approved before the meeting ends.',
      'A step-by-step remediation plan you can follow yourself — or hand off to your dev team, freelancer, or agency. It works either way because every action is specific, prioritized, and self-contained.',
      'Pair it with GhostChat™ and let Chloé walk you through implementation, clarify technical steps, or adapt the plan to your specific workflow.',
    ],
  },
  {
    name: 'GhostChat™',
    tagline: 'Your $5k/month strategist. For the price of a coffee.',
    bullets: [
      'Ask anything about your scan — and get answers drawn from data that isn\'t even visible in the report. Chloé sees deeper than the dashboard shows you.',
      'Walk through implementation together. "How do I implement step 3?" or "Show me videos on setting up GA4 ecommerce tracking" — becomes a guided conversation where you naturally discover you already know more than you think.',
      'Context that remembers everything. Your full scan, every module, every finding — Chloé holds it all so you don\'t have to. You just ask.',
      <>The strategist your competitors are already paying $5,000 a month for. Except yours actually knows your specific data, responds instantly, and <span className="text-shimmer">never ghosts you</span>.</>,
    ],
  },
];

export default function ProductsWindow() {
  return (
    <>
      <style>{`
        @keyframes text-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .text-shimmer {
          background: linear-gradient(
            90deg,
            var(--gs-base) 0%,
            var(--gs-base) 35%,
            #fff 50%,
            var(--gs-base) 65%,
            var(--gs-base) 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-shimmer 4s ease-in-out infinite;
          font-weight: 700;
        }
      `}</style>
    <div className="px-gs-6 pt-gs-3 pb-gs-6 space-y-gs-6">
      {/* Header */}
      <div className="text-center space-y-gs-2">
        <h1 className="font-display text-display-sm">What You Get</h1>
        <p className="font-data italic text-data-base text-gs-red">
          this isn&apos;t a feature list. this is the cheat code.
        </p>
      </div>

      {/* Product sections */}
      {PRODUCTS.map((product, i) => (
        <div key={product.name} className="space-y-gs-3">
          <div className="space-y-gs-1">
            <div className="flex items-center gap-gs-2">
              <span className="font-data text-data-sm font-bold text-gs-mid">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className="font-system text-os-base font-bold text-gs-light">
                {product.name}
              </h2>
            </div>
            <p className="font-data italic text-data-sm text-gs-red pl-[28px]">
              {product.tagline}
            </p>
          </div>

          <div className="bevel-sunken p-gs-4 space-y-gs-3">
            {product.bullets.map((bullet, j) => (
              <div key={j} className="flex gap-gs-2">
                <span className="text-gs-red font-data text-data-sm flex-shrink-0">—</span>
                <p className="font-data text-data-sm text-gs-light/85 leading-relaxed">
                  {bullet}
                </p>
              </div>
            ))}
          </div>

          {/* Separator between products (not after last) */}
          {i < PRODUCTS.length - 1 && (
            <div className="border-b border-gs-mid/20 pt-gs-2" />
          )}
        </div>
      ))}

      {/* Closing urgency — no price, no CTA button, just heat */}
      <p className="text-center font-data text-data-xs text-gs-muted pb-gs-2">
        Every day you wait is another day your competitors have this and you don&apos;t.
      </p>
    </div>
    </>
  );
}
