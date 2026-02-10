import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-h1 text-primary mb-8">About MarketingAlphaScan</h1>
        <div className="prose prose-lg max-w-none">
          <p className="text-muted leading-relaxed">
            MarketingAlphaScan is a forensic marketing intelligence platform that analyzes
            any URL to reverse-engineer a brand&apos;s complete marketing technology stack,
            strategy, and performance.
          </p>
          <p className="text-muted leading-relaxed">
            With 45 forensic modules spanning DNS security, analytics architecture, ad pixel
            tracking, tag governance, consent compliance, and AI-powered synthesis, we provide
            the most comprehensive marketing technology audit available.
          </p>
          <h2 className="font-heading text-h3 text-primary mt-12 mb-4">Our Method</h2>
          <p className="text-muted leading-relaxed">
            The AlphaScan Method combines passive infrastructure analysis, active browser
            probing (GhostScan), external market intelligence via DataForSEO, and AI synthesis
            powered by Google Gemini to produce a MarketingIQ score and executive-grade report.
          </p>
          <h2 className="font-heading text-h3 text-primary mt-12 mb-4">For Who?</h2>
          <p className="text-muted leading-relaxed">
            Marketing leaders, agencies, consultants, and anyone who wants to understand
            what&apos;s really happening under the hood of any website&apos;s marketing stack.
          </p>
        </div>
      </div>
    </section>
  );
}
