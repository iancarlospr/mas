'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  CheckItem,
  Pill,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M20 Slide — Ecommerce & SaaS
 * ═════════════════════════════
 *
 * Layout D: SlideShell with CheckItem grid visualization.
 * Viz: "Commerce Capabilities" 2x4 grid:
 *   Platform detection, Checkout system, Pricing page, Trial/demo
 *   Auth providers, Payment processors, Form security, Cart detection
 */

export function M20Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M20');
  const mod = getModuleResult(scan, 'M20');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Ecommerce & SaaS" scan={scan} sourceLabel="Source: Cart detection, payment processors, auth providers, pricing pages" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Commerce capabilities assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const ecommerce = (raw?.['ecommerce'] as Record<string, unknown> | undefined) ?? {};
  const platform = typeof ecommerce?.['platform'] === 'string' ? ecommerce['platform'] as string : null;
  const checkout = typeof ecommerce?.['checkout'] === 'string' ? ecommerce['checkout'] as string : (ecommerce?.['checkout'] ? 'Detected' : null);
  const pricingPage = ecommerce?.['pricingPage'];
  const trialPage = ecommerce?.['trialPage'];
  const authProviders = (raw?.['authProviders'] as string[] | undefined) ?? [];
  const paymentProviders = (raw?.['paymentProviders'] as string[] | undefined) ?? [];
  const formSecurity = (raw?.['formSecurity'] as Record<string, unknown> | undefined) ?? null;
  const cartDetected = raw?.['cartDetected'] === true;
  const productPages = raw?.['productPages'];

  // Form security assessment
  const hasFormSecurity = formSecurity != null && Object.keys(formSecurity).length > 0;
  const formSecurityDetail = hasFormSecurity
    ? Object.entries(formSecurity)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/([A-Z])/g, ' $1').trim())
        .join(', ') || 'Partial'
    : null;

  // Checklist items
  const checklist = [
    {
      label: 'Platform Detection',
      status: platform ? 'pass' as const : 'warn' as const,
      detail: platform ?? 'No ecommerce platform identified',
    },
    {
      label: 'Checkout System',
      status: checkout ? 'pass' as const : 'warn' as const,
      detail: checkout ?? 'No checkout flow detected',
    },
    {
      label: 'Pricing Page',
      status: pricingPage ? 'pass' as const : 'warn' as const,
      detail: pricingPage ? (typeof pricingPage === 'string' ? 'Found' : 'Detected') : 'Not found',
    },
    {
      label: 'Trial / Demo',
      status: trialPage ? 'pass' as const : 'warn' as const,
      detail: trialPage ? (typeof trialPage === 'string' ? 'Available' : 'Detected') : 'Not found',
    },
    {
      label: 'Auth Providers',
      status: authProviders.length > 0 ? 'pass' as const : 'warn' as const,
      detail: authProviders.length > 0 ? authProviders.join(', ') : 'None detected',
    },
    {
      label: 'Payment Processors',
      status: paymentProviders.length > 0 ? 'pass' as const : 'warn' as const,
      detail: paymentProviders.length > 0 ? paymentProviders.join(', ') : 'None detected',
    },
    {
      label: 'Form Security',
      status: hasFormSecurity ? 'pass' as const : 'fail' as const,
      detail: formSecurityDetail ?? 'No CSRF or security tokens detected',
    },
    {
      label: 'Cart Detection',
      status: cartDetected ? 'pass' as const : 'warn' as const,
      detail: cartDetected
        ? `Active${typeof productPages === 'number' ? ` · ${productPages} product pages` : ''}`
        : 'No cart functionality detected',
    },
  ];

  return (
    <SlideShell
      moduleName="Ecommerce & SaaS"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Cart detection, payment processors, auth providers, pricing pages"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Commerce Capabilities Grid ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
          Commerce Capabilities
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4em 1.5em' }}>
          {checklist.map((item) => (
            <CheckItem key={item.label} status={item.status} label={item.label} detail={item.detail} />
          ))}
        </div>

        {/* Payment & auth provider pills */}
        {(paymentProviders.length > 0 || authProviders.length > 0) && (
          <div style={{ display: 'flex', gap: '1.5em', marginTop: '0.5em', paddingTop: '0.4em', borderTop: '1px solid rgba(255,178,239,0.04)' }}>
            {paymentProviders.length > 0 && (
              <div>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(7px, 1.1cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  Payment Processors
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {paymentProviders.map((p, i) => (
                    <Pill key={i} text={p} color="var(--gs-terminal)" />
                  ))}
                </div>
              </div>
            )}
            {authProviders.length > 0 && (
              <div>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(7px, 1.1cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  Auth Providers
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {authProviders.map((a, i) => (
                    <Pill key={i} text={a} color="var(--gs-base)" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SlideShell>
  );
}
