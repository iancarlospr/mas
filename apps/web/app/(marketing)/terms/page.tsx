import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — MarketingAlphaScan',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading font-800 text-3xl text-[#1A1A2E]">Terms of Service</h1>
      <p className="mt-2 text-sm text-[#94A3B8]">Last updated: February 10, 2026</p>

      <div className="mt-8 space-y-6 text-[#334155] leading-relaxed">
        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">1. Service Description</h2>
          <p className="mt-2">
            MarketingAlphaScan (&quot;the Service&quot;) is a forensic marketing intelligence
            platform that scans websites to audit their marketing technology stack,
            performance, compliance, and competitive positioning. Scans are automated
            and results may be cached for up to 24 hours.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">2. Acceptable Use</h2>
          <p className="mt-2">
            You may only scan websites you own or have authorization to audit. You
            agree not to use the Service to scan websites for malicious purposes,
            competitive intelligence gathering without authorization, or any unlawful
            activity. We reserve the right to suspend accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">3. Accounts</h2>
          <p className="mt-2">
            You may create an account using email verification or magic link
            authentication. You are responsible for maintaining the security of your
            account credentials. Anonymous (peek) scans are available without an
            account but are limited in scope.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">4. Payments & Pricing</h2>
          <p className="mt-2">
            The following paid products are available:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Alpha Brief</strong> — $9.99 one-time per scan. Includes full
              report, PDF download, and 50 AI chat credits.</li>
            <li><strong>Chat Credits</strong> — $4.99 for 100 additional AI chat
              credits.</li>
          </ul>
          <p className="mt-2">
            All payments are processed securely via Stripe. Prices are in USD.
            All sales are final — no refunds are offered due to the automated nature
            of the service.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">5. Data & Results</h2>
          <p className="mt-2">
            Scan results are generated algorithmically and enhanced by AI. While we
            strive for accuracy, results are provided &quot;as is&quot; without
            warranty. The MarketingIQ score and recommendations should be considered
            informational, not definitive assessments.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">6. Account Deletion</h2>
          <p className="mt-2">
            You may delete your account at any time from the dashboard settings.
            Account deletion removes your personal data, scan history, and chat
            messages. This action is irreversible.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">7. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, MarketingAlphaScan shall not be
            liable for any indirect, incidental, special, consequential, or punitive
            damages resulting from your use of or inability to use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">8. Changes to Terms</h2>
          <p className="mt-2">
            We reserve the right to modify these terms at any time. Continued use of
            the Service after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-heading font-700 text-xl text-[#1A1A2E]">9. Contact</h2>
          <p className="mt-2">
            For questions about these terms, contact us at{' '}
            <a href="mailto:support@marketingalphascan.com" className="text-[#0F3460] underline">
              support@marketingalphascan.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
