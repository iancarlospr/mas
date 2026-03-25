import { PricingCards } from '@/components/marketing/pricing-cards';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { faqJsonLd } from '@/lib/json-ld';
import type { Metadata } from 'next';

export const revalidate = 86400;

/**
 * GhostScan OS — Pricing Page
 * ═══════════════════════════════
 *
 * WHAT: Pricing tiers as retro software "editions" (Standard vs Pro box art).
 * WHY:  Old pricing was generic SaaS cards. Now matches GhostScan OS brand
 *       (Plan Section 14). Chloé anchors the page personality.
 * HOW:  Dark hero with Chloé, bevel-raised content area, retro copy.
 */

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free GhostScan™ preview. Full forensic intelligence from $24.99.',
};

const faqs = [
  {
    q: 'What does the free preview include?',
    a: 'An instant GhostScan™ preview that shows you what our engine can see. To run a full forensic scan, upgrade to Alpha Brief. No subscription required.',
  },
  {
    q: 'What does the Alpha Brief unlock?',
    a: 'The full 45-module forensic scan, Executive Brief, PRD, Boss Deck, stack analyzer, PDF export, .MD for NotebookLM, and 25 GhostChat™ credits. One-time $24.99. No subscription.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Chat credits persist across sessions and work on any of your scans.',
  },
  {
    q: 'Can I scan competitors?',
    a: "Yes. Any public URL. Chloé doesn't discriminate.",
  },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            faqJsonLd(faqs.map((f) => ({ question: f.q, answer: f.a }))),
          ),
        }}
      />
      {/* Hero */}
      <section className="relative bg-gs-ink py-gs-16">
        <div className="noise-grain" aria-hidden="true" />
        <div className="crt-scanlines" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-gs-4 text-center">
          <ChloeSprite state="smug" size={64} glowing className="mx-auto mb-gs-6" />
          <h1 className="font-system text-[clamp(24px,4vw,44px)] font-bold text-gs-paper mb-gs-3">
            Choose Your Edition
          </h1>
          <p className="font-data text-data-lg text-gs-muted max-w-xl mx-auto">
            The free preview shows you the signal. The paid upgrade gives you
            the receipts.
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-gs-paper to-transparent" />
      </section>

      {/* Pricing Cards */}
      <section className="bg-gs-paper py-gs-16">
        <div className="mx-auto max-w-7xl px-gs-4">
          <PricingCards />
        </div>
      </section>

      {/* FAQ / Details */}
      <section className="bg-gs-chrome py-gs-16">
        <div className="mx-auto max-w-3xl px-gs-4">
          <div className="bevel-raised bg-gs-paper p-gs-8">
            <h2 className="font-system text-os-lg font-bold text-gs-ink mb-gs-6 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-gs-6">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-system text-os-base font-bold text-gs-ink mb-gs-1">
                    {faq.q}
                  </h3>
                  <p className="font-data text-data-sm text-gs-muted leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
