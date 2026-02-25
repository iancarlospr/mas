import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — MarketingAlphaScan',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-gs-4 py-gs-12">
      <h1 className="font-system text-[clamp(24px,3vw,36px)] font-bold text-gs-ink">Privacy Policy</h1>
      <p className="mt-gs-2 font-data text-data-sm text-gs-muted">Last updated: February 10, 2026</p>

      <div className="mt-gs-8 space-y-gs-6 font-data text-data-sm text-gs-muted leading-relaxed">
        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">1. Data We Collect</h2>
          <p className="mt-2">We collect the following information:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> Email address (required for signup).</li>
            <li><strong>Scan data:</strong> URLs you submit for scanning, scan results,
              and AI chat messages.</li>
            <li><strong>Technical data:</strong> IP address, country code (derived from
              IP), browser type, and device information.</li>
            <li><strong>Payment data:</strong> Processed by Stripe. We do not store card
              numbers or banking details.</li>
            <li><strong>Analytics data:</strong> Page views, feature usage, and session
              data collected via PostHog.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">2. How We Use Your Data</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>To provide and improve the scanning and reporting service.</li>
            <li>To process payments and send transactional emails (receipts, scan
              notifications).</li>
            <li>To detect and prevent abuse (rate limiting, bot detection).</li>
            <li>To analyze usage patterns and improve the product.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">3. Third-Party Processors</h2>
          <p className="mt-2">We share data with the following service providers:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Supabase</strong> — Database hosting and authentication.</li>
            <li><strong>Stripe</strong> — Payment processing.</li>
            <li><strong>Resend</strong> — Transactional email delivery.</li>
            <li><strong>PostHog</strong> — Product analytics.</li>
            <li><strong>Google Gemini</strong> — AI-powered chat responses (scan data
              sent as context).</li>
            <li><strong>DataForSEO</strong> — Traffic and keyword intelligence.</li>
            <li><strong>Cloudflare</strong> — Bot detection (Turnstile) and CDN.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">4. Cookies</h2>
          <p className="mt-2">
            We use essential cookies for authentication (Supabase session) and
            analytics cookies (PostHog). No advertising or third-party tracking
            cookies are used.
          </p>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">5. Email Communications</h2>
          <p className="mt-2">
            We send transactional emails (verification, scan notifications, receipts)
            that are required for the service. You may unsubscribe from non-essential
            emails using the unsubscribe link in each email.
          </p>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">6. Data Retention</h2>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Scan data:</strong> Stored indefinitely (or until account deletion).</li>
            <li><strong>Email logs:</strong> Retained for 90 days.</li>
            <li><strong>Audit logs:</strong> Retained indefinitely for security purposes.</li>
            <li><strong>Analytics data:</strong> Retained per PostHog&apos;s data retention policy.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">7. Your Rights (GDPR/CCPA)</h2>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li><strong>Access</strong> your personal data.</li>
            <li><strong>Delete</strong> your account and associated data (available in
              dashboard settings).</li>
            <li><strong>Export</strong> your scan data.</li>
            <li><strong>Opt out</strong> of analytics tracking.</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{' '}
            <a href="mailto:privacy@marketingalphascan.com" className="text-gs-red hover:underline">
              privacy@marketingalphascan.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">8. Geographic Restrictions</h2>
          <p className="mt-2">
            The Service is not available in certain countries due to regulatory and
            compliance requirements. Access from restricted regions is blocked at the
            application level.
          </p>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">9. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this privacy policy from time to time. We will notify
            registered users of significant changes via email.
          </p>
        </section>

        <section>
          <h2 className="font-system text-os-base font-bold text-gs-ink">10. Contact</h2>
          <p className="mt-2">
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:privacy@marketingalphascan.com" className="text-gs-red hover:underline">
              privacy@marketingalphascan.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
