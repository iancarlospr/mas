import { PricingCards } from '@/components/marketing/pricing-cards';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="font-heading text-h1 text-primary">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
            Start free. Upgrade when you see the value.
          </p>
        </div>
        <PricingCards />

        <div className="mt-16 text-center">
          <h2 className="font-heading text-h3 text-primary mb-4">
            Additional Credits
          </h2>
          <p className="text-muted text-sm max-w-lg mx-auto">
            Need more AI Chat messages? Purchase 100 additional credits for $4.99 (one-time).
            Credits never expire and work across all your scans.
          </p>
        </div>
      </div>
    </section>
  );
}
