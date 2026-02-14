import { ScanInput } from '@/components/scan/scan-input';
import { HeroScanFlow } from '@/components/scan/hero-scan-flow';
import { PricingCards } from '@/components/marketing/pricing-cards';

const features = [
  {
    title: '45 Forensic Modules',
    description:
      'DNS security, analytics architecture, ad pixel tracking, tag governance, consent compliance, and more.',
    icon: '🔬',
  },
  {
    title: 'GhostScan Technology',
    description:
      'Active browser probing detects A/B tests, session recordings, behavioral triggers, and hidden experiments.',
    icon: '👻',
  },
  {
    title: 'AI-Powered Synthesis',
    description:
      'Google Gemini analyzes every finding, produces executive insights, and generates a remediation PRD.',
    icon: '🧠',
  },
  {
    title: 'MarketingIQ Score',
    description:
      'A single 0-100 score measuring marketing technology effectiveness across 8 weighted categories.',
    icon: '📊',
  },
  {
    title: 'McKinsey-Style Report',
    description:
      'A downloadable PDF report with data-dense charts, compliance audits, and a prioritized remediation roadmap.',
    icon: '📄',
  },
  {
    title: 'AI Chat Assistant',
    description:
      'Ask any question about the scan results. Get specific, evidence-backed answers with module citations.',
    icon: '💬',
  },
];

const steps = [
  { step: '1', title: 'Enter a URL', description: 'Paste any website URL to begin.' },
  { step: '2', title: 'We Scan', description: '45 modules analyze every layer of the marketing stack.' },
  { step: '3', title: 'Get Insights', description: 'Receive your MarketingIQ score and full dashboard.' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h1 className="font-heading text-h1 text-white max-w-4xl mx-auto">
              Reverse-Engineer Any Brand&apos;s Marketing Stack in Minutes
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
              Forensic marketing intelligence that scans any URL to uncover the
              complete technology stack, tracking setup, compliance gaps, and
              performance issues.
            </p>
            <div className="mt-10 flex justify-center">
              <HeroScanFlow />
            </div>
            <p className="mt-4 text-sm text-white/40">
              No credit card required.
            </p>
          </div>
        </div>
        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Social proof */}
      <section className="py-8 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted">
            <span>10,000+ URLs scanned</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>45 forensic modules</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>AI-powered analysis</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-h2 text-primary">
              Everything Under the Stack
            </h2>
            <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
              The most comprehensive marketing technology audit available.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface border border-border rounded-xl p-8 shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="font-heading text-h4 text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-surface border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-h2 text-primary">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent text-white font-heading text-h3 mb-6">
                  {step.step}
                </div>
                <h3 className="font-heading text-h4 text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-heading text-h2 text-primary">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">
              Start free. Upgrade when you see the value.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* Final CTA */}
      <section className="hero-gradient py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading text-h2 text-white mb-4">
            Ready to See What&apos;s Under the Stack?
          </h2>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-10">
            Enter any URL to get started with your free marketing technology audit.
          </p>
          <div className="flex justify-center">
            <ScanInput size="large" />
          </div>
        </div>
      </section>
    </>
  );
}
