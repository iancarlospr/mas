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
    tagline: 'Agencies charge $3k+ for this and take weeks. You get it in minutes.',
    bullets: [
      'Your entire digital presence scored across 45 dimensions. Every signal, every gap, every opportunity mapped and downloadable as a PDF.',
      'A prioritized action plan ranked by speed-to-impact. The kind of insight retainers bill quarterly for.',
    ],
  },
  {
    name: 'The PRD',
    tagline: 'The technical blueprint your dev team actually needs.',
    bullets: [
      'A structured breakdown of every fix from the audit, prioritized, scoped, and ready to hand off to your developers or freelancers.',
      'Each action is specific and self-contained. No interpretation needed, just implementation.',
    ],
  },
  {
    name: 'Boss Deck',
    tagline: 'Walk into that meeting and own the room.',
    bullets: [
      'Seven beautifully designed slides that translate your audit into wins, issues, and a roadmap your boss will love you for presenting.',
      'Dollar impact, team owners, projected improvements. All wrapped in a PDF that looks like a $20k agency deliverable.',
    ],
  },
  {
    name: 'GhostChat™',
    tagline: 'This AI absorbed your entire audit. Use that.',
    bullets: [
      'Every module, every data point, every finding. Chloé holds it all. Ask anything about your URL and sound like the most prepared person in any meeting.',
      <>The amount of data in here would break any document. That&apos;s why it&apos;s a conversation. And she <span className="text-shimmer">never ghosts you</span>.</>,
    ],
  },
  {
    name: '.MD for NotebookLM',
    tagline: 'One click. Google turns your audit into a podcast.',
    bullets: [
      'Copy your full audit as structured markdown, paste it into Google NotebookLM, and get an AI-generated audio briefing you can listen to on the go.',
      'Every module, every score, every recommendation, formatted for Google\'s AI to narrate. Brief your whole team without a single slide.',
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
                <span className="text-gs-red font-data text-data-sm flex-shrink-0">·</span>
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
