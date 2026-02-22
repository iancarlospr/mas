/**
 * M41 Module Assessment Rubrics
 *
 * Per-module evaluation criteria that tell Gemini exactly how to assess
 * every extracted parameter step-by-step. Each rubric includes:
 * - Purpose: what the module evaluates
 * - Assessment instructions: methodology overview
 * - Parameters: step-by-step evaluation criteria with benchmarks
 * - Scoring anchors: what each score range looks like for THIS module
 */

export interface ParameterCriteria {
  parameter: string;
  evaluationSteps: string;
  benchmarks: string;
}

export interface ModuleRubric {
  name: string;
  category: string;
  purpose: string;
  assessmentInstructions: string;
  parameters: ParameterCriteria[];
  scoringAnchors: {
    excellent: string;
    good: string;
    moderate: string;
    poor: string;
    critical: string;
  };
}

export const MODULE_RUBRICS: Record<string, ModuleRubric> = {

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLIANCE & SECURITY
  // ═══════════════════════════════════════════════════════════════════════

  M01: {
    name: 'DNS & Security Baseline',
    category: 'Security & Compliance',
    purpose: 'Evaluates the domain\'s email deliverability infrastructure (DMARC, SPF, DKIM) and DNS security posture (HSTS, TLS, DNSSEC, CAA). Misconfigurations here directly impact email deliverability, enable domain spoofing, and create security vulnerabilities.',
    assessmentInstructions: `Evaluate each DNS/security parameter independently. For each:
1. State whether the record/configuration exists
2. If it exists, assess its configuration quality against the benchmark
3. Explain the specific risk or benefit in business terms
4. Provide a concrete remediation step if the configuration is suboptimal

Cross-reference parameters: a strong DMARC policy (p=reject) with a broken SPF record is worse than moderate DMARC (p=quarantine) with valid SPF, because reject+broken SPF = legitimate emails blocked. Also check redirect chain and mixed content as infrastructure hygiene signals.`,
    parameters: [
      {
        parameter: 'DMARC Record',
        evaluationSteps: `1. Check if dmarc.record exists
2. If null/missing: CRITICAL — domain has zero email authentication enforcement
3. If present, evaluate dmarc.policy:
   - p=none: WARNING — monitors only, does not enforce. Domain can still be spoofed.
   - p=quarantine: GOOD — suspicious emails sent to spam folder.
   - p=reject: EXCELLENT — unauthorized emails fully blocked.
4. Check dmarc.rua (aggregate reports) and dmarc.ruf (forensic reports):
   - Both present: monitoring is active
   - Missing: policy exists but nobody is watching it — WARNING
5. Check for subdomain policy (sp=) in dmarc.record if present
6. Check percentage tag (pct=) if < 100: WARNING — policy only applies to a fraction`,
        benchmarks: '92% of Fortune 500 enforce p=reject (2024 Agari report). RFC 7489 defines DMARC. Google/Yahoo require DMARC for bulk senders since Feb 2024.',
      },
      {
        parameter: 'SPF Record',
        evaluationSteps: `1. Check if spf.record exists
2. If null: CRITICAL — no sender authorization
3. If present, check the all-mechanism qualifier in the record string:
   - +all: CRITICAL — permits ALL senders
   - ~all: WARNING — soft fail
   - -all: EXCELLENT — hard fail
   - ?all: WARNING — neutral, useless
4. Count spf.mechanisms and spf.includes:
   - Total DNS lookup mechanisms > 10: CRITICAL — exceeds RFC 7208 limit, SPF breaks silently
   - 7-10: WARNING — approaching limit
   - < 7: GOOD
5. Check for overly broad ip4:/ip6: ranges`,
        benchmarks: 'RFC 7208 specifies max 10 DNS lookups. Exceeding causes permerror — treated as no SPF by receivers.',
      },
      {
        parameter: 'DKIM',
        evaluationSteps: `1. Check dkim.found
2. If false and dkim.selectors empty: WARNING — DKIM may exist but could not be verified, or genuinely absent
3. If selectors detected: POSITIVE
4. Note: key strength is not directly available from scan data, so assess presence only`,
        benchmarks: 'Google requires DKIM for bulk senders since Feb 2024. RFC 8301 mandates RSA-2048 minimum.',
      },
      {
        parameter: 'HSTS',
        evaluationSteps: `1. Check hsts.present
2. If false: WARNING — browsers allow HTTP downgrade attacks
3. If true, evaluate hsts.maxAge:
   - < 86400 (1 day): WARNING — too short
   - >= 31536000 (1 year): GOOD
   - >= 63072000 (2 years): required for HSTS preload list
4. Check hsts.includeSubDomains: required for preload
5. Check hsts.preload: EXCELLENT if true`,
        benchmarks: 'OWASP recommends max-age >= 31536000. HSTS preload requires >= 2 years + includeSubDomains + preload.',
      },
      {
        parameter: 'TLS Configuration',
        evaluationSteps: `1. Check tls.protocol:
   - TLS 1.0/1.1: CRITICAL — deprecated, PCI DSS non-compliant
   - TLS 1.2: GOOD — current minimum standard
   - TLS 1.3: EXCELLENT — latest
2. Check tls.grade if available:
   - A/A+: EXCELLENT
   - B: GOOD
   - C or lower: WARNING`,
        benchmarks: 'PCI DSS 3.2.1 requires TLS 1.2 minimum. TLS 1.3 adopted by ~65% of top sites.',
      },
      {
        parameter: 'Security Headers',
        evaluationSteps: `1. Check securityHeaders for each key header:
   - Content-Security-Policy: present = GOOD, absent = WARNING
   - X-Content-Type-Options: should be "nosniff"
   - X-Frame-Options: DENY or SAMEORIGIN = GOOD
   - Referrer-Policy: present = GOOD
   - Permissions-Policy: present = POSITIVE
2. Count how many of the recommended headers are present vs missing`,
        benchmarks: 'OWASP recommends CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy at minimum.',
      },
      {
        parameter: 'DNSSEC',
        evaluationSteps: `1. Check dnssec boolean
2. If false: INFO for most sites, WARNING for financial/healthcare
3. If true: POSITIVE`,
        benchmarks: 'DNSSEC adoption ~30% globally. Required by some government/financial regulations.',
      },
      {
        parameter: 'CAA Records',
        evaluationSteps: `1. Check caa array
2. If empty: INFO — any CA can issue certificates
3. If populated: POSITIVE — limits certificate issuance to authorized CAs`,
        benchmarks: 'RFC 8659. Recommended for all production domains.',
      },
      {
        parameter: 'Redirect Chain',
        evaluationSteps: `1. If redirectChain exists, check redirectChain.hops:
   - 0-1: GOOD
   - 2-3: WARNING — unnecessary latency
   - 4+: CRITICAL — excessive redirects
2. Check redirectChain.httpToHttps: should be true (enforces HTTPS)
3. Check for redirect loops in redirectChain.chain`,
        benchmarks: 'Google recommends minimizing redirect chains. Each hop adds 100-500ms latency.',
      },
      {
        parameter: 'Mixed Content',
        evaluationSteps: `1. If mixedContent exists:
   - mixedContent.activeCount > 0: CRITICAL — active mixed content breaks security
   - mixedContent.passiveCount > 0: WARNING — passive mixed content (images)
   - Both 0: POSITIVE — clean HTTPS
2. List specific mixed content entries if present`,
        benchmarks: 'Chrome blocks active mixed content. All modern browsers flag mixed content warnings.',
      },
    ],
    scoringAnchors: {
      excellent: 'DMARC p=reject with rua/ruf reporting, SPF valid with -all and <7 lookups, DKIM present, HSTS preloaded, TLS 1.3, key security headers present, DNSSEC enabled, CAA present, clean redirect chain, no mixed content.',
      good: 'DMARC p=quarantine, SPF valid, DKIM present, HSTS with long max-age, TLS 1.2+, most security headers present.',
      moderate: 'DMARC p=none (monitoring only), SPF present but with ~all, HSTS with short max-age, some security headers missing.',
      poor: 'Partial records: SPF exists but DMARC missing, or DMARC exists but SPF broken. No HSTS. Few security headers.',
      critical: 'No DMARC, no SPF, or SPF with +all. TLS 1.0/1.1. Active mixed content. No security headers.',
    },
  },

  M10: {
    name: 'Accessibility Audit',
    category: 'Security & Compliance',
    purpose: 'Evaluates WCAG 2.1 compliance level by auditing images (alt text), landmarks, headings, forms, focus management, and ARIA usage. Accessibility gaps create legal exposure (ADA/EAA lawsuits) and exclude users who rely on assistive technology.',
    assessmentInstructions: `Evaluate each accessibility parameter against WCAG 2.1 Level AA criteria. For each issue, note the specific WCAG success criterion violated. Consider cumulative impact — multiple minor issues compound into significant barriers for screen reader users.`,
    parameters: [
      {
        parameter: 'Image Accessibility',
        evaluationSteps: `1. Check a11y.images.total vs a11y.images.withAlt:
   - Calculate alt text coverage percentage
   - 100%: EXCELLENT
   - 90-99%: GOOD
   - 70-89%: WARNING
   - <70%: CRITICAL
2. Check imageAccessibility.missingAlt count
3. Check imageAccessibility.genericAlt (e.g., "image", "photo") — these fail WCAG too
4. Check a11y.images.lowQualityAlts count`,
        benchmarks: 'WCAG 2.1 SC 1.1.1 requires all non-decorative images have meaningful alt text. ADA lawsuits average $25K-$100K in settlements.',
      },
      {
        parameter: 'Landmark Regions',
        evaluationSteps: `1. Check a11y.landmarks: banner, navigation, main, contentinfo
2. Missing main: CRITICAL — screen readers cannot navigate to primary content
3. Missing navigation: WARNING — users cannot skip to nav
4. Missing banner/contentinfo: INFO — nice to have
5. Check a11y.hasLandmarks overall`,
        benchmarks: 'WCAG 2.1 SC 1.3.1. Screen readers use landmarks for page navigation.',
      },
      {
        parameter: 'Heading Structure',
        evaluationSteps: `1. Check a11y.headings.h1Count:
   - 0: WARNING — no primary heading
   - 1: EXCELLENT
   - 2+: WARNING — multiple H1s can confuse screen readers
2. Check a11y.headings.hasSkippedLevels (e.g., H1→H3 skipping H2):
   - true: WARNING — breaks heading hierarchy
3. Check total heading count for page structure`,
        benchmarks: 'WCAG 2.1 SC 1.3.1, 2.4.6. One H1 per page, no skipped levels.',
      },
      {
        parameter: 'Form Accessibility',
        evaluationSteps: `1. Check a11y.forms: total vs withLabel
   - Calculate label coverage: withLabel/total
   - 100%: EXCELLENT
   - <100%: WARNING to CRITICAL depending on gap
2. Check formAccessibility.unlabeledFields
3. Check formAccessibility.fieldsWithoutAutocomplete`,
        benchmarks: 'WCAG 2.1 SC 1.3.1, 3.3.2. All form inputs must have associated labels.',
      },
      {
        parameter: 'Focus Management',
        evaluationSteps: `1. Check a11y.focusRemoved: true = CRITICAL — keyboard users cannot see focus position
2. Check a11y.hasFocusVisible: false = WARNING — custom focus styles missing
3. Check a11y.hasSkipNav: false = WARNING — keyboard users must tab through all nav`,
        benchmarks: 'WCAG 2.1 SC 2.4.7 (focus visible), 2.4.1 (skip navigation).',
      },
      {
        parameter: 'Language Declaration',
        evaluationSteps: `1. Check a11y.hasLang: false = WARNING — screen readers cannot determine correct pronunciation`,
        benchmarks: 'WCAG 2.1 SC 3.1.1. HTML lang attribute required.',
      },
      {
        parameter: 'ARIA Issues',
        evaluationSteps: `1. Check a11y.ariaIssues.hiddenFocusable: >0 = WARNING — hidden elements receiving focus
2. Check a11y.ariaIssues.emptyButtons: >0 = CRITICAL — buttons without accessible names`,
        benchmarks: 'WCAG 2.1 SC 4.1.2. All interactive elements must have accessible names.',
      },
      {
        parameter: 'Link Accessibility',
        evaluationSteps: `1. Check linkAccessibility.emptyAnchors: >0 = WARNING
2. Check linkAccessibility.javascriptLinks: >0 = WARNING — not keyboard accessible
3. Check linkAccessibility.genericAnchors (e.g., "click here"): many = INFO`,
        benchmarks: 'WCAG 2.1 SC 2.4.4. Link purpose must be determinable from link text.',
      },
      {
        parameter: 'Accessibility Overlays',
        evaluationSteps: `1. Check a11y.overlays array
2. If overlays detected (AccessiBe, UserWay, etc.): WARNING — overlays do not fix underlying issues and can interfere with actual assistive technology`,
        benchmarks: 'National Federation of the Blind and over 700 accessibility professionals have signed statements against overlay products.',
      },
    ],
    scoringAnchors: {
      excellent: 'Alt text coverage >95%, all landmarks present, valid heading hierarchy, 100% form label coverage, focus visible, skip nav present, lang attribute set, no ARIA issues.',
      good: 'Alt text >85%, main landmark present, heading hierarchy mostly valid, high form label coverage, focus management adequate.',
      moderate: 'Alt text 70-85%, missing some landmarks, minor heading issues, some unlabeled forms.',
      poor: 'Alt text <70%, no landmarks, broken heading hierarchy, many unlabeled forms, focus removed.',
      critical: 'Alt text <50%, no main landmark, focus removed (outline:none), no form labels, accessibility overlay as band-aid.',
    },
  },

  M11: {
    name: 'Console Error Scan',
    category: 'Security & Compliance',
    purpose: 'Captures JavaScript errors, failed network requests, and console warnings that indicate broken functionality, tracking failures, or security issues (mixed content). Console errors directly impact user experience and data collection accuracy.',
    assessmentInstructions: `Evaluate the volume and severity of console errors. Distinguish between critical functionality errors (broken features, failed API calls) vs cosmetic warnings. Check SDK initialization logs for tracking tool health. Mixed content is a security concern.`,
    parameters: [
      {
        parameter: 'JavaScript Errors',
        evaluationSteps: `1. Check console.errors count:
   - 0: EXCELLENT
   - 1-3: GOOD — minor issues
   - 4-10: WARNING — significant error volume
   - 10+: CRITICAL — likely broken functionality
2. Examine console.samples.errors for specific error messages
3. Check jsErrors array for uncaught exceptions
4. Identify if errors are from first-party code vs third-party scripts`,
        benchmarks: 'Zero JS errors is the target for production sites. Each error risks broken tracking or user-facing bugs.',
      },
      {
        parameter: 'Failed Network Requests',
        evaluationSteps: `1. Check failedRequests array length:
   - 0: EXCELLENT
   - 1-3: WARNING — some resources failing
   - 4+: CRITICAL
2. Check networkErrors for 4xx/5xx status codes
3. Identify if failures are tracking pixels (data loss) vs assets (UX impact)`,
        benchmarks: 'Failed tracking requests = lost data. Failed asset requests = broken user experience.',
      },
      {
        parameter: 'Console Warnings',
        evaluationSteps: `1. Check console.warnings count — high volume indicates deprecated APIs or misconfigurations
2. Look for deprecation warnings that indicate future breakage`,
        benchmarks: 'Warnings should be investigated but are less urgent than errors.',
      },
      {
        parameter: 'Mixed Content',
        evaluationSteps: `1. Check mixedContent.isHttps and mixedContent.mixed array
2. Any mixed content on HTTPS site: WARNING to CRITICAL depending on type`,
        benchmarks: 'Modern browsers block active mixed content and warn on passive.',
      },
      {
        parameter: 'SDK Initialization',
        evaluationSteps: `1. Check sdkInitLogs for tracking tool initialization messages
2. Check errorTools array for tools that logged errors during init
3. Tools that fail to initialize = complete data loss for that tool`,
        benchmarks: 'All detected tracking tools should initialize without errors.',
      },
    ],
    scoringAnchors: {
      excellent: 'Zero JS errors, zero failed requests, no mixed content, all SDKs initialized cleanly.',
      good: '1-2 minor JS errors (third-party only), no failed tracking requests, clean SDK init.',
      moderate: '3-5 JS errors, some failed requests, minor SDK issues.',
      poor: '5-10 JS errors including first-party, multiple failed tracking requests.',
      critical: '10+ JS errors, critical functionality broken, tracking SDKs failing to initialize, active mixed content.',
    },
  },

  M12: {
    name: 'Legal Compliance',
    category: 'Security & Compliance',
    purpose: 'Assesses GDPR/CCPA compliance posture by checking privacy policy presence and quality, cookie consent mechanism, terms of service, and pre-consent tracking. Non-compliance exposes the business to regulatory fines (up to 4% of global revenue for GDPR).',
    assessmentInstructions: `Evaluate each compliance component independently. Cross-reference: if trackingPreConsent contains tools but consentBanner.found is false, this is a CRITICAL violation. Consider the jurisdiction field to determine which regulations apply.`,
    parameters: [
      {
        parameter: 'Privacy Policy',
        evaluationSteps: `1. Check privacyPolicy.found:
   - false: CRITICAL — legally required in most jurisdictions
2. If found, check privacyPolicy.wordCount:
   - < 500: WARNING — likely too thin to cover required disclosures
   - 500-2000: GOOD
   - > 2000: INFO — comprehensive (verify it's not boilerplate)`,
        benchmarks: 'GDPR Art. 13/14, CCPA §1798.100. Privacy policy required for any site collecting personal data.',
      },
      {
        parameter: 'Terms of Service',
        evaluationSteps: `1. Check termsOfService.found:
   - false: WARNING — recommended for all commercial sites
   - true: POSITIVE`,
        benchmarks: 'Not legally required everywhere but strongly recommended for commercial sites.',
      },
      {
        parameter: 'Consent Banner',
        evaluationSteps: `1. Check consentBanner.found:
   - false and site uses tracking cookies: CRITICAL — GDPR violation
2. If found, check consentBanner.hasReject:
   - false: CRITICAL — GDPR requires easy rejection (no "dark patterns")
3. Check consentBanner.hasPreferences:
   - false: WARNING — users should be able to choose cookie categories
4. Note consentBanner.platform (CMP provider)`,
        benchmarks: 'GDPR requires informed, specific, freely given consent. CNIL/ICO enforce reject button requirement. ePrivacy Directive requires cookie consent.',
      },
      {
        parameter: 'CCPA Compliance',
        evaluationSteps: `1. Check ccpa.found:
   - false and site targets California residents: WARNING
2. Check ccpa.mechanism for "Do Not Sell" link or equivalent`,
        benchmarks: 'CCPA §1798.120 requires "Do Not Sell My Personal Information" link.',
      },
      {
        parameter: 'Cookie Policy',
        evaluationSteps: `1. Check cookiePolicy.found — should exist separately or within privacy policy`,
        benchmarks: 'ePrivacy Directive requires clear cookie disclosure.',
      },
      {
        parameter: 'Pre-Consent Tracking',
        evaluationSteps: `1. Check trackingPreConsent array:
   - Empty: EXCELLENT — no tracking before consent
   - Contains tools: WARNING to CRITICAL — tracking fires before user consents
2. Cross-reference with consentBanner: if no banner but tracking present, CRITICAL`,
        benchmarks: 'GDPR requires consent BEFORE setting non-essential cookies or firing tracking pixels.',
      },
    ],
    scoringAnchors: {
      excellent: 'Privacy policy present and comprehensive, consent banner with reject + preferences, no pre-consent tracking, CCPA mechanism present, cookie policy present.',
      good: 'Privacy policy present, consent banner with reject, minimal pre-consent tracking, ToS present.',
      moderate: 'Privacy policy present but thin, consent banner exists but lacks reject button, some pre-consent tracking.',
      poor: 'Privacy policy thin or missing key disclosures, no reject on consent banner, significant pre-consent tracking.',
      critical: 'No privacy policy, no consent banner, tracking fires before consent, no CCPA mechanism for California-targeted site.',
    },
  },

  M40: {
    name: 'Subdomain & Attack Surface',
    category: 'Security & Compliance',
    purpose: 'Enumerates subdomains to map the attack surface. Identifies exposed internal services (staging, admin, API), dangling DNS records, and security misconfigurations across the domain\'s infrastructure.',
    assessmentInstructions: `Evaluate the subdomain inventory for security risks. Focus on: exposed internal services, dangling DNS (subdomain takeover risk), and the overall attack surface size relative to the business type.`,
    parameters: [
      {
        parameter: 'Total Subdomains',
        evaluationSteps: `1. Check totalDiscovered — larger attack surface = more potential exposure
2. Context matters: SaaS companies naturally have more subdomains than small businesses`,
        benchmarks: 'Average enterprise has 50-200 subdomains. Each is a potential entry point.',
      },
      {
        parameter: 'Subdomain Classifications',
        evaluationSteps: `1. Review subdomains array for classification field:
   - "internal/staging/dev": CRITICAL if isAlive — should not be publicly accessible
   - "api": WARNING — verify authentication is required
   - "mail/mx": INFO — expected
   - "cdn/static": INFO — expected
2. Check securitySeverity field for each subdomain
3. Count critical vs warning vs info`,
        benchmarks: 'Exposed staging/dev environments are among the top causes of data breaches.',
      },
      {
        parameter: 'Wildcard DNS',
        evaluationSteps: `1. Check wildcardDetected: true = WARNING — wildcard DNS complicates subdomain security assessment
2. Note wildcardIp if present`,
        benchmarks: 'Wildcard DNS can mask dangling records and complicate security auditing.',
      },
    ],
    scoringAnchors: {
      excellent: 'Clean subdomain inventory, no exposed internal services, no critical security findings, reasonable attack surface size.',
      good: 'Mostly clean inventory, 1-2 minor warnings, no critical exposures.',
      moderate: 'Some warnings — potentially exposed internal services or unused subdomains.',
      poor: 'Multiple warnings, exposed staging/dev environments, large unmanaged attack surface.',
      critical: 'Critical exposed services (admin panels, unprotected APIs), dangling DNS records, subdomain takeover risk.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PERFORMANCE & UX
  // ═══════════════════════════════════════════════════════════════════════

  M03: {
    name: 'Performance & Core Web Vitals',
    category: 'Performance & Experience',
    purpose: 'Measures Core Web Vitals (LCP, CLS), page load metrics (TTFB, FCP), resource optimization (images, fonts, scripts), and delivery efficiency (caching, compression). Performance directly impacts conversion rates, SEO rankings, and user experience.',
    assessmentInstructions: `Evaluate CWV metrics against Google's thresholds first, then dig into the causes (render-blocking resources, image optimization, third-party impact). Consider the business context: ecommerce sites need faster performance than blogs. Cross-reference with CrUX field data if available.`,
    parameters: [
      {
        parameter: 'Largest Contentful Paint (LCP)',
        evaluationSteps: `1. Check metrics.lcp (milliseconds):
   - <= 2500: GOOD (Google threshold)
   - 2501-4000: NEEDS IMPROVEMENT (WARNING)
   - > 4000: POOR (CRITICAL)
2. For ecommerce: tighten thresholds by 500ms (ecommerce conversion drops 7% per 100ms delay)
3. Check cruxFieldData.lcp if available for real-user data comparison`,
        benchmarks: 'Google CWV: Good <= 2.5s, Poor > 4.0s. Shopify data: 100ms slower LCP = 1.3% fewer conversions.',
      },
      {
        parameter: 'Cumulative Layout Shift (CLS)',
        evaluationSteps: `1. Check metrics.cls:
   - <= 0.1: GOOD
   - 0.1-0.25: NEEDS IMPROVEMENT (WARNING)
   - > 0.25: POOR (CRITICAL)
2. Common causes: images without dimensions, dynamic content injection, web fonts`,
        benchmarks: 'Google CWV: Good <= 0.1, Poor > 0.25.',
      },
      {
        parameter: 'Time to First Byte (TTFB)',
        evaluationSteps: `1. Check metrics.ttfb (milliseconds):
   - <= 800: GOOD
   - 801-1800: WARNING
   - > 1800: CRITICAL — server response too slow
2. Break down: metrics.dnsTime + metrics.tcpTime + metrics.sslTime + server processing`,
        benchmarks: 'Google recommends TTFB < 800ms. Server-side rendering frameworks typically 200-600ms.',
      },
      {
        parameter: 'First Contentful Paint (FCP)',
        evaluationSteps: `1. Check metrics.fcp:
   - <= 1800: GOOD
   - 1801-3000: WARNING
   - > 3000: CRITICAL`,
        benchmarks: 'Google: Good FCP <= 1.8s.',
      },
      {
        parameter: 'Render-Blocking Resources',
        evaluationSteps: `1. Check metrics.renderBlockingScripts + metrics.renderBlockingStyles:
   - 0: EXCELLENT
   - 1-3: GOOD
   - 4-7: WARNING
   - 8+: CRITICAL — significant render delay
2. Each render-blocking resource adds ~100-300ms to FCP`,
        benchmarks: 'Zero render-blocking resources in the critical path is the target.',
      },
      {
        parameter: 'Image Optimization',
        evaluationSteps: `1. Check imageOptimization:
   - oversizedCount > 0: WARNING (each oversized image = wasted bandwidth)
   - Calculate modernFormatCount / totalImages: should be >50% using WebP/AVIF
   - lazyLoadedCount: should be most below-fold images
   - Check imageCDN: using an image CDN = POSITIVE
2. Check metrics.totalImages and estimate total image weight`,
        benchmarks: 'WebP saves 25-34% vs JPEG. AVIF saves 50%+. HTTP Archive: median page serves 1MB+ of images.',
      },
      {
        parameter: 'Third-Party Impact',
        evaluationSteps: `1. Check metrics.thirdPartyScripts and metrics.thirdPartyBytes:
   - thirdPartyBytes > 500KB: WARNING
   - thirdPartyBytes > 1MB: CRITICAL
2. Check thirdPartyPerformance.renderBlockingCount if available
3. Check the ratio: thirdPartyBytes / metrics.totalBytes`,
        benchmarks: 'Average page loads 45+ third-party requests. Third parties cause ~57% of script execution time.',
      },
      {
        parameter: 'Font Strategy',
        evaluationSteps: `1. Check fontStrategy:
   - fontDisplayValues should include "swap" or "optional" (not "block" or "auto")
   - preloadedFonts > 0: POSITIVE
   - totalFonts > 5: WARNING — too many font files`,
        benchmarks: 'font-display: swap prevents invisible text. Preloading critical fonts reduces FCP.',
      },
      {
        parameter: 'Caching',
        evaluationSteps: `1. Check cacheStrategy:
   - hasImmutableAssets: POSITIVE
   - noCacheResources count: should be minimal for static assets
   - Check per-resource type cache ratios`,
        benchmarks: 'Static assets should have Cache-Control max-age >= 1 year with content hashing.',
      },
      {
        parameter: 'DOM Complexity',
        evaluationSteps: `1. Check domComplexity.totalNodes:
   - < 1500: EXCELLENT
   - 1500-3000: GOOD
   - 3000-5000: WARNING
   - > 5000: CRITICAL — DOM too large, impacts rendering performance
2. Check domComplexity.maxDepth: > 20 = WARNING`,
        benchmarks: 'Lighthouse flags DOM > 1500 nodes. Deep DOMs cause layout thrashing.',
      },
      {
        parameter: 'Resource Hints',
        evaluationSteps: `1. Check resourceHints: preconnect and dns-prefetch for critical third parties = POSITIVE
2. Check preload count for critical assets`,
        benchmarks: 'Preconnect saves 100-500ms per third-party origin.',
      },
    ],
    scoringAnchors: {
      excellent: 'LCP <= 2.0s, CLS <= 0.05, TTFB <= 500ms, zero render-blocking resources, all images optimized (WebP/AVIF), good caching, DOM < 1500 nodes, font-display: swap.',
      good: 'LCP <= 2.5s, CLS <= 0.1, TTFB <= 800ms, 1-2 render-blocking resources, most images optimized, reasonable third-party load.',
      moderate: 'LCP 2.5-4s, CLS 0.1-0.25, some render-blocking resources, mixed image optimization, significant third-party payload.',
      poor: 'LCP > 4s, CLS > 0.25 on some metrics, many render-blocking resources, no image optimization, heavy third-party load.',
      critical: 'LCP > 6s, CLS > 0.5, TTFB > 2s, massive DOM, no caching, no image optimization, render-blocked by multiple scripts.',
    },
  },

  M13: {
    name: 'Performance & Carbon Footprint',
    category: 'Performance & Experience',
    purpose: 'Assesses page weight, resource efficiency, and environmental impact (CO2 per page view). Evaluates first-party vs third-party resource balance, compression, lazy loading, and green hosting.',
    assessmentInstructions: `Evaluate total page weight and resource distribution. Compare first-party vs third-party bytes. Check for optimization opportunities in images, scripts, and fonts. Assess green hosting status.`,
    parameters: [
      {
        parameter: 'Total Page Weight',
        evaluationSteps: `1. Check metrics.totalBytes:
   - < 1MB: GOOD
   - 1-3MB: WARNING
   - > 3MB: CRITICAL
2. Break down by type: imageBytes, scriptBytes, styleBytes, fontBytes`,
        benchmarks: 'HTTP Archive median: ~2.5MB. Performance-optimized sites target < 1MB.',
      },
      {
        parameter: 'Third-Party Overhead',
        evaluationSteps: `1. Calculate metrics.thirdPartyBytes / metrics.totalBytes percentage
   - < 30%: GOOD
   - 30-60%: WARNING
   - > 60%: CRITICAL — third parties dominate page weight
2. Check metrics.thirdPartyDomainCount`,
        benchmarks: 'Average site: 45%+ of bytes from third parties.',
      },
      {
        parameter: 'Image Efficiency',
        evaluationSteps: `1. Check metrics.modernImageCount vs metrics.legacyImageCount
   - High modern format ratio: POSITIVE
2. Check metrics.lazyImageCount vs metrics.eagerImageCount
   - Most images should be lazy-loaded (below fold)`,
        benchmarks: 'WebP/AVIF can reduce image payload by 30-50%.',
      },
      {
        parameter: 'Compression',
        evaluationSteps: `1. Check metrics.compressedCount vs metrics.uncompressedCount
   - All text resources should be compressed (gzip/brotli)
   - Uncompressed text resources: WARNING`,
        benchmarks: 'Brotli saves 15-25% over gzip for text resources.',
      },
      {
        parameter: 'Carbon Footprint',
        evaluationSteps: `1. Check co2Grams per page view:
   - < 0.5g: EXCELLENT (cleaner than 75% of pages)
   - 0.5-1.0g: GOOD
   - 1.0-2.0g: WARNING
   - > 2.0g: CRITICAL
2. Check greenHosting: true = POSITIVE`,
        benchmarks: 'Website Carbon Calculator: average page produces ~0.5g CO2 per view. Green Web Foundation certifies green hosts.',
      },
    ],
    scoringAnchors: {
      excellent: 'Page < 1MB, third-party < 30%, all images optimized and lazy-loaded, compressed assets, green hosting, CO2 < 0.5g.',
      good: 'Page 1-2MB, reasonable third-party ratio, most images optimized, compression enabled.',
      moderate: 'Page 2-3MB, significant third-party overhead, mixed optimization.',
      poor: 'Page 3-5MB, heavy third-party load, no lazy loading, poor compression.',
      critical: 'Page > 5MB, dominated by third-party scripts, no optimization, no compression.',
    },
  },

  M14: {
    name: 'Mobile & Responsive Design',
    category: 'Performance & Experience',
    purpose: 'Evaluates mobile-first design quality including responsive images, touch targets, viewport configuration, horizontal scroll issues, and modern CSS features (dark mode, reduced motion). Mobile traffic accounts for 60%+ of web visits.',
    assessmentInstructions: `Evaluate from a mobile user\'s perspective. Check for usability issues that impact touch interaction, readability, and navigation. Consider responsive images and modern CSS feature support.`,
    parameters: [
      {
        parameter: 'Viewport & Zoom',
        evaluationSteps: `1. Check desktopAudit.viewportContent: should include width=device-width
2. Check desktopAudit.zoomBlocked:
   - true: CRITICAL — blocking zoom violates WCAG and frustrates users`,
        benchmarks: 'WCAG 2.1 SC 1.4.4: users must be able to zoom to 200%.',
      },
      {
        parameter: 'Horizontal Scroll',
        evaluationSteps: `1. Check mobileAudit.hasHorizontalScroll:
   - true: CRITICAL — content overflows viewport on mobile`,
        benchmarks: 'No horizontal scroll is a fundamental responsive design requirement.',
      },
      {
        parameter: 'Touch Targets',
        evaluationSteps: `1. Check mobileAudit.smallTargets vs mobileAudit.totalTargets:
   - Calculate percentage of small targets
   - > 20% small: WARNING
   - > 40% small: CRITICAL`,
        benchmarks: 'Google recommends minimum 48x48 CSS pixels for touch targets with 8px spacing.',
      },
      {
        parameter: 'Text Readability',
        evaluationSteps: `1. Check mobileAudit.smallTextCount:
   - 0: EXCELLENT
   - 1-5: WARNING
   - 5+: CRITICAL — significant readability issue on mobile`,
        benchmarks: 'Minimum 16px font size for body text on mobile.',
      },
      {
        parameter: 'Responsive Images',
        evaluationSteps: `1. Check responsiveImages if available:
   - srcsetCount > 0 and pictureElementCount > 0: POSITIVE
   - modernFormatPct: higher is better (WebP/AVIF)
   - oversizedCount: should be 0`,
        benchmarks: 'Responsive images with srcset save 30-50% bandwidth on mobile.',
      },
      {
        parameter: 'Media Queries & Breakpoints',
        evaluationSteps: `1. Check mobileAudit.hasMediaQueries and mobileAudit.mediaQueryCount:
   - true with 3+ breakpoints: GOOD — responsive design implemented
   - false: CRITICAL — no responsive design`,
        benchmarks: 'Standard breakpoints: 320px, 768px, 1024px, 1440px minimum.',
      },
      {
        parameter: 'Modern CSS Features',
        evaluationSteps: `1. Check modernCSSFeatures if available:
   - hasDarkMode: true = POSITIVE
   - hasReducedMotion: true = POSITIVE (accessibility)
   - hasHighContrast: true = POSITIVE`,
        benchmarks: 'Dark mode adoption: 80%+ of users on mobile prefer or use dark mode.',
      },
      {
        parameter: 'Mobile Navigation',
        evaluationSteps: `1. Check mobileAudit.hasHamburger or mobileAudit.hasDrawer:
   - Presence indicates mobile-specific navigation consideration: POSITIVE
2. Check mobileAudit.hiddenOnMobile for appropriately hidden desktop elements`,
        benchmarks: 'Mobile navigation should be thumb-friendly and accessible.',
      },
    ],
    scoringAnchors: {
      excellent: 'No horizontal scroll, zero small touch targets, proper viewport, responsive images with modern formats, 3+ breakpoints, dark mode support, reduced motion support.',
      good: 'No horizontal scroll, few small targets, proper viewport, responsive design with breakpoints, some image optimization.',
      moderate: 'Minor horizontal scroll or small target issues, viewport set but zoom blocked, basic responsive design.',
      poor: 'Horizontal scroll present, many small targets, limited responsive design, no image optimization for mobile.',
      critical: 'Horizontal scroll, zoom blocked, no responsive design, small text throughout, no touch target consideration.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYTICS & DATA INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════

  M05: {
    name: 'Analytics Architecture',
    category: 'Analytics & Measurement',
    purpose: 'Audits the analytics implementation: tool inventory, GA4 configuration, consent mode, data layer, server-side tracking, and cookie management. Gaps here mean the business is making decisions on incomplete or inaccurate data.',
    assessmentInstructions: `Evaluate analytics completeness and accuracy. Check for: tool presence, proper consent integration, data layer quality, server-side tracking capability, and cookie hygiene. A detected tool that fires without consent is a compliance issue. A tool that doesn't fire at all is a data gap.`,
    parameters: [
      {
        parameter: 'Analytics Tool Inventory',
        evaluationSteps: `1. Check tools array and toolCount:
   - 0 analytics tools: CRITICAL — no measurement at all
   - GA4 present: expected baseline
   - Multiple analytics tools: check for redundancy vs complementary use
2. Check for session replay / heatmap tools (valuable for CRO)
3. Check toolNames for recognized platforms`,
        benchmarks: 'GA4 is industry standard. Best-in-class setups include GA4 + server-side + session replay.',
      },
      {
        parameter: 'Consent Mode',
        evaluationSteps: `1. Check consent.hasConsentMode:
   - false: WARNING — required for GDPR compliance and accurate GA4 data in EU
2. Check consent.version:
   - v2: GOOD (Google Consent Mode v2, required since March 2024)
   - v1: WARNING — outdated
3. Check consent.defaultState — should deny analytics/ad storage by default in EU
4. Check consent.consentPlatform — should integrate with detected CMP`,
        benchmarks: 'Google Consent Mode v2 required since March 2024 for EU ad personalization. Without it, GA4 loses 40-70% of EU data.',
      },
      {
        parameter: 'Data Layer',
        evaluationSteps: `1. Check dataLayer array length:
   - 0: WARNING — no data layer, limits tracking capabilities
   - 1+: check for structured events
2. Check for standard events (page_view, purchase, etc.)`,
        benchmarks: 'Google Tag Manager best practices require a structured data layer.',
      },
      {
        parameter: 'Server-Side Tracking',
        evaluationSteps: `1. Check serverSideTracking:
   - true: POSITIVE — resilient to ad blockers, better data accuracy
   - false: INFO — client-side only (industry norm, but ad blockers block ~30% of tracking)`,
        benchmarks: 'Server-side tracking recovers 15-30% of data lost to ad blockers.',
      },
      {
        parameter: 'Measurement IDs',
        evaluationSteps: `1. Check networkMeasurementIds for GA4 (G-), Google Ads (AW-), etc.
2. Verify pixel fires > 0: detected tools should be firing
3. Check analyticsRequestCount and tagManagerRequestCount`,
        benchmarks: 'Every detected tool should have confirmed network requests (pixel fires).',
      },
      {
        parameter: 'Cookie Hygiene',
        evaluationSteps: `1. Review cookies array:
   - Check secure flag: all tracking cookies should be secure=true on HTTPS
   - Check sameSite: should be "Lax" or "Strict" (not "None" without Secure)
   - Count total cookies and ratio of identified vs unidentified
2. Identify any cookies without associated tool attribution`,
        benchmarks: 'Chrome phases out third-party cookies. First-party cookies with Secure + SameSite = best practice.',
      },
    ],
    scoringAnchors: {
      excellent: 'GA4 configured with Consent Mode v2, server-side tracking active, structured data layer, session replay present, all cookies properly attributed and secured.',
      good: 'GA4 present with consent mode, data layer exists, cookies mostly attributed.',
      moderate: 'GA4 present but no consent mode, limited data layer, no server-side tracking.',
      poor: 'Analytics present but misconfigured, no consent integration, multiple gaps.',
      critical: 'No analytics detected, or analytics firing without consent, no data layer, broken implementation.',
    },
  },

  M08: {
    name: 'Tag Governance',
    category: 'Analytics & Measurement',
    purpose: 'Evaluates tag management system (TMS) implementation, tag audit health (failed requests, blocking scripts), data layer quality, and third-party script governance. Poor tag governance degrades performance and creates data quality issues.',
    assessmentInstructions: `Evaluate TMS implementation quality, then audit tag health. Failed tag requests = lost data. Blocking scripts = slower page. Unknown domains = potential security risk. Piggyback tags indicate ungoverned loading.`,
    parameters: [
      {
        parameter: 'TMS Implementation',
        evaluationSteps: `1. Check tms array and tmsCount:
   - 0: WARNING — tags loaded directly, no governance layer
   - 1 with containers: GOOD — centralized tag management
   - 2+: WARNING — multiple TMS systems can conflict
2. Check containerCount — 1 per TMS is typical, 2+ suggests over-complexity`,
        benchmarks: 'Single TMS (GTM, Tealium, etc.) is best practice for tag governance.',
      },
      {
        parameter: 'Tag Health',
        evaluationSteps: `1. Check tagAudit.failedRequests:
   - 0: EXCELLENT
   - 1-3: WARNING — some tags failing
   - 4+: CRITICAL — significant data loss
2. Check tagAudit.blockingScripts vs tagAudit.asyncScripts:
   - Blocking should be minimized — each blocking script adds ~100-300ms
3. Check tagAudit.totalTagRequests for overall volume`,
        benchmarks: 'Zero failed tag requests is the target. All tags should load asynchronously.',
      },
      {
        parameter: 'Data Layer Quality',
        evaluationSteps: `1. Check dataLayer:
   - length > 0: GOOD
   - hasEcommerce: POSITIVE if ecommerce site
   - hasUserData: POSITIVE for personalization
   - hasPageData: POSITIVE for content analytics
2. Check dataLayerCustomEvents vs dataLayerSystemEvents ratio
   - Custom events indicate mature implementation`,
        benchmarks: 'GA4 Enhanced Ecommerce requires structured data layer events.',
      },
      {
        parameter: 'Third-Party Script Risk',
        evaluationSteps: `1. Check thirdPartyScriptCount and thirdPartyDomains:
   - Count unknownDomains — these are unvetted third parties
   - unknownDomains > 3: WARNING — potential supply chain risk
2. Check piggybackEstimate:
   - > 0: WARNING — tags loading other tags without TMS control`,
        benchmarks: 'Each unvetted third-party domain is a potential security/privacy risk.',
      },
      {
        parameter: 'Server-Side Indicators',
        evaluationSteps: `1. Check serverSideIndicators and sstSources:
   - true: POSITIVE — server-side tagging active (better performance and data resilience)`,
        benchmarks: 'Server-side GTM recommended for high-traffic sites and privacy compliance.',
      },
    ],
    scoringAnchors: {
      excellent: 'Single TMS with all tags managed, zero failed requests, all async, rich data layer with custom events, server-side tagging, no unknown domains.',
      good: 'TMS present, few failed requests, mostly async, data layer exists.',
      moderate: 'TMS present but some tags unmanaged, some failed requests, basic data layer.',
      poor: 'No TMS or multiple TMS conflicts, many failed requests, blocking scripts, unknown domains.',
      critical: 'No TMS, high failure rate, many blocking scripts, piggyback tags, significant unknown domains.',
    },
  },

  M09: {
    name: 'Behavioral Intelligence',
    category: 'Analytics & Measurement',
    purpose: 'Assesses behavioral data collection: A/B testing, session recording, heatmaps, scroll/click tracking, personalization, and user engagement patterns (overlays, push notifications, content gating). This infrastructure enables conversion optimization.',
    assessmentInstructions: `Evaluate the depth of behavioral intelligence infrastructure. More tools ≠ better — assess whether tools are actively collecting useful data. Consider UX impact of overlays and push notification requests.`,
    parameters: [
      {
        parameter: 'Experimentation',
        evaluationSteps: `1. Check behavioral.experiments array:
   - Empty: WARNING — no A/B testing capability
   - Tools detected (Optimizely, VWO, Google Optimize, etc.): POSITIVE
2. Check storageExperiments for active experiment data in storage`,
        benchmarks: 'Best-in-class sites run 20-50 A/B tests per year.',
      },
      {
        parameter: 'Session Recording & Heatmaps',
        evaluationSteps: `1. Check behavioral.sessionRecording and behavioral.heatmaps:
   - Both present: EXCELLENT — full behavioral visibility
   - One present: GOOD
   - Neither: WARNING — limited UX insight capability`,
        benchmarks: 'Session replay + heatmaps are standard CRO tools. Market leaders: Hotjar, FullStory, Clarity.',
      },
      {
        parameter: 'Scroll & Click Tracking',
        evaluationSteps: `1. Check hasScrollTracking and hasClickTracking:
   - Both true: GOOD — engagement measurement active
2. Check scrollTriggeredRequests and clickTriggeredRequests for activity`,
        benchmarks: 'Scroll depth and click tracking are foundational for content and UX optimization.',
      },
      {
        parameter: 'Personalization',
        evaluationSteps: `1. Check personalization array:
   - Tools detected: POSITIVE — dynamic content capability
   - Empty: INFO for most sites`,
        benchmarks: 'Personalization can increase conversion rates by 10-30%.',
      },
      {
        parameter: 'User Experience Impact',
        evaluationSteps: `1. Check overlays: count and isDismissible:
   - Multiple non-dismissible overlays: WARNING — hurts UX
   - coversContent = true: WARNING
2. Check pushNotifications.permissionState:
   - Requesting permission immediately: WARNING — best practice is to delay
3. Check contentGating — assess if gating is appropriate for the content type`,
        benchmarks: 'Google penalizes intrusive interstitials on mobile.',
      },
    ],
    scoringAnchors: {
      excellent: 'A/B testing, session recording, heatmaps, scroll/click tracking, personalization — all active with minimal UX friction.',
      good: 'Session recording + heatmaps present, some experimentation, scroll tracking active.',
      moderate: 'Basic analytics only, no experimentation platform, limited behavioral tracking.',
      poor: 'No behavioral intelligence tools, only basic page-level analytics.',
      critical: 'No behavioral tracking at all, AND aggressive overlays/push notifications degrading UX.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEO & CONTENT
  // ═══════════════════════════════════════════════════════════════════════

  M04: {
    name: 'Page Metadata & SEO',
    category: 'SEO & Content',
    purpose: 'Audits on-page SEO completeness: title tags, meta descriptions, canonical URLs, structured data (JSON-LD), Open Graph tags, robots directives, sitemap, and technical SEO signals. These directly impact search visibility and social sharing appearance.',
    assessmentInstructions: `Evaluate each metadata element for presence, quality, and correctness. Check for conflicts (e.g., canonical pointing elsewhere + noindex). Cross-reference OG tags with title/description for social sharing consistency.`,
    parameters: [
      {
        parameter: 'Title Tag',
        evaluationSteps: `1. Check title.content:
   - null/empty: CRITICAL — page has no title
2. Check title.length:
   - < 30: WARNING — too short, underutilizing title space
   - 30-60: EXCELLENT — optimal range
   - 60-70: GOOD
   - > 70: WARNING — will be truncated in SERPs`,
        benchmarks: 'Google displays ~50-60 characters. Moz recommends 50-60 chars for optimal CTR.',
      },
      {
        parameter: 'Meta Description',
        evaluationSteps: `1. Check metaDescription.content:
   - null/empty: WARNING — Google will auto-generate (suboptimal)
2. Check metaDescription.length:
   - < 70: WARNING — too short
   - 70-155: EXCELLENT — optimal range
   - > 155: WARNING — will be truncated`,
        benchmarks: 'Google displays ~120-155 characters. Well-crafted descriptions improve CTR by 5-10%.',
      },
      {
        parameter: 'Canonical URL',
        evaluationSteps: `1. Check canonical:
   - null: WARNING — risk of duplicate content issues
   - Present and self-referencing: GOOD
   - Present but pointing to different URL: INFO — intentional consolidation`,
        benchmarks: 'Every indexable page should have a self-referencing canonical tag.',
      },
      {
        parameter: 'Structured Data (JSON-LD)',
        evaluationSteps: `1. Check jsonLd.types:
   - Empty: WARNING — missing rich snippet opportunity
   - Contains "Organization": POSITIVE
   - Contains "WebSite" with hasSearchAction: POSITIVE (sitelinks search box)
2. Check jsonLd.organizationName and jsonLd.socialProfiles: indicate brand entity markup`,
        benchmarks: 'Schema.org markup enables rich results. Sites with structured data see 20-30% higher CTR.',
      },
      {
        parameter: 'Open Graph Tags',
        evaluationSteps: `1. Check ogTags for required properties:
   - og:title: required for social sharing
   - og:description: required
   - og:image: required (without it, social shares look broken)
   - og:url: recommended
   - og:type: recommended
2. Check twitterCards for twitter:card, twitter:title, twitter:image`,
        benchmarks: 'Facebook requires og:title, og:type, og:image, og:url minimum. Twitter requires twitter:card.',
      },
      {
        parameter: 'Robots Directives',
        evaluationSteps: `1. Check robotsDirectives:
   - noindex=true: CRITICAL if this is the homepage (blocking indexing)
   - nofollow=true: WARNING on homepage (blocking link equity flow)
2. Check robotsTxt.blocked: true = CRITICAL if homepage is blocked`,
        benchmarks: 'Homepage should always be indexable. Block only dev/staging environments.',
      },
      {
        parameter: 'Sitemap & Robots.txt',
        evaluationSteps: `1. Check robotsTxt.present: should be true
2. Check sitemap.present and sitemap.urlCount
3. Check robotsTxt.sitemapUrls: robots.txt should reference sitemap`,
        benchmarks: 'Every site should have robots.txt and an XML sitemap referenced in it.',
      },
      {
        parameter: 'HTML Lang & Hreflang',
        evaluationSteps: `1. Check htmlLang: null = WARNING
2. Check hreflang array for multilingual sites — each language should have hreflang tags`,
        benchmarks: 'HTML lang attribute required by WCAG and helps search engines determine content language.',
      },
      {
        parameter: 'Viewport & Charset',
        evaluationSteps: `1. Check viewport: hasWidth and hasInitialScale should both be true
2. Check charset: should be UTF-8`,
        benchmarks: 'Mobile-friendly: width=device-width, initial-scale=1. UTF-8 is universal standard.',
      },
      {
        parameter: 'Favicon & Manifest',
        evaluationSteps: `1. Check favicon.present: false = WARNING (missing browser tab icon)
2. Check manifest.present: POSITIVE for PWA capability`,
        benchmarks: 'Favicon improves brand recognition. Manifest enables Add to Home Screen.',
      },
      {
        parameter: 'LLMs.txt',
        evaluationSteps: `1. Check llmsTxt.present:
   - true: POSITIVE — forward-thinking AI discoverability
   - false: INFO — not yet standard`,
        benchmarks: 'Emerging standard for AI/LLM content access. Early adopter signal.',
      },
    ],
    scoringAnchors: {
      excellent: 'Optimized title (30-60 chars), meta description (70-155 chars), self-referencing canonical, rich JSON-LD (Organization + WebSite), complete OG tags with image, no blocking directives, sitemap present, proper lang/charset/viewport.',
      good: 'Title and description present and reasonable length, canonical set, basic structured data, OG tags present, sitemap present.',
      moderate: 'Title present but suboptimal length, meta description missing or too short, no structured data, partial OG tags.',
      poor: 'Title too long or generic, no meta description, no canonical, no structured data, no OG image.',
      critical: 'No title tag, homepage noindexed or robots.txt blocked, no sitemap, multiple critical SEO elements missing.',
    },
  },

  M15: {
    name: 'Social & Sharing Optimization',
    category: 'SEO & Content',
    purpose: 'Evaluates social sharing readiness: Open Graph tags, Twitter Cards, share buttons, social profile links. When content is shared, these determine how it appears on social platforms.',
    assessmentInstructions: `Check completeness of social metadata and presence of sharing mechanisms. Missing OG image is the single most impactful issue — shared links without images get 70% less engagement.`,
    parameters: [
      {
        parameter: 'Open Graph Tags',
        evaluationSteps: `1. Check socialData.ogTags for og:title, og:description, og:image, og:url
   - All present: GOOD
   - Missing og:image: CRITICAL for social sharing appearance`,
        benchmarks: 'Shared links with images get 150% more engagement (Buffer study).',
      },
      {
        parameter: 'Twitter Cards',
        evaluationSteps: `1. Check socialData.twitterTags for twitter:card, twitter:title, twitter:image
   - summary_large_image card type is optimal for engagement`,
        benchmarks: 'Twitter Cards increase engagement rate by 43% (Twitter internal data).',
      },
      {
        parameter: 'Share Buttons & Social Links',
        evaluationSteps: `1. Check socialData.shareButtons: presence indicates sharing is encouraged
2. Check socialData.profileLinks and socialData.sameAsLinks: presence of social profiles
3. Check hasShareThis/hasAddThis/hasNativeShare for sharing tools`,
        benchmarks: 'Share buttons increase social sharing by 7x (AddThis data).',
      },
    ],
    scoringAnchors: {
      excellent: 'Complete OG tags with high-quality image, Twitter summary_large_image card, share buttons present, social profiles linked, Schema.org sameAs.',
      good: 'OG tags present with image, basic Twitter card, some social profile links.',
      moderate: 'OG tags partially present, missing image, no Twitter cards.',
      poor: 'Minimal OG tags, no image, no share buttons.',
      critical: 'No OG tags, no Twitter cards, no social metadata at all.',
    },
  },

  M16: {
    name: 'PR & Media',
    category: 'Brand & Digital Presence',
    purpose: 'Evaluates press/media infrastructure: press page presence, media kit availability, press contact information, RSS feeds, and media coverage freshness. Affects earned media readiness and journalist accessibility.',
    assessmentInstructions: `Assess whether the business has a functional PR infrastructure that journalists and media can use. Freshness of content (most_recent_date) indicates activity level.`,
    parameters: [
      {
        parameter: 'Press Page',
        evaluationSteps: `1. Check press_page_url:
   - null: WARNING — no press page found
   - Present: POSITIVE
2. Check press_page_type for quality assessment
3. Check article_count and date_count for content volume`,
        benchmarks: 'Companies seeking media coverage should have a dedicated press/news page.',
      },
      {
        parameter: 'Media Kit & Contact',
        evaluationSteps: `1. Check media_kit_url: null = WARNING if press page exists
2. Check press_contact_email: null = WARNING — journalists need contact info
3. Check media_logos: true = POSITIVE (brand assets available)`,
        benchmarks: 'Media kits with downloadable logos/photos increase coverage likelihood.',
      },
      {
        parameter: 'Content Freshness',
        evaluationSteps: `1. Check most_recent_date:
   - Within 3 months: GOOD — active PR
   - 3-12 months: WARNING — stale
   - > 12 months or null: CRITICAL — abandoned`,
        benchmarks: 'Active press pages should have content within the last quarter.',
      },
      {
        parameter: 'RSS Feed',
        evaluationSteps: `1. Check rss_feed: present = POSITIVE — enables automated media monitoring`,
        benchmarks: 'RSS enables journalists and aggregators to track updates automatically.',
      },
    ],
    scoringAnchors: {
      excellent: 'Active press page with recent content, media kit available, press contact info, RSS feed, brand logos downloadable.',
      good: 'Press page present with recent-ish content, contact email available.',
      moderate: 'Press page exists but content is stale (3-12 months old).',
      poor: 'Press page exists but abandoned (>12 months), no media kit, no contact.',
      critical: 'No press page, no media infrastructure at all.',
    },
  },

  M34: {
    name: 'Losing Keywords',
    category: 'SEO & Content',
    purpose: 'Tracks keyword position changes to identify content decay and competitive displacement. Losing keywords represent declining organic visibility and traffic, while gaining keywords indicate growth momentum.',
    assessmentInstructions: `Compare losingCount vs gainingCount for overall trajectory. Prioritize high-volume losing keywords for content refresh. Consider competitive displacement patterns.`,
    parameters: [
      {
        parameter: 'Keyword Trajectory',
        evaluationSteps: `1. Compare losingCount vs gainingCount:
   - Gaining > Losing: POSITIVE — growth momentum
   - Roughly equal: INFO — stable
   - Losing > Gaining: WARNING — declining visibility
   - Losing >> Gaining (2x+): CRITICAL — significant content decay
2. Check totalKeywords for context`,
        benchmarks: 'Healthy sites maintain >60% of keywords stable or growing.',
      },
      {
        parameter: 'High-Value Losses',
        evaluationSteps: `1. Review losingKeywords sorted by searchVolume:
   - High-volume keywords dropping: CRITICAL — significant traffic impact
   - Low-volume keywords dropping: INFO — minimal impact
2. Check rankAbsolute for severity: dropping from page 1 to page 2+ is most severe`,
        benchmarks: 'Position 1-3 get ~60% of clicks. Dropping from page 1 to page 2 loses ~90% of traffic.',
      },
    ],
    scoringAnchors: {
      excellent: 'Gaining keywords >> losing keywords, no high-volume losses, strong positive trajectory.',
      good: 'Gaining slightly more than losing, few high-volume losses.',
      moderate: 'Roughly balanced losing/gaining, some high-volume keywords declining.',
      poor: 'More losing than gaining, multiple high-volume keywords dropping.',
      critical: 'Losing far exceeds gaining, many high-volume keywords lost from page 1.',
    },
  },

  M39: {
    name: 'Sitemap & Indexing',
    category: 'SEO & Content',
    purpose: 'Evaluates sitemap health, robots.txt configuration, URL structure, content freshness, and site architecture signals. Proper sitemap/indexing configuration ensures search engines can discover and crawl all important content.',
    assessmentInstructions: `Check sitemap validity, freshness signals, URL categorization for content strategy insights, and robots.txt for crawl directives. Evaluate the llms.txt file as an emerging AI discoverability signal.`,
    parameters: [
      {
        parameter: 'Robots.txt',
        evaluationSteps: `1. Check hasRobotsTxt: false = CRITICAL
2. Check sitemapDirectives: should reference sitemap(s)`,
        benchmarks: 'Every production site should have a robots.txt file referencing its sitemap.',
      },
      {
        parameter: 'Sitemap Health',
        evaluationSteps: `1. Check sitemaps array:
   - Empty: CRITICAL — no sitemap
   - Check each sitemap.valid: false = WARNING
2. Check totalUrls:
   - 0: CRITICAL
   - Reasonable count for site size: GOOD
3. Check isSitemapIndex for large sites`,
        benchmarks: 'XML sitemaps help search engines discover and prioritize URLs. Max 50,000 URLs per sitemap.',
      },
      {
        parameter: 'Content Freshness',
        evaluationSteps: `1. Check freshness if available:
   - updatedLast30Days > 0: POSITIVE — active content updates
   - updatedLast90Days = 0: WARNING — stale content
   - lastModified date assessment`,
        benchmarks: 'Google values fresh content. Active content updates signal site health.',
      },
      {
        parameter: 'URL Structure',
        evaluationSteps: `1. Check urlCategories for content distribution:
   - Diverse categories (blog, product, resources): POSITIVE — rich content strategy
   - Single category dominated: INFO — may be appropriate for business type
2. Check locales for internationalization`,
        benchmarks: 'Well-structured URL taxonomy aids crawling and user navigation.',
      },
      {
        parameter: 'LLMs.txt',
        evaluationSteps: `1. Check llmsTxt.exists: true = POSITIVE — AI discoverability
2. Check sections and linkedUrls for completeness`,
        benchmarks: 'Emerging standard. Early adopter signal for AI-forward businesses.',
      },
    ],
    scoringAnchors: {
      excellent: 'Valid robots.txt referencing sitemap, all sitemaps valid, fresh content (updated last 30 days), diverse URL categories, llms.txt present.',
      good: 'Robots.txt and sitemap present and valid, some recent content updates.',
      moderate: 'Sitemap present but some validity issues, content somewhat stale.',
      poor: 'Robots.txt missing or misconfigured, sitemap issues, stale content.',
      critical: 'No robots.txt, no sitemap, no indexing infrastructure.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PAID MEDIA & ATTRIBUTION
  // ═══════════════════════════════════════════════════════════════════════

  M06: {
    name: 'Paid Media Pixel Audit',
    category: 'Paid Media',
    purpose: 'Audits advertising pixel implementations: Google Ads, Meta/Facebook, TikTok, LinkedIn, etc. Evaluates enhanced conversions, CAPI (Conversions API), consent-aware firing, and attribution cookie management. Pixel gaps mean wasted ad spend through poor attribution.',
    assessmentInstructions: `Evaluate each detected pixel for implementation completeness. Missing enhanced conversions or CAPI = degraded attribution accuracy. Check pixel firing confirmation (networkFires > 0). Cross-reference with consent data from M05.`,
    parameters: [
      {
        parameter: 'Pixel Inventory',
        evaluationSteps: `1. Check pixels array and pixelCount:
   - 0 pixels: CRITICAL if business runs paid ads (check M21 for ad activity)
   - Pixels detected but networkFires=0: CRITICAL — pixel exists but never fires
2. Check each pixel for:
   - id: should be present (null = misconfigured)
   - events: should include conversion events (not just page_view)
   - confidence: low confidence may indicate unreliable detection`,
        benchmarks: 'Every active ad platform should have its pixel installed and firing.',
      },
      {
        parameter: 'Enhanced Conversions',
        evaluationSteps: `1. For each pixel, check hasEnhancedConversions:
   - Google Ads pixel without enhanced conversions: WARNING — missing 15-30% attribution accuracy
   - Meta pixel without enhanced conversions: WARNING
2. Check if serverSide is true for any pixel`,
        benchmarks: 'Google: Enhanced conversions improve attribution by 15-30%. Meta: Advanced Matching improves by 10-20%.',
      },
      {
        parameter: 'CAPI (Conversions API)',
        evaluationSteps: `1. Check capiDetected:
   - true: EXCELLENT — server-side conversion tracking
   - false: WARNING for serious advertisers
2. Check capiSource for implementation method`,
        benchmarks: 'Meta CAPI + browser pixel together improve attribution by 20-30%. Google enhanced conversions serve similar purpose.',
      },
      {
        parameter: 'Attribution Cookies',
        evaluationSteps: `1. Check attributionCookies and cookiesByPlatform:
   - Click ID cookies present (_gclid, _fbclid, etc.): POSITIVE
   - googleAdsCookieFallback: true = WARNING — using fallback cookie method
2. Check clickIds and utmParams for campaign tracking`,
        benchmarks: 'Click ID cookies are essential for conversion attribution. UTM parameters track campaign source.',
      },
      {
        parameter: 'Ad Script Overhead',
        evaluationSteps: `1. Check adScriptBytes:
   - < 100KB: GOOD
   - 100-300KB: WARNING — moderate overhead
   - > 300KB: CRITICAL — ad scripts significantly impacting page speed
2. Check adBytesByPlatform for per-platform breakdown`,
        benchmarks: 'Ad scripts should be loaded asynchronously and minimized.',
      },
    ],
    scoringAnchors: {
      excellent: 'All ad platform pixels installed with confirmed fires, enhanced conversions active, CAPI detected, proper attribution cookies, reasonable script overhead.',
      good: 'Main pixels installed and firing, some enhanced conversions, attribution cookies present.',
      moderate: 'Pixels present but missing enhanced conversions, no CAPI, some pixels not firing.',
      poor: 'Partial pixel coverage, no enhanced conversions, no CAPI, pixels not firing.',
      critical: 'No ad pixels despite running ads, or pixels installed but all zero fires, no attribution infrastructure.',
    },
  },

  'M06b': {
    name: 'PPC Landing Page Audit',
    category: 'Paid Media',
    purpose: 'Audits the paid media landing page for conversion readiness: tracking parity with homepage, CTA presence, form count, trust signals, page speed, and tracking implementation. This is where ad spend converts (or doesn\'t).',
    assessmentInstructions: `Compare the paid landing page against the homepage baseline for tracking parity. Missing tracking on the landing page = lost attribution for ad spend. Evaluate conversion elements (CTA, forms, trust signals).`,
    parameters: [
      {
        parameter: 'Tracking Parity',
        evaluationSteps: `1. Check trackingParity:
   - parityRatio: 1.0 = EXCELLENT (all homepage tools present on landing page)
   - 0.8-0.99: WARNING — some tools missing
   - < 0.8: CRITICAL — significant tracking gaps on paid page
2. Check trackingParity.missing array: list specific tools absent from landing page`,
        benchmarks: 'Landing pages should have 100% tracking parity with the main site. Missing tools = unattributed conversions.',
      },
      {
        parameter: 'Conversion Elements',
        evaluationSteps: `1. Check pageAudit.ctaAboveFold: false = WARNING — no CTA visible without scrolling
2. Check pageAudit.formCount: 0 on a lead-gen page = CRITICAL
3. Check pageAudit.ctaText for clarity and action-orientation
4. Check pageAudit.h1Text for message match with ad creative`,
        benchmarks: 'CTA above fold increases conversion by 17% (Unbounce data). Message match increases quality score.',
      },
      {
        parameter: 'Page Speed',
        evaluationSteps: `1. Check loadTimeMs:
   - < 2000: GOOD
   - 2000-4000: WARNING
   - > 4000: CRITICAL — every 1s delay reduces conversion by 7%`,
        benchmarks: 'Google Ads: landing page experience affects quality score and CPC.',
      },
      {
        parameter: 'Navigation & Distraction',
        evaluationSteps: `1. Check pageAudit.navLinkCount:
   - 0-3: EXCELLENT for landing page (focused)
   - 4-7: GOOD
   - 8+: WARNING — too many exit points
2. Check pageAudit.externalLinkCount: should be minimal`,
        benchmarks: 'Best landing pages have minimal navigation. Focus drives conversion.',
      },
      {
        parameter: 'SEO Considerations',
        evaluationSteps: `1. Check pageAudit.hasNoindex: true = GOOD for dedicated landing pages (avoid duplicate content)
2. Check pageAudit.hasCanonical`,
        benchmarks: 'PPC landing pages should typically be noindexed to avoid duplicate content.',
      },
    ],
    scoringAnchors: {
      excellent: '100% tracking parity, CTA above fold, forms present, fast load (<2s), minimal navigation, strong message match.',
      good: '>90% tracking parity, CTA present, forms present, reasonable load time.',
      moderate: '80-90% tracking parity, CTA below fold, adequate forms, moderate load time.',
      poor: '<80% tracking parity, no clear CTA, missing forms, slow load.',
      critical: 'Major tracking gaps, no CTA, no forms, very slow load, or landing page is generic homepage.',
    },
  },

  M21: {
    name: 'Ad Library Intelligence',
    category: 'Paid Media',
    purpose: 'Analyzes ad creative strategy from Meta Ad Library and Google Ads Transparency Center using both extracted text data AND visual screenshots of actual ads. Evaluates creative design quality, messaging effectiveness, platform coverage, targeting, and creative diversity.',
    assessmentInstructions: `This module includes ATTACHED SCREENSHOTS of actual ads. You must analyze each ad individually using both the visual screenshot and its paired text data.

METHODOLOGY:
1. Start with the full-page overview screenshots to understand the overall ad presence on each platform.
2. For each individual ad screenshot: pair it with the corresponding text data (facebook.ads[0] matches the first Facebook ad screenshot, etc.).
3. Analyze each ad one-by-one: examine the visual design quality, read the extracted text data, and assess them together as a single ad unit.
4. After analyzing all individual ads, step back and assess the cross-platform strategy.
5. At the very end, after all recommendations, generate an improved ad creative concept based on your analysis.`,
    parameters: [
      {
        parameter: 'Individual Facebook Ad Analysis (per ad)',
        evaluationSteps: `For EACH Facebook ad (screenshot paired with its text data from facebook.ads[i]):
1. VISUAL DESIGN (from screenshot):
   - Assess overall visual quality: professional vs amateur, brand consistency, color palette
   - Check text-to-image ratio: Meta recommends <20% text on ad images
   - Identify ad format: static image, video thumbnail, carousel, Stories/Reels
   - Evaluate CTA button visibility and placement
   - Assess mobile-first design (most Meta impressions are mobile)
   - Check image quality: resolution, cropping, visual hierarchy
2. MESSAGING (from text data):
   - Read adText: is the copy compelling? Clear value proposition? Emotional hook?
   - Read ctaButtonText: is it action-oriented? ("Shop Now" vs "Learn More")
   - Check advertiserName and advertiserHandle for brand consistency
3. TARGETING & REACH:
   - Check platforms array: Facebook only? Instagram too? Audience Network?
   - Check reachData: geographic reach distribution by location
   - Check transparencyByLocation and beneficiaryAndPayer for transparency signals
4. FRESHNESS:
   - Check startedRunning date: how long has this creative been running?
   - Creatives running >90 days may indicate creative fatigue or stable performer
5. TRACKING:
   - Check ctaUrl for UTM parameters (utmParams object)
   - Missing UTMs = unattributed traffic from paid spend
6. Produce a key_finding for this specific ad with severity, evidence, and recommendation`,
        benchmarks: 'Meta best practices: <20% text on images, clear CTA, mobile-first design. Creative refresh every 2-4 weeks. 3-5 active creative variants minimum for testing. UTM parameters required on all ad URLs.',
      },
      {
        parameter: 'Individual Google Search Ad Analysis (per ad)',
        evaluationSteps: `For each Google Search ad screenshot:
1. VISUAL ASSESSMENT (from screenshot):
   - Assess headline structure: are headlines compelling and keyword-relevant?
   - Check description quality: clear value proposition, call to action?
   - Evaluate ad extensions visibility: sitelinks, callouts, structured snippets
   - Check display URL formatting
2. COMPETITIVE POSITIONING:
   - Is the ad visually distinctive from competitors in the same SERP?
   - Does the ad occupy significant SERP real estate (extensions, sitelinks)?
3. Produce a key_finding for each search ad`,
        benchmarks: 'Google Ads best practices: 3 headlines (max 30 chars each), 2 descriptions (max 90 chars), sitelink extensions improve CTR by 10-20%.',
      },
      {
        parameter: 'Individual YouTube Ad Analysis (per ad)',
        evaluationSteps: `For each YouTube ad screenshot:
1. VISUAL ASSESSMENT (from screenshot):
   - Assess video thumbnail quality and click-appeal
   - Identify ad format: TrueView in-stream, Discovery/in-feed, Bumper, Shorts
   - Evaluate visual branding and production quality
2. Check if video content aligns with brand messaging from Facebook ads
3. Produce a key_finding for each YouTube ad`,
        benchmarks: 'YouTube: first 5 seconds are critical for TrueView retention. Thumbnails with faces get 38% higher CTR.',
      },
      {
        parameter: 'Cross-Platform Creative Strategy',
        evaluationSteps: `After analyzing all individual ads:
1. CONSISTENCY: Compare messaging across Facebook, Google Search, YouTube
   - Is the brand story consistent across platforms?
   - Are visual themes and brand elements consistent?
2. CREATIVE DIVERSITY:
   - Are they testing creative variations or running identical creatives?
   - Different headlines, images, CTAs = active testing = POSITIVE
   - Same creative everywhere = WARNING (no testing)
3. PLATFORM COVERAGE:
   - Check summary: facebookActive, googleSearchActive, googleYoutubeActive
   - All active: POSITIVE — diversified strategy
   - Only one platform: WARNING — concentration risk
   - None active: INFO — may not be running paid ads
4. UTM DISCIPLINE:
   - Are UTM parameters consistent across all ad CTAs?
   - Missing UTMs on any platform = attribution gaps`,
        benchmarks: 'Diversified paid media across 2+ platforms reduces dependency risk. Creative testing across 3-5 variants improves performance by 15-30%.',
      },
      {
        parameter: 'AI-Generated Improved Ad Concept',
        evaluationSteps: `After completing ALL analysis and recommendations, generate ONE improved ad creative concept:
1. Write a suggested ad headline (platform-appropriate length)
2. Write suggested body/description text
3. Describe the visual concept (what the image should look like)
4. Specify the recommended CTA button text
5. Recommend the best platform and format for this creative
6. Explain why this creative would outperform the current ads based on your analysis

Include this as a special recommendation with action: "Recommended Creative Concept" and the ad copy/concept in implementation_steps.`,
        benchmarks: 'Data-driven creative recommendations based on competitive analysis and platform best practices.',
      },
    ],
    scoringAnchors: {
      excellent: 'Active on Meta + Google Search + YouTube, diverse creatives with professional design, clear CTAs, <20% text on Meta images, UTM tracking on all links, active creative testing, broad geographic targeting.',
      good: 'Active on 2+ platforms, professional creative quality, some creative diversity, tracking parameters present.',
      moderate: 'Active on 1 platform only, limited creative variety, basic design quality.',
      poor: 'Minimal ad presence, single creative, amateur design, no tracking parameters.',
      critical: 'No ads found on any platform despite evidence of paid traffic, or extremely poor creative quality with no tracking.',
    },
  },

  M28: {
    name: 'Paid Search Intelligence',
    category: 'Paid Media',
    purpose: 'Analyzes paid keyword strategy: top keywords by spend, CPC efficiency, estimated monthly cost, and traffic volume. Identifies waste and efficiency opportunities in paid search.',
    assessmentInstructions: `Evaluate paid keyword portfolio for efficiency. High CPC on low-converting keywords = waste. Compare estimated spend against organic alternatives where possible.`,
    parameters: [
      {
        parameter: 'Paid Keyword Portfolio',
        evaluationSteps: `1. Check totalPaidKeywords:
   - 0: INFO — no paid search activity
   - 1-50: moderate portfolio
   - 50+: extensive portfolio
2. Review topKeywords for CPC distribution and search volume`,
        benchmarks: 'Average CPC varies by industry: $1-2 for B2C, $3-6 for B2B, $50+ for legal/insurance.',
      },
      {
        parameter: 'Spend Efficiency',
        evaluationSteps: `1. Check estimatedMonthlyCost and avgCpc
2. Check totalEstimatedClicks: cost per click should be reasonable for industry
3. Look for high-CPC low-volume keywords (potential waste)`,
        benchmarks: 'Efficient paid search targets 3-5x ROAS.',
      },
    ],
    scoringAnchors: {
      excellent: 'Well-diversified keyword portfolio, competitive CPC, strong search volumes, efficient spend allocation.',
      good: 'Reasonable keyword count, average CPC for industry, decent traffic.',
      moderate: 'Limited keyword portfolio, some high-CPC keywords, moderate efficiency.',
      poor: 'Very few keywords, high CPCs relative to volume, inefficient spend.',
      critical: 'No paid search presence despite competitor activity, or extremely inefficient spend.',
    },
  },

  M29: {
    name: 'Competitor Landscape',
    category: 'Market Intelligence',
    purpose: 'Maps the competitive landscape: traffic overlap, keyword competition, content gaps. Identifies strategic positioning opportunities and competitive threats.',
    assessmentInstructions: `Evaluate the competitive environment. Consider competitor count, visibility scores, and keyword overlap. More competitors at higher positions = more competitive market.`,
    parameters: [
      {
        parameter: 'Competitive Intensity',
        evaluationSteps: `1. Check totalCompetitors: higher = more competitive market
2. Review topCompetitors:
   - Compare avgPosition scores
   - Check etv (estimated traffic value) for competitor strength
   - Check visibility scores relative to the scanned domain`,
        benchmarks: 'Understanding competitive position helps prioritize SEO and paid media strategy.',
      },
      {
        parameter: 'Market Position',
        evaluationSteps: `1. Compare the scanned domain's metrics against topCompetitors
2. Identify competitors with much higher visibility or traffic
3. Look for keyword overlap patterns`,
        benchmarks: 'Sites ranking in top 3 positions capture ~60% of organic clicks.',
      },
    ],
    scoringAnchors: {
      excellent: 'Dominant market position, high visibility vs competitors, strong keyword coverage.',
      good: 'Competitive position among top 5 competitors, reasonable visibility.',
      moderate: 'Mid-pack among competitors, some keyword gaps.',
      poor: 'Trailing most competitors, significant visibility gaps.',
      critical: 'Far behind competitors on most metrics, minimal market presence.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARTECH EFFICIENCY
  // ═══════════════════════════════════════════════════════════════════════

  M07: {
    name: 'MarTech Stack Inventory',
    category: 'MarTech & Infrastructure',
    purpose: 'Inventories the marketing technology stack: CRM, email platforms, automation tools, form builders, chat widgets, and more. Evaluates tool overlap, integration quality, and form lead capture effectiveness.',
    assessmentInstructions: `Assess stack composition for coverage, redundancy, and integration quality. Multiple tools in the same category suggest waste. Forms without email capture suggest lead gen gaps. Consider stack size relative to business complexity.`,
    parameters: [
      {
        parameter: 'Tool Inventory',
        evaluationSteps: `1. Check tools array and toolCount:
   - 0: WARNING — no MarTech detected
   - 1-10: typical for small-medium business
   - 10-25: typical for enterprise
   - 25+: WARNING — potential bloat
2. Check categories for coverage: CRM, email, automation, chat, analytics
3. Look for redundant tools in same category`,
        benchmarks: 'Average enterprise uses 91 MarTech tools (ChiefMartec 2024). Optimal is debatable — quality over quantity.',
      },
      {
        parameter: 'Form Infrastructure',
        evaluationSteps: `1. Check forms array and formCount:
   - 0: WARNING if commercial site — no lead capture
   - emailFormCount: should be > 0 for lead generation
2. Check form quality: hasEmail, hasPhone, hasName
3. Check formBuilder for known platforms`,
        benchmarks: 'Every commercial page should have at least one conversion form or CTA.',
      },
      {
        parameter: 'MarTech Overhead',
        evaluationSteps: `1. Check martechBytes:
   - < 200KB: GOOD
   - 200KB-500KB: WARNING
   - > 500KB: CRITICAL — MarTech significantly impacting page speed
2. Check martechNetworkHits for request volume`,
        benchmarks: 'MarTech scripts are among the top contributors to page bloat.',
      },
      {
        parameter: 'Tool Categories',
        evaluationSteps: `1. Check categories array for completeness:
   - Expected categories for commercial site: analytics, email/CRM, chat/support
   - Missing expected category: INFO to WARNING depending on business type
2. Check extractedIds for proper configuration`,
        benchmarks: 'Minimum viable MarTech stack: analytics + email/CRM + forms.',
      },
    ],
    scoringAnchors: {
      excellent: 'Well-curated stack with coverage across key categories, no redundancy, lead capture forms present, reasonable byte overhead, proper tool IDs extracted.',
      good: 'Good category coverage, some forms present, moderate overhead.',
      moderate: 'Partial category coverage, limited forms, some redundancy or bloat.',
      poor: 'Sparse tooling, no forms, or significant redundancy/bloat.',
      critical: 'No MarTech detected on commercial site, or massive bloat (>1MB MarTech scripts).',
    },
  },

  M20: {
    name: 'Ecommerce/SaaS Signals',
    category: 'MarTech & Infrastructure',
    purpose: 'Identifies ecommerce platform, payment processors, product-led growth signals (free trial, demo request, pricing page), and security features (2FA, CAPTCHA). Classifies the business model.',
    assessmentInstructions: `Evaluate the conversion infrastructure based on the detected business model (ecommerce vs SaaS vs hybrid). An ecommerce site needs cart/checkout. A SaaS site needs pricing page and signup flow.`,
    parameters: [
      {
        parameter: 'Business Model Classification',
        evaluationSteps: `1. Check ecommerce.productType: ecommerce/saas/marketplace/hybrid/unknown
2. Validate against detected signals:
   - hasCart + hasCheckout: confirms ecommerce
   - hasPricing + hasFreeTrial: confirms SaaS/PLG
   - hasDemoRequest: confirms sales-led SaaS`,
        benchmarks: 'Clear business model signals help score calibration across all modules.',
      },
      {
        parameter: 'Conversion Infrastructure',
        evaluationSteps: `1. For ecommerce: hasCart + hasCheckout required
   - Missing checkout: CRITICAL for ecommerce
2. For SaaS: hasPricing required
   - Missing pricing page: WARNING
3. Check ecommerce.platform for known platforms
4. Check ecommerce.paymentProcessors`,
        benchmarks: 'Every commercial site needs a clear conversion path.',
      },
      {
        parameter: 'PLG Signals',
        evaluationSteps: `1. Check ecommerce.plgSignals for free trial, signup, pricing, docs, changelog, etc.
   - Multiple PLG signals: POSITIVE for SaaS
2. Check ecommerce.ecommerceDataLayer: true = POSITIVE (GA4 ecommerce tracking)`,
        benchmarks: 'Product-led growth companies see 2-3x faster growth (OpenView data).',
      },
      {
        parameter: 'Security',
        evaluationSteps: `1. Check formSecurity:
   - has2FA: POSITIVE
   - captchaType detected: POSITIVE
   - passwordFields > 0 without captcha: WARNING`,
        benchmarks: 'Login forms should have CAPTCHA protection and support 2FA.',
      },
    ],
    scoringAnchors: {
      excellent: 'Clear business model, complete conversion infrastructure, payment processors configured, PLG signals present, ecommerce data layer active, 2FA + CAPTCHA.',
      good: 'Clear business model, conversion path exists, basic security features.',
      moderate: 'Business model detectable but conversion infrastructure incomplete.',
      poor: 'Unclear business model, missing key conversion elements.',
      critical: 'Ecommerce site without checkout, or SaaS without pricing/signup.',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DIGITAL PRESENCE
  // ═══════════════════════════════════════════════════════════════════════

  M02: {
    name: 'CMS & Infrastructure',
    category: 'Brand & Digital Presence',
    purpose: 'Identifies the technology stack: CMS, framework, CDN, hosting provider, web server, WAF, compression, and HTTP version. Evaluates infrastructure maturity and security posture.',
    assessmentInstructions: `Assess the technology choices for appropriateness to the business type and scale. Modern frameworks + CDN + WAF = mature infrastructure. Outdated CMS versions = security risk. Missing CDN = performance risk for global audience.`,
    parameters: [
      {
        parameter: 'CMS/Framework',
        evaluationSteps: `1. Check cms and framework:
   - Modern framework (React, Next.js, Nuxt, Svelte): POSITIVE for performance
   - WordPress: INFO — depends on version and configuration
   - CMS version: check if outdated (security risk)
2. Null for both: INFO — may be custom-built`,
        benchmarks: 'Outdated CMS versions are top targets for automated attacks.',
      },
      {
        parameter: 'CDN',
        evaluationSteps: `1. Check cdn:
   - Present (Cloudflare, CloudFront, Fastly, etc.): POSITIVE
   - Null: WARNING — no CDN detected, impacts global performance`,
        benchmarks: 'CDN reduces latency by 50%+ for geographically distributed users.',
      },
      {
        parameter: 'Hosting & Server',
        evaluationSteps: `1. Check hosting.provider: cloud providers (AWS, GCP, Vercel) = modern infrastructure
2. Check server: version exposure = WARNING (information disclosure)
3. Check httpVersion: HTTP/2 or HTTP/3 = GOOD, HTTP/1.1 = WARNING`,
        benchmarks: 'HTTP/2 multiplexing improves page load by 20-50% vs HTTP/1.1.',
      },
      {
        parameter: 'WAF & Compression',
        evaluationSteps: `1. Check waf: present = POSITIVE (web application firewall)
2. Check compression: "br" (brotli) = EXCELLENT, "gzip" = GOOD, null = WARNING`,
        benchmarks: 'WAF blocks 90%+ of automated attacks. Brotli compression saves 15-25% over gzip.',
      },
    ],
    scoringAnchors: {
      excellent: 'Modern framework, CDN present, WAF active, HTTP/2+, brotli compression, no version exposure, cloud hosting.',
      good: 'CDN present, HTTP/2, gzip compression, reasonable stack.',
      moderate: 'No CDN, HTTP/1.1, basic compression, some version exposure.',
      poor: 'Outdated CMS, no CDN, no WAF, HTTP/1.1, no compression.',
      critical: 'Severely outdated CMS with known vulnerabilities, no CDN, no WAF, server version exposed.',
    },
  },

  M17: {
    name: 'Careers & HR',
    category: 'Brand & Digital Presence',
    purpose: 'Evaluates careers page presence and quality as a business maturity signal: ATS provider, open positions, team/culture pages, and employer branding indicators.',
    assessmentInstructions: `Assess the careers infrastructure for hiring maturity. Presence of ATS, team page, and active job listings indicates a growing organization. Consider business size context.`,
    parameters: [
      {
        parameter: 'Careers Page',
        evaluationSteps: `1. Check careers_page_url:
   - Present: POSITIVE
   - Null: INFO for small businesses, WARNING for larger companies
2. Check ats_provider: known ATS (Greenhouse, Lever, etc.) = mature hiring process
3. Check open_positions_count for activity level`,
        benchmarks: 'Companies with >50 employees typically have dedicated careers pages.',
      },
      {
        parameter: 'Employer Brand',
        evaluationSteps: `1. Check has_team_page and has_culture_page:
   - Both present: POSITIVE — strong employer branding
2. Check benefits_mentioned, remote_work_mentioned, dei_mentioned
3. Check review_site_links for Glassdoor/Indeed presence`,
        benchmarks: 'Strong employer brand reduces cost-per-hire by 43% (LinkedIn data).',
      },
    ],
    scoringAnchors: {
      excellent: 'Professional careers page with ATS integration, active listings, team/culture pages, DEI mentions, employer review links.',
      good: 'Careers page present with some listings and ATS.',
      moderate: 'Basic careers page, few or no active listings.',
      poor: 'Careers page exists but abandoned or minimal.',
      critical: 'No careers presence despite being a mid-to-large company.',
    },
  },

  M18: {
    name: 'Investor Relations',
    category: 'Brand & Digital Presence',
    purpose: 'Evaluates investor relations infrastructure: IR portal, SEC filings, annual reports, earnings calls, ESG reporting, governance disclosures. Relevant primarily for public companies or those seeking investment.',
    assessmentInstructions: `Score based on business type: public companies NEED comprehensive IR. Private companies get scored on whether they have investor-facing content appropriate to their stage. If no IR signals at all and it's clearly a small business, score as INFO.`,
    parameters: [
      {
        parameter: 'IR Portal',
        evaluationSteps: `1. Check ir_page_url and ir_portal_depth:
   - "filings": EXCELLENT — comprehensive IR portal
   - "basic": GOOD — some IR presence
   - "none": WARNING for public companies, INFO for private
2. Check ticker_symbol: presence confirms public company status`,
        benchmarks: 'SEC requires public companies to disclose financial information. IR best practices include dedicated portal.',
      },
      {
        parameter: 'Disclosures',
        evaluationSteps: `1. Check sec_filings.found, annual_report.found, earnings_calls.found
2. Check esg_report.found, governance.found
3. Check board_members.count and investor_presentations.found`,
        benchmarks: 'Public companies: SEC filings + annual report + earnings calls are minimum requirements.',
      },
    ],
    scoringAnchors: {
      excellent: 'Comprehensive IR portal with filings, annual reports, earnings calls, ESG report, governance disclosures, board info, investor presentations.',
      good: 'IR portal with basic filings and annual report.',
      moderate: 'Some IR presence but incomplete disclosures.',
      poor: 'Minimal IR content despite being a public company.',
      critical: 'Public company with no IR infrastructure.',
    },
  },

  M19: {
    name: 'Support Infrastructure',
    category: 'Brand & Digital Presence',
    purpose: 'Evaluates customer support infrastructure: help center, status page, community forum, chatbot, support tiers, SLA, and developer documentation. Support quality directly impacts customer retention.',
    assessmentInstructions: `Assess the support infrastructure relative to business type and scale. SaaS companies need help centers and status pages. Ecommerce needs chat and returns info. Consider the depth and quality of support channels.`,
    parameters: [
      {
        parameter: 'Help Center',
        evaluationSteps: `1. Check support_page_url and help_page_quality:
   - "professional": EXCELLENT — dedicated help center
   - "any": GOOD — support page exists
   - "single_faq": WARNING — minimal
   - "none": WARNING to CRITICAL depending on business type
2. Check help_center_provider for known platforms (Zendesk, Intercom, etc.)`,
        benchmarks: 'SaaS companies: professional help center is expected. Ecommerce: at minimum FAQ.',
      },
      {
        parameter: 'Support Channels',
        evaluationSteps: `1. Check support_channels.count and channels array:
   - 3+: EXCELLENT — multi-channel support
   - 1-2: GOOD
   - 0: WARNING
2. Check chatbot.found: POSITIVE for immediate response capability
3. Check support_emails for direct contact option`,
        benchmarks: 'Multi-channel support increases customer satisfaction by 35% (Aberdeen Group).',
      },
      {
        parameter: 'Status Page',
        evaluationSteps: `1. Check status_page.provider:
   - Present (StatusPage, BetterUptime, etc.): POSITIVE — transparency
   - Null: WARNING for SaaS/tech companies`,
        benchmarks: 'Status pages build trust and reduce support tickets during incidents.',
      },
      {
        parameter: 'Developer & Advanced Support',
        evaluationSteps: `1. Check developer_docs: POSITIVE for technical products
2. Check training_academy: POSITIVE for complex products
3. Check sla.found: POSITIVE for enterprise-grade support
4. Check community_forum: POSITIVE for user engagement`,
        benchmarks: 'Developer docs reduce support burden. Community forums provide peer support.',
      },
    ],
    scoringAnchors: {
      excellent: 'Professional help center, 3+ support channels, status page, chatbot, developer docs, community forum, SLA defined.',
      good: 'Help center present, 2+ channels, chatbot or email support.',
      moderate: 'Basic support page, limited channels.',
      poor: 'Minimal support (email only), no help center.',
      critical: 'No support infrastructure despite being a commercial service.',
    },
  },

  M22: {
    name: 'News Sentiment',
    category: 'Brand & Digital Presence',
    purpose: 'Analyzes recent news coverage (past year) and media sentiment for the brand. Uses location-aware search based on user country. News sentiment affects brand perception, investor confidence, and customer trust.',
    assessmentInstructions: `Evaluate news volume, sentiment distribution, notable mentions, and search context. The data includes brandName (AI-resolved company name), countryCode, searchQueries (what was actually searched), and a notableMention (dominant theme). Negative news requires attention. No news may be acceptable for small businesses but concerning for public companies.`,
    parameters: [
      {
        parameter: 'News Coverage',
        evaluationSteps: `1. Check newsHeadlines array length:
   - 0: INFO for small businesses, WARNING for larger companies
   - 1-5: moderate coverage
   - 5+: active media presence
2. Review headline sources for credibility
3. Note the searchQueries to understand what was searched
4. Note the brandName to verify correct company was found`,
        benchmarks: 'Active media presence correlates with brand awareness and trust.',
      },
      {
        parameter: 'Sentiment & Notable Mentions',
        evaluationSteps: `1. Check sentiment.overallSentiment:
   - "positive": POSITIVE
   - "neutral": INFO
   - "mixed": WARNING — investigate negative articles
   - "negative": CRITICAL — active reputation risk
2. Check sentiment.notableMention for the dominant topic/theme
   - Positive themes (funding, expansion, partnership): highlight as brand strengths
   - Negative themes (lawsuit, breach, layoffs): flag as reputation risks
3. Review individual article sentiments for specific concerns`,
        benchmarks: 'Negative news sentiment can impact stock price by 1-5% for public companies.',
      },
    ],
    scoringAnchors: {
      excellent: 'Active positive news coverage from credible sources with constructive themes.',
      good: 'Some positive coverage, no negative articles.',
      moderate: 'Limited coverage, neutral sentiment.',
      poor: 'Mixed sentiment with some negative articles or concerning themes.',
      critical: 'Predominantly negative news coverage indicating active reputation crisis.',
    },
  },

  M23: {
    name: 'Social Sentiment',
    category: 'Brand & Digital Presence',
    purpose: 'Analyzes social media mentions and sentiment across Reddit, Twitter/X, and LinkedIn (past year). Uses location-aware search with the brand name resolved by M22. Social sentiment reflects real-time brand perception among customers and prospects.',
    assessmentInstructions: `Evaluate social mention volume, platform diversity, sentiment, and the notable mention theme. The data includes brandName (reused from M22), countryCode, searchQuery (the actual Google query used), and notableMention (dominant social theme). Cross-reference with news sentiment (M22) for consistent brand narrative.`,
    parameters: [
      {
        parameter: 'Social Mentions',
        evaluationSteps: `1. Check socialMentions array:
   - 0: INFO for B2B, WARNING for B2C consumer brands
   - Multiple platforms: POSITIVE — broad social footprint
2. Check platform diversity in socialSentiment.platforms
3. Note the searchQuery and brandName for context`,
        benchmarks: 'Social listening is essential for brand monitoring and customer feedback.',
      },
      {
        parameter: 'Social Sentiment & Notable Themes',
        evaluationSteps: `1. Check socialSentiment.overallSentiment:
   - "positive": POSITIVE
   - "neutral": INFO
   - "negative": WARNING — active social dissatisfaction
2. Check socialSentiment.notableMention for the dominant topic
   - Customer complaints: flag as reputation risk
   - Product praise: highlight as brand strength
   - Pricing discussions: note as market perception signal
3. Review per-platform sentiment for specific issues
4. Cross-reference with M22 notableMention for consistent themes`,
        benchmarks: 'Negative social sentiment spreads 3x faster than positive (MIT Sloan study).',
      },
    ],
    scoringAnchors: {
      excellent: 'Active positive social mentions across multiple platforms with constructive themes.',
      good: 'Some positive mentions, no negative trends.',
      moderate: 'Limited social presence, neutral sentiment.',
      poor: 'Mixed sentiment with negative mentions or concerning themes.',
      critical: 'Predominantly negative social sentiment, active complaints.',
    },
  },

  M37: {
    name: 'Review Velocity',
    category: 'Brand & Digital Presence',
    purpose: 'Tracks Google review volume, rating trends, and review velocity (monthly pace). Review health directly impacts local SEO rankings and consumer trust.',
    assessmentInstructions: `Evaluate average rating, review volume, velocity trend, and worst review patterns. A high rating with declining velocity may indicate stagnation. Low ratings with recent negative reviews indicate active problems.`,
    parameters: [
      {
        parameter: 'Rating & Volume',
        evaluationSteps: `1. Check avgRating:
   - >= 4.5: EXCELLENT
   - 4.0-4.4: GOOD
   - 3.5-3.9: WARNING
   - < 3.5: CRITICAL
2. Check totalReviews — context-dependent on business age and type`,
        benchmarks: 'BrightLocal: 87% of consumers read online reviews. 4.0+ rating is threshold for consideration.',
      },
      {
        parameter: 'Review Velocity',
        evaluationSteps: `1. Check velocity.trend:
   - "up": POSITIVE — accelerating reviews
   - "stable": INFO
   - "declining": WARNING — losing review momentum
2. Check velocity.momChange for month-over-month percentage change
3. Review monthlyBuckets for patterns`,
        benchmarks: 'Consistent review flow signals active business. Google values review recency for local ranking.',
      },
      {
        parameter: 'Negative Reviews',
        evaluationSteps: `1. Review worstReviews array for patterns:
   - Recurring themes: CRITICAL — systemic issues
   - One-offs: INFO — normal for any business
2. Check recent low-rating reviews for urgent issues`,
        benchmarks: 'Responding to negative reviews can increase rating perception by 0.12 stars.',
      },
    ],
    scoringAnchors: {
      excellent: 'Rating >= 4.5, high review volume, accelerating velocity, no recurring negative themes.',
      good: 'Rating >= 4.0, steady review flow, manageable negative reviews.',
      moderate: 'Rating 3.5-4.0, declining velocity, some negative patterns.',
      poor: 'Rating < 3.5, stagnant reviews, recurring complaints.',
      critical: 'Rating < 3.0, active negative review trend, systemic issues evident.',
    },
  },

  M38: {
    name: 'Local Pack (Google Business Profile)',
    category: 'Brand & Digital Presence',
    purpose: 'Evaluates Google Business Profile completeness: business details, photos, hours, contact info, reviews. GBP directly impacts local search visibility and map pack ranking.',
    assessmentInstructions: `Use the completenessChecklist for systematic evaluation. Each missing field represents a ranking factor gap. Compare rating and review count against local competitors.`,
    parameters: [
      {
        parameter: 'Profile Completeness',
        evaluationSteps: `1. Check completenessChecklist array:
   - Count present=true vs present=false
   - Calculate completeness percentage
   - 90%+: EXCELLENT
   - 70-89%: GOOD
   - 50-69%: WARNING
   - <50%: CRITICAL
2. Key fields: category, address, phone, hours, photos, description`,
        benchmarks: 'Google: complete profiles are 70% more likely to attract visits. 50% more likely to lead to purchase.',
      },
      {
        parameter: 'Photos & Visual Content',
        evaluationSteps: `1. Check businessProfile.totalPhotos:
   - 0: CRITICAL — no photos
   - 1-10: WARNING — minimal
   - 10-30: GOOD
   - 30+: EXCELLENT
2. Check hasLogo and hasMainImage`,
        benchmarks: 'Businesses with 100+ photos get 520% more calls (BrightLocal).',
      },
      {
        parameter: 'Reviews & Rating',
        evaluationSteps: `1. Check businessProfile.avgRating and businessProfile.reviewCount
   - Cross-reference with M37 for velocity data`,
        benchmarks: 'Local Pack ranking factors: review count and velocity are top signals.',
      },
      {
        parameter: 'Business Hours & Status',
        evaluationSteps: `1. Check hasWorkHours: false = WARNING
2. Check currentStatus: verify accuracy`,
        benchmarks: 'Inaccurate hours frustrate customers and reduce trust.',
      },
    ],
    scoringAnchors: {
      excellent: '>90% profile completeness, 30+ photos, 4.5+ rating, work hours set, all key fields present.',
      good: '70-90% completeness, 10+ photos, good rating, hours set.',
      moderate: '50-70% completeness, some photos, basic info present.',
      poor: '<50% completeness, few photos, missing key fields.',
      critical: 'No Google Business Profile found, or severely incomplete (no address, no phone, no hours).',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKET POSITION
  // ═══════════════════════════════════════════════════════════════════════

  M24: {
    name: 'Monthly Traffic',
    category: 'Market Intelligence',
    purpose: 'Reports monthly traffic estimates (organic and paid), keyword counts, and overall traffic volume. Provides a baseline for market position and growth assessment.',
    assessmentInstructions: `Evaluate traffic volume in context of business type and market. Assess the organic/paid split — heavy paid dependency without organic base is a risk. Compare keyword counts against traffic for SEO efficiency.`,
    parameters: [
      {
        parameter: 'Traffic Volume',
        evaluationSteps: `1. Check totalTraffic:
   - Context-dependent: ecommerce needs more traffic than B2B SaaS
   - Assess whether volume is reasonable for the business type
2. Check organicTraffic vs paidTraffic split:
   - >80% organic: POSITIVE — healthy organic foundation
   - >50% paid: WARNING — heavy paid dependency
   - 0 organic: CRITICAL — no organic visibility`,
        benchmarks: 'Organic traffic is 5.66x more likely to convert than paid (BrightEdge). Over-reliance on paid is a business risk.',
      },
      {
        parameter: 'Keyword Portfolio',
        evaluationSteps: `1. Check organicKeywords:
   - 0: CRITICAL — no organic keyword visibility
   - Assess relative to totalTraffic: high traffic from few keywords = concentration risk
2. Check paidKeywords for paid search investment breadth`,
        benchmarks: 'Diverse keyword portfolio reduces traffic volatility from algorithm updates.',
      },
    ],
    scoringAnchors: {
      excellent: 'Strong total traffic for business type, healthy organic/paid mix (>60% organic), large keyword portfolio, diverse traffic sources.',
      good: 'Reasonable traffic, decent organic base, moderate keyword count.',
      moderate: 'Low-to-moderate traffic, imbalanced organic/paid mix.',
      poor: 'Low traffic, heavy paid dependency, few organic keywords.',
      critical: 'Minimal traffic, no organic visibility, or 100% paid dependency.',
    },
  },

  M25: {
    name: 'Traffic by Country',
    category: 'Market Intelligence',
    purpose: 'Breaks down traffic by country to assess geographic concentration and market reach. High concentration in one country creates market risk.',
    assessmentInstructions: `Evaluate geographic diversity relative to the business model. A local business naturally concentrates in one country. A global SaaS should have diverse traffic.`,
    parameters: [
      {
        parameter: 'Geographic Distribution',
        evaluationSteps: `1. Check totalCountries and topCountryPct:
   - topCountryPct > 90% for a global business: WARNING — geographic concentration risk
   - Diverse spread (top country < 60%): POSITIVE for global businesses
2. Review countries array for target market alignment`,
        benchmarks: 'Geographic diversification reduces market risk.',
      },
    ],
    scoringAnchors: {
      excellent: 'Traffic from 10+ countries, aligned with target markets, no excessive concentration.',
      good: 'Traffic from multiple countries with reasonable distribution.',
      moderate: 'Moderate geographic spread, some concentration.',
      poor: 'Traffic concentrated in 1-2 countries for a global business.',
      critical: 'All traffic from one country for a business targeting multiple markets.',
    },
  },

  M26: {
    name: 'Keyword Rankings',
    category: 'Market Intelligence',
    purpose: 'Analyzes top organic keyword rankings: positions, search volumes, and estimated traffic value. Shows which keywords drive the most organic traffic.',
    assessmentInstructions: `Evaluate keyword portfolio quality. Focus on: top-10 count (page 1 visibility), keyword-traffic value alignment, and concentration risk (one keyword driving most traffic).`,
    parameters: [
      {
        parameter: 'Ranking Strength',
        evaluationSteps: `1. Check top10Count vs totalOrganic:
   - High top-10 ratio: POSITIVE — strong page 1 visibility
   - Low ratio: WARNING — most keywords on page 2+
2. Review topKeywords for search volume and CPC (value indicator)
3. Check for brand vs non-brand keyword balance`,
        benchmarks: 'Position 1 gets ~27.6% of clicks. Positions 1-3 get ~60% combined.',
      },
    ],
    scoringAnchors: {
      excellent: 'High top-10 count, diverse high-value keywords, strong non-brand rankings.',
      good: 'Reasonable top-10 count, some high-value keywords.',
      moderate: 'Limited page 1 rankings, mostly low-value keywords.',
      poor: 'Very few top-10 rankings, most keywords on page 2-3.',
      critical: 'No page 1 rankings, or only ranking for brand name.',
    },
  },

  M27: {
    name: 'Global Rankings Distribution',
    category: 'Market Intelligence',
    purpose: 'Summarizes keyword position distribution across SERP positions. Shows how many keywords rank in position 1, positions 2-3, and positions 4-10.',
    assessmentInstructions: `Evaluate the ranking distribution. More keywords in position 1-3 = higher click capture. Many keywords in 4-10 represent optimization opportunities (close to page top).`,
    parameters: [
      {
        parameter: 'Position Distribution',
        evaluationSteps: `1. Check rankings:
   - pos1: keywords in position 1 (highest value)
   - pos2_3: positions 2-3 (high value, close to top)
   - pos4_10: positions 4-10 (page 1 but lower CTR)
   - totalKeywords for context
2. Calculate pos1/totalKeywords ratio: higher = more dominant`,
        benchmarks: 'Position 1 CTR: ~27%. Position 2-3: ~15-18%. Position 4-10: ~2-6%.',
      },
    ],
    scoringAnchors: {
      excellent: 'Strong position 1 count, many keywords in top 3, healthy overall distribution.',
      good: 'Some position 1-3 keywords, majority on page 1.',
      moderate: 'Few top-3 keywords, most in positions 4-10.',
      poor: 'Very few page 1 keywords overall.',
      critical: 'Negligible ranking presence across all position brackets.',
    },
  },

  M30: {
    name: 'Traffic Sources (Referring Domains)',
    category: 'Market Intelligence',
    purpose: 'Maps the top referring domains that drive traffic through backlinks. Quality and diversity of referring domains impact domain authority and organic rankings.',
    assessmentInstructions: `Evaluate referring domain quality (rank), diversity, and recency. A few high-authority referring domains outweigh many low-quality ones.`,
    parameters: [
      {
        parameter: 'Referring Domain Profile',
        evaluationSteps: `1. Check totalReferringDomains:
   - Higher is generally better (broader link profile)
2. Review topSources for domain quality (rank):
   - High-rank (low number) referring domains: POSITIVE
3. Check firstSeen dates for recent vs aged backlinks`,
        benchmarks: 'Referring domain count is a top-3 Google ranking factor.',
      },
    ],
    scoringAnchors: {
      excellent: 'Large number of diverse, high-authority referring domains with ongoing new acquisition.',
      good: 'Moderate referring domain count with some authoritative sources.',
      moderate: 'Limited referring domains, mixed quality.',
      poor: 'Few referring domains, mostly low-quality.',
      critical: 'Minimal referring domains, no authoritative backlinks.',
    },
  },

  M31: {
    name: 'Domain Trust',
    category: 'Market Intelligence',
    purpose: 'Evaluates domain-level trust signals: domain rank, total backlinks, referring domains, and broken backlink count. These aggregate metrics determine overall search authority.',
    assessmentInstructions: `Evaluate the domain trust metrics holistically. High rank (low number) indicates strong authority. Broken backlinks indicate link rot that should be cleaned up.`,
    parameters: [
      {
        parameter: 'Domain Authority Metrics',
        evaluationSteps: `1. Check rank: lower number = higher authority
   - < 100,000: EXCELLENT — top 100K globally
   - 100K-500K: GOOD
   - 500K-1M: MODERATE
   - > 1M: WARNING — low authority
2. Check backlinks and referringDomains counts
3. Check brokenBacklinks:
   - >10% of total: WARNING — significant link rot
4. Review topAnchors for anchor text diversity`,
        benchmarks: 'Domain rank correlates with organic traffic potential. Broken backlinks waste link equity.',
      },
    ],
    scoringAnchors: {
      excellent: 'Top 100K domain rank, thousands of backlinks from diverse referring domains, minimal broken links, diverse anchor text.',
      good: 'Top 500K rank, healthy backlink profile, manageable broken links.',
      moderate: 'Top 1M rank, moderate backlink count, some broken links.',
      poor: 'Low rank, few backlinks, high broken backlink ratio.',
      critical: 'Very low authority (rank > 5M), minimal backlinks, mostly broken.',
    },
  },

  M32: {
    name: 'Domain Authority & Backlinks',
    category: 'Market Intelligence',
    purpose: 'Deep analysis of backlink profile: authority scores, referring domain quality, anchor text distribution, and nofollow ratio. Provides granular link intelligence beyond M31\'s overview.',
    assessmentInstructions: `Evaluate backlink quality, not just quantity. Anchor text diversity prevents over-optimization penalties. Nofollow ratio should be natural (15-30% nofollow is typical).`,
    parameters: [
      {
        parameter: 'Authority Score',
        evaluationSteps: `1. Check authority.rank, authority.backlinks, authority.referringDomains
2. Check authority.brokenBacklinks and authority.referringDomainsNofollow
3. Calculate nofollow ratio: referringDomainsNofollow / referringDomains
   - 15-30%: natural
   - > 50%: WARNING — high nofollow ratio`,
        benchmarks: 'Natural link profiles have 15-30% nofollow links.',
      },
      {
        parameter: 'Anchor Text Diversity',
        evaluationSteps: `1. Check anchorDiversity:
   - "diverse": POSITIVE — healthy anchor profile
   - "moderate": INFO
   - "concentrated": WARNING — possible over-optimization risk
2. Review anchors array for pattern analysis`,
        benchmarks: 'Google penalizes over-optimized anchor text. Diverse anchors indicate natural linking.',
      },
    ],
    scoringAnchors: {
      excellent: 'High authority score, large diverse backlink profile, natural anchor distribution, minimal broken links.',
      good: 'Moderate authority, healthy link profile, reasonable anchor diversity.',
      moderate: 'Average authority, some link quality issues.',
      poor: 'Low authority, concentrated anchors, many broken links.',
      critical: 'Very low authority, toxic backlink profile, over-optimized anchors.',
    },
  },

  M33: {
    name: 'Brand Search',
    category: 'Market Intelligence',
    purpose: 'Measures brand search volume and branded keyword variations. Brand search volume is a proxy for brand awareness and indicates organic demand generation.',
    assessmentInstructions: `Evaluate brand search volume relative to business size. Higher brand search = stronger brand awareness. Check for brand + modifier keywords (e.g., "brand pricing", "brand reviews") as intent signals.`,
    parameters: [
      {
        parameter: 'Brand Search Volume',
        evaluationSteps: `1. Check brandVolume and totalBrandVolume:
   - Assess relative to organic traffic from M24
   - Brand volume > 10% of total traffic: POSITIVE — strong brand
   - Very low brand volume: WARNING — limited brand awareness
2. Review brandKeywords for variant types (reviews, pricing, alternatives = strong brand)`,
        benchmarks: 'Brand search volume correlates with market share. It is the purest signal of brand demand.',
      },
    ],
    scoringAnchors: {
      excellent: 'High brand search volume with diverse branded queries (reviews, pricing, alternatives, login).',
      good: 'Moderate brand search with some branded query types.',
      moderate: 'Limited brand search, mostly just brand name.',
      poor: 'Very low brand search volume.',
      critical: 'No measurable brand search volume.',
    },
  },

  M35: {
    name: 'Engagement Metrics',
    category: 'Market Intelligence',
    purpose: 'Assesses user engagement quality through bounce rate and related behavioral metrics from third-party traffic analysis. High bounce rate may indicate poor content relevance or UX issues.',
    assessmentInstructions: `Contextualize bounce rate by business type. Blog posts naturally have higher bounce rates. Ecommerce product pages should have lower bounce rates. Compare against industry averages.`,
    parameters: [
      {
        parameter: 'Bounce Rate',
        evaluationSteps: `1. Evaluate bounce rate data if available:
   - < 40%: EXCELLENT
   - 40-55%: GOOD
   - 55-70%: WARNING
   - > 70%: CRITICAL (unless blog/content site)
2. Context: landing pages and blogs naturally have higher bounce rates
3. Compare against business type benchmarks`,
        benchmarks: 'Average bounce rate by industry: Ecommerce 47%, B2B 61%, Blog 70-90% (CXL Institute).',
      },
    ],
    scoringAnchors: {
      excellent: 'Bounce rate well below industry average, indicating strong engagement.',
      good: 'Bounce rate at or slightly below industry average.',
      moderate: 'Bounce rate at industry average.',
      poor: 'Bounce rate above industry average.',
      critical: 'Extremely high bounce rate for the business type, indicating fundamental UX or content issues.',
    },
  },

  M36: {
    name: 'Google Shopping',
    category: 'Market Intelligence',
    purpose: 'Evaluates Google Shopping presence: product feed, pricing competitiveness, ratings, and category coverage. Relevant primarily for ecommerce businesses.',
    assessmentInstructions: `Assess only if relevant (ecommerce business type from M20). No Google Shopping presence for a non-ecommerce business is not a concern. For ecommerce, evaluate product feed quality and competitive pricing.`,
    parameters: [
      {
        parameter: 'Shopping Presence',
        evaluationSteps: `1. Check totalProducts:
   - 0 for ecommerce site: CRITICAL — missing Shopping channel entirely
   - 0 for non-ecommerce: INFO — not applicable
   - Products present: POSITIVE
2. Review topProducts for pricing, ratings, and tags
3. Check categories array for product range coverage`,
        benchmarks: 'Google Shopping accounts for 85.3% of all retail search ad clicks.',
      },
      {
        parameter: 'Product Quality',
        evaluationSteps: `1. Check product ratings and ratingCount: higher ratings improve Shopping CTR
2. Check price competitiveness across products
3. Check delivery information presence`,
        benchmarks: 'Products with ratings get 17% higher CTR in Shopping ads.',
      },
    ],
    scoringAnchors: {
      excellent: 'Extensive product catalog in Shopping, competitive pricing, high ratings, complete product data.',
      good: 'Products present in Shopping with reasonable ratings.',
      moderate: 'Limited product representation, mixed ratings.',
      poor: 'Very few products in Shopping, low ratings.',
      critical: 'Ecommerce business with no Google Shopping presence.',
    },
  },
};

/**
 * Format a module rubric into a text block for the AI prompt.
 */
export function formatRubricForPrompt(rubric: ModuleRubric): string {
  const sections: string[] = [];

  sections.push(rubric.purpose);
  sections.push('');
  sections.push(rubric.assessmentInstructions);
  sections.push('');
  sections.push('#### Parameters to Evaluate');

  for (const param of rubric.parameters) {
    sections.push('');
    sections.push(`**${param.parameter}**`);
    sections.push(param.evaluationSteps);
    sections.push(`Benchmarks: ${param.benchmarks}`);
  }

  sections.push('');
  sections.push('#### Scoring Anchors for This Module');
  sections.push(`- 90-100 (Excellent): ${rubric.scoringAnchors.excellent}`);
  sections.push(`- 75-89 (Good): ${rubric.scoringAnchors.good}`);
  sections.push(`- 50-74 (Moderate): ${rubric.scoringAnchors.moderate}`);
  sections.push(`- 25-49 (Poor): ${rubric.scoringAnchors.poor}`);
  sections.push(`- 0-24 (Critical): ${rubric.scoringAnchors.critical}`);

  return sections.join('\n');
}
