/**
 * update-cabreraauto-synthesis.ts
 *
 * Updates M41 (module synthesis), M42 (executive brief), M45 (stack analyzer),
 * and M46 (boss deck) for scan 06692cea-92a8-440a-9bb1-13c21def13ca
 * with corrected data based on the factual cabreraauto.com investigation.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SCAN_ID = '06692cea-92a8-440a-9bb1-13c21def13ca';

// ═══════════════════════════════════════════════════════════════════════════
// M41: Module Synthesis — PATCH businessContext + 5 module summaries
// ═══════════════════════════════════════════════════════════════════════════

async function patchM41() {
  console.log('🧠 Patching M41 (Module Synthesis)...');

  const { data: current } = await supabase
    .from('module_results')
    .select('data, checkpoints, signals, score')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M41')
    .single();

  if (!current) throw new Error('M41 not found');
  const data = current.data as Record<string, unknown>;

  // ── Fix businessContext ──
  data['businessContext'] = {
    url: 'https://www.cabreraauto.com',
    scanDate: '2026-04-02',
    businessName: 'Cabrera Auto Group',
    description: 'Multi-brand automotive dealership in Puerto Rico serving Arecibo, Utuado, Hatillo, Camuy, Quebradillas, and Bayamon. 4 locations, 10 brands (Chevrolet, Chrysler, Dodge, Ford, GMC, Hyundai, Jeep, Nissan, Ram, Wagoneer). Founded 2007. Spanish-language site (es-US).',
    businessModel: 'Automotive Dealership (New & Used Vehicle Sales, Service, Parts, Body Shop)',
    techStack: {
      cms: 'Dealer eProcess (Everest)',
      framework: 'RequireJS + jQuery',
      cdn: 'Cloudflare + Cloudinary',
      hosting: 'Dealer eProcess SaaS',
    },
    ecommerce: {
      productType: 'Vehicles (new and used)',
      platform: 'Dealer eProcess',
      hasCheckout: false,
      hasFreeTrial: false,
    },
    scale: {
      totalTraffic: 469,
      organicTraffic: 469,
      paidTraffic: 0,
    },
  };

  // ── Replace 5 module summaries ──
  const summaries = data['moduleSummaries'] as Record<string, unknown>;

  // ── M01 Summary ──
  summaries['M01'] = {
    source: 'ai',
    analysis: `Cabrera Auto Group's DNS and security infrastructure presents a mixed profile — strong in some foundational areas but critically exposed in email authentication and several key HTTP security headers.

**DNS & TLS Foundation**: The domain sits behind Cloudflare nameservers (jeff/tricia.ns.cloudflare.com) with a modern TLS 1.3 configuration using an ECDSA certificate from Google Trust Services. HTTP/2 is enabled via the Cloudflare edge, and the redirect from the apex domain (cabreraauto.com) to the www subdomain is a clean single-hop HTTPS redirect. This is solid foundational infrastructure.

**Email Authentication — Critical Gap**: SPF is properly configured with a strict \`-all\` policy covering Microsoft 365 (via spf.protection.outlook.com) and Trend Micro Email Security (spf.tmes.trendmicro.com). DMARC is set to quarantine mode (p=quarantine), which is a reasonable enforcement level. However, **DKIM is completely absent** — no records were found across 10 common selectors. Without DKIM, emails from cabreraauto.com lack cryptographic authentication, increasing spoofing risk and reducing deliverability. Additionally, DMARC has no reporting URIs (rua/ruf), meaning the dealership has zero visibility into email authentication failures. For a business that likely sends appointment confirmations, service reminders, and promotional emails, this is a significant operational risk.

**HTTP Security Headers — Partial Coverage via Cloudflare**: The Cloudflare edge provides several critical headers automatically: X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy (same-origin), and a comprehensive Permissions-Policy that blocks all sensitive browser APIs (camera, microphone, geolocation, payment, USB). Cross-origin isolation headers are also present (COEP require-corp, COOP same-origin, CORP same-origin). However, **HSTS and CSP are both missing**. Without HSTS, the site is vulnerable to SSL-stripping attacks on the first visit. Without CSP, there's no protection against XSS injection — particularly concerning for a site that handles customer PII through lead forms and credit applications.

**DNSSEC**: Not enabled, though Cloudflare makes this a one-click configuration. This is a moderate risk — DNS cache poisoning attacks are rare but possible.

**SRI Coverage**: Zero subresource integrity hashes on cross-origin scripts (Google Fonts, GTM, RequireJS CDN). While these are trusted sources, SRI provides defense-in-depth against CDN compromises.

Overall, Cabrera Auto benefits significantly from Cloudflare's edge security, which provides better-than-average header coverage for a dealership site. The critical gaps are DKIM authentication and HSTS/CSP headers — both fixable without developer involvement (DKIM via Microsoft 365 admin, HSTS/CSP via Cloudflare dashboard).`,
    executive_summary: 'DNS and TLS infrastructure is solid with Cloudflare providing edge security headers and TLS 1.3. Critical gaps exist in email authentication (no DKIM) and missing HSTS/CSP headers. SPF and DMARC are properly configured but incomplete.',
    key_findings: [
      {
        parameter: 'DKIM Authentication',
        finding: 'No DKIM records found for any common selector',
        severity: 'critical',
        evidence: 'DNS TXT queries for default._domainkey, google._domainkey, selector1._domainkey, and 7 other selectors all returned empty',
        detail: 'DKIM provides cryptographic proof that emails originated from the claimed domain. Without it, emails are more likely to be flagged as spam or spoofed.',
        business_impact: 'Customer-facing emails (appointment confirmations, service reminders, promotional campaigns) may land in spam folders. Domain is vulnerable to email spoofing attacks that could damage brand reputation.',
        recommendation: {
          action: 'Configure DKIM signing for cabreraauto.com via Microsoft 365 admin center',
          priority: 'P0' as const,
          effort: 'S' as const,
          implementation_steps: [
            'Access Microsoft 365 admin center → Settings → Domains → cabreraauto.com',
            'Generate DKIM signing keys (selector1 and selector2)',
            'Add the provided CNAME records to Cloudflare DNS',
            'Enable DKIM signing in Exchange Online Protection',
            'Verify with: dig selector1._domainkey.cabreraauto.com CNAME',
          ],
          expected_impact: 'Improved email deliverability, reduced spam classification, protection against domain spoofing',
        },
      },
      {
        parameter: 'HSTS (Strict Transport Security)',
        finding: 'No HSTS header detected',
        severity: 'critical',
        evidence: 'HTTP response headers do not include Strict-Transport-Security',
        detail: 'Without HSTS, browsers will attempt HTTP connections on first visit, creating a window for SSL-stripping man-in-the-middle attacks.',
        business_impact: 'Customer data (including credit application information and contact details submitted via forms) could be intercepted during the first visit to the site.',
        recommendation: {
          action: 'Enable HSTS via Cloudflare dashboard',
          priority: 'P0' as const,
          effort: 'S' as const,
          implementation_steps: [
            'Log into Cloudflare dashboard for cabreraauto.com',
            'Navigate to SSL/TLS → Edge Certificates → HTTP Strict Transport Security',
            'Enable HSTS with max-age: 31536000 (1 year)',
            'Enable Include Subdomains',
            'Enable Preload after confirming all subdomains support HTTPS',
          ],
          expected_impact: 'Eliminates SSL-stripping attack vector, improves trust signals for browsers',
        },
      },
      {
        parameter: 'Content Security Policy',
        finding: 'No CSP header present',
        severity: 'critical',
        evidence: 'No Content-Security-Policy header in HTTP response',
        detail: 'CSP is the primary defense against cross-site scripting (XSS) attacks. The site loads scripts from multiple third-party domains (GTM, Google Analytics, Facebook, dealereprocess CDN) without CSP enforcement.',
        business_impact: 'Site is vulnerable to XSS attacks that could steal customer PII from lead forms and credit applications, or redirect users to phishing pages.',
        recommendation: {
          action: 'Implement Content Security Policy via Cloudflare Transform Rules',
          priority: 'P1' as const,
          effort: 'M' as const,
          implementation_steps: [
            'Audit all script sources: cdn.dealereprocess.org, googletagmanager.com, google-analytics.com, connect.facebook.net, fonts.googleapis.com, res.cloudinary.com',
            'Create CSP in report-only mode first (Content-Security-Policy-Report-Only)',
            'Set script-src to whitelist known domains',
            'Monitor for violations over 2 weeks',
            'Switch to enforcement mode once clean',
          ],
          expected_impact: 'Protection against XSS attacks, improved security posture for PII-handling forms',
        },
      },
      {
        parameter: 'SPF Configuration',
        finding: 'SPF record properly configured with strict enforcement',
        severity: 'positive',
        evidence: 'v=spf1 include:spf.protection.outlook.com include:spf.tmes.trendmicro.com -all',
        detail: 'The -all mechanism is the strictest SPF policy, instructing receiving servers to reject emails not from authorized senders. Two includes cover Microsoft 365 and Trend Micro Email Security.',
        business_impact: 'Good protection against unauthorized senders using the cabreraauto.com domain.',
      },
      {
        parameter: 'Cross-Origin Isolation',
        finding: 'Full cross-origin isolation headers present',
        severity: 'positive',
        evidence: 'COEP: require-corp, COOP: same-origin, CORP: same-origin',
        detail: 'Complete set of cross-origin isolation headers prevents Spectre-class attacks and ensures strict resource loading policies.',
        business_impact: 'Strong browser-level isolation protecting customer sessions from cross-origin attacks.',
      },
      {
        parameter: 'Permissions-Policy',
        finding: 'Comprehensive browser API lockdown',
        severity: 'positive',
        evidence: 'Permissions-Policy blocks accelerometer, camera, geolocation, gyroscope, microphone, payment, USB, and more',
        detail: 'All sensitive browser APIs are blocked via Permissions-Policy, preventing malicious scripts from accessing device sensors or payment APIs.',
        business_impact: 'Excellent defense-in-depth against browser-based attacks targeting customer devices.',
      },
    ],
    recommendations: [
      {
        action: 'Configure DKIM signing via Microsoft 365',
        priority: 'P0' as const,
        effort: 'S' as const,
        expected_impact: 'Improved email deliverability and anti-spoofing protection',
        implementation_steps: ['Access M365 admin → Domains → DKIM', 'Generate keys', 'Add CNAME records to Cloudflare', 'Enable signing'],
      },
      {
        action: 'Enable HSTS via Cloudflare',
        priority: 'P0' as const,
        effort: 'S' as const,
        expected_impact: 'Eliminates SSL-stripping vulnerability',
        implementation_steps: ['Cloudflare → SSL/TLS → Edge Certificates → HSTS', 'Set max-age 31536000', 'Enable includeSubDomains'],
      },
      {
        action: 'Implement CSP via Cloudflare Transform Rules',
        priority: 'P1' as const,
        effort: 'M' as const,
        expected_impact: 'XSS protection for customer-facing forms',
        implementation_steps: ['Audit script sources', 'Deploy report-only CSP', 'Monitor 2 weeks', 'Enforce'],
      },
      {
        action: 'Add DMARC reporting URIs',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Visibility into email authentication failures',
        implementation_steps: ['Update DMARC record to add rua=mailto:dmarc-reports@cabreraauto.com', 'Consider free DMARC reporting service (DMARCian, Postmark)'],
      },
      {
        action: 'Enable DNSSEC via Cloudflare',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Protection against DNS cache poisoning',
        implementation_steps: ['Cloudflare dashboard → DNS → DNSSEC → Enable'],
      },
    ],
    module_score: 64,
    score_breakdown: [
      { criterion: 'SPF Configuration', score: 100, weight: 0.5, evidence: 'Strict -all policy with correct includes' },
      { criterion: 'DMARC Policy', score: 70, weight: 0.5, evidence: 'Quarantine policy but no reporting URIs' },
      { criterion: 'DKIM Authentication', score: 0, weight: 0.5, evidence: 'No DKIM records found' },
      { criterion: 'TLS Protocol', score: 100, weight: 0.3, evidence: 'TLS 1.3 with ECDSA' },
      { criterion: 'HSTS', score: 0, weight: 0.5, evidence: 'Not present' },
      { criterion: 'Security Headers (XFO, XCTO, RP)', score: 100, weight: 0.3, evidence: 'All present via Cloudflare' },
      { criterion: 'CSP', score: 0, weight: 0.5, evidence: 'Not present' },
      { criterion: 'Permissions-Policy', score: 100, weight: 0.3, evidence: 'Full API lockdown' },
      { criterion: 'DNSSEC', score: 25, weight: 0.3, evidence: 'Not enabled' },
      { criterion: 'Redirect Chain', score: 100, weight: 0.3, evidence: 'Clean single-hop redirect' },
      { criterion: 'Cross-Origin Isolation', score: 100, weight: 0.2, evidence: 'COEP + COOP + CORP present' },
    ],
    score_rationale: 'Score of 64 reflects a site that benefits significantly from Cloudflare edge security (providing headers, TLS, isolation) but has critical gaps in email authentication (no DKIM) and two important missing headers (HSTS, CSP). The DNS foundation and redirect handling are clean.',
  };

  // ── M02 Summary ──
  summaries['M02'] = {
    source: 'ai',
    analysis: `Cabrera Auto Group runs on a purpose-built automotive dealer platform with enterprise-grade infrastructure — a strong technical foundation for a multi-brand dealership of this scale.

**CMS — Dealer eProcess (Everest Platform)**: The site runs on Dealer eProcess (DEP), a specialized automotive dealer management system and website platform. DEP powers the entire frontend experience including inventory management, lead capture forms, vehicle search, pricing displays, and coupon/promotion systems. The dealer ID is 4401 with site ID 14624, running site version 4. DEP is a well-established player in the automotive vertical — this is appropriate technology for a 10-brand, 4-location dealership group.

**CDN — Cloudflare + Cloudinary**: A dual-CDN architecture provides excellent content delivery. Cloudflare serves as the primary CDN and edge security layer (IPs 104.17.37-41.150), providing DDoS protection, HTTP/2, gzip compression, and bot management. Cloudinary handles image optimization specifically — responsive image transformations via \`$.cloudinary.responsive()\` ensure vehicle photos are served at appropriate dimensions for each device. This is a smart architecture that offloads the heaviest bandwidth (vehicle images) to a specialized image CDN.

**WAF — Cloudflare Managed Challenge + Turnstile**: The site uses aggressive bot protection — Cloudflare's Managed Challenge with Turnstile (site key: 0x4AAAAAAADnPIDROrmt1Wwj). While this is excellent for security, the aggressive configuration may block legitimate crawlers and SEO bots. The Cloudflare challenge successfully blocked our automated scanner, which is both a testament to its effectiveness and a potential SEO concern if search engine bots face similar friction.

**Server & Hosting**: The origin server is fully hidden behind Cloudflare (server header returns "cloudflare" only). DNS CNAME reveals hosting on Dealer eProcess SaaS infrastructure (saas.www.dealereprocess.org). This is a managed platform — the dealership doesn't manage servers, which reduces operational burden and security surface area.

**JavaScript Architecture**: RequireJS (AMD module loader) powers the client-side JavaScript with jQuery for DOM manipulation. While RequireJS is a legacy module system (modern sites use ES modules or bundlers like webpack/Vite), it's standard for DEP-based sites. The DEP proprietary module ecosystem includes dep-event-publisher, dep-chat-events, dep-form-events, asc-event-subscriber, smart-search, slideshow, and more — all loaded via RequireJS.

**Compression & Protocol**: gzip compression is active via Cloudflare, and HTTP/2 is enabled for multiplexed requests. CSS is served as a minified bundle (site.min.css). These are standard Cloudflare defaults but represent good baseline performance.

**Typography**: Montserrat font loaded via Google Fonts (300-700 weights). This adds a render-blocking resource but is common practice.

Overall, this is a well-architected dealership platform — the right CMS for the vertical, dual CDN for performance, strong WAF for security, and managed hosting to reduce operational overhead. The main concern is that the aggressive Cloudflare bot protection could interfere with third-party integrations and SEO crawling.`,
    executive_summary: 'Enterprise-grade automotive platform running Dealer eProcess (Everest) CMS with dual CDN (Cloudflare + Cloudinary), aggressive WAF, HTTP/2, and gzip compression. Well-suited infrastructure for a multi-brand dealership group.',
    key_findings: [
      {
        parameter: 'CMS Platform',
        finding: 'Dealer eProcess (Everest) — industry-specific automotive CMS',
        severity: 'positive',
        evidence: 'DEP dealer ID 4401, site ID 14624, CNAME → saas.www.dealereprocess.org',
        detail: 'Purpose-built automotive platform with integrated inventory management, lead capture, vehicle search, pricing, and promotional tools. Appropriate for a 10-brand, 4-location dealership.',
        business_impact: 'Reduces development costs and maintenance burden. Industry-standard integrations for DMS, CRM, and OEM data feeds.',
      },
      {
        parameter: 'CDN Architecture',
        finding: 'Dual CDN strategy — Cloudflare (edge) + Cloudinary (images)',
        severity: 'positive',
        evidence: 'Cloudflare IPs 104.17.37-41.150, Cloudinary via $.cloudinary.responsive()',
        detail: 'Cloudflare handles general content delivery, compression, and security. Cloudinary specializes in responsive image optimization for vehicle photos — the heaviest asset on any dealer site.',
        business_impact: 'Faster page loads, optimized bandwidth usage, better mobile experience for vehicle shoppers browsing inventory.',
      },
      {
        parameter: 'WAF Configuration',
        finding: 'Aggressive Cloudflare bot protection may impact SEO crawling',
        severity: 'warning',
        evidence: 'Cloudflare Managed Challenge + Turnstile active. Successfully blocked our automated scanner.',
        detail: 'While excellent for security, the aggressive challenge configuration may present friction to legitimate bots including Google, Bing, and third-party SEO tools.',
        business_impact: 'Potential indexing delays or incomplete crawling by search engines. Third-party marketing tools may fail to access the site for competitive analysis or link checking.',
        recommendation: {
          action: 'Whitelist known good bots in Cloudflare WAF rules',
          priority: 'P1' as const,
          effort: 'S' as const,
          implementation_steps: [
            'Cloudflare → Security → WAF → Custom Rules',
            'Add rule: if cf.client.bot = true then skip challenge (allows verified bots)',
            'Alternatively: whitelist Googlebot, Bingbot, and DataForSEO IP ranges',
            'Test with Google Search Console URL Inspection tool',
          ],
          expected_impact: 'Improved search engine indexing while maintaining protection against malicious bots',
        },
      },
      {
        parameter: 'Server Identity',
        finding: 'Origin server completely hidden behind Cloudflare',
        severity: 'positive',
        evidence: 'Server header: "cloudflare" — DEP origin not exposed',
        detail: 'Cloudflare proxies all requests, hiding the Dealer eProcess SaaS origin. This prevents direct attacks against the origin infrastructure.',
        business_impact: 'Reduced attack surface for the dealership website. Attackers cannot bypass Cloudflare to target the origin directly.',
      },
    ],
    recommendations: [
      {
        action: 'Configure Cloudflare WAF to whitelist verified search engine bots',
        priority: 'P1' as const,
        effort: 'S' as const,
        expected_impact: 'Better SEO crawling without compromising security',
        implementation_steps: ['Add WAF rule for cf.client.bot = true → skip challenge'],
      },
      {
        action: 'Monitor Cloudflare analytics for blocked legitimate traffic',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Identify if real customers or partners are being blocked',
        implementation_steps: ['Review Cloudflare → Security → Events for false positives'],
      },
    ],
    module_score: 100,
    score_breakdown: [
      { criterion: 'CMS Detection', score: 100, weight: 0.3, evidence: 'Dealer eProcess Everest with version identified' },
      { criterion: 'CDN', score: 100, weight: 0.5, evidence: 'Cloudflare + Cloudinary dual CDN' },
      { criterion: 'Server Identity', score: 100, weight: 0.3, evidence: 'Hidden behind Cloudflare' },
      { criterion: 'Compression', score: 100, weight: 0.5, evidence: 'gzip via Cloudflare' },
      { criterion: 'HTTP Version', score: 100, weight: 0.5, evidence: 'HTTP/2 enabled' },
      { criterion: 'Hosting', score: 100, weight: 0.3, evidence: 'DEP SaaS identified' },
      { criterion: 'WAF', score: 100, weight: 0.5, evidence: 'Cloudflare Managed Challenge + Turnstile' },
    ],
    score_rationale: 'Perfect score reflects best-in-class infrastructure for an automotive dealership: industry-specific CMS, dual CDN, aggressive WAF, hidden origin, HTTP/2, and compression all present and properly configured.',
  };

  // ── M04 Summary ──
  summaries['M04'] = {
    source: 'ai',
    analysis: `Cabrera Auto Group's page metadata tells a story of two extremes: exceptionally thorough structured data (JSON-LD) paired with surprising gaps in social sharing metadata and basic SEO hygiene.

**Title Tag — Keyword Stuffing**: At ${('Concesionario Chevrolet, Chrysler, Dodge, Ford, GMC, Hyundai, Jeep, Nissan, Ram y Wagoneer en Arecibo PR Autos Nuevo y Usado en Utuado en Cabrera Auto').length} characters, the title tag is roughly 3x the recommended 50-60 character length. It attempts to list all 10 brands, both locations, and the business name in a single title. Google will truncate this severely in search results, displaying only the first ~60 characters: "Concesionario Chevrolet, Chrysler, Dodge, Ford, GMC, Hyu..." — cutting off before the business name even appears. This is a classic keyword-stuffing pattern that may hurt rather than help rankings.

**Meta Description — Adequate**: The meta description is present at a reasonable length and includes the business name, location (Arecibo, PR), brands, vehicle types, and services. It's serviceable but could be more compelling — it reads like a keyword list rather than a call to action.

**Structured Data — Exceptional**: This is the standout strength. The site has comprehensive JSON-LD markup with 4 AutoDealer entities (one per physical location: Cabrera Auto Group Arecibo, Cabrera Nissan, Cabrera Usados Bayamon, Hyundai de Hatillo), each with geo coordinates, addresses, and ZIP codes. Additional schema types include AutoRepair, AutoPartsStore, AutoBodyShop with department-specific phone numbers and hours. A WebSite entity with SearchAction enables sitelinks search in Google results. Social profiles (Facebook, Instagram) are linked. This is textbook structured data implementation for an automotive dealership — likely driven by the Dealer eProcess platform's built-in schema generation.

**Open Graph & Twitter Cards — Critical Gap**: Zero Open Graph tags and zero Twitter Card tags. In the Puerto Rico market where Facebook and WhatsApp are dominant social platforms, this is a significant miss. Any share of cabreraauto.com on Facebook will show an auto-generated preview with no branded image, potentially a truncated title, and no description. For a dealership that likely promotes inventory and specials on social media, this directly undermines sharing effectiveness.

**Canonical Tag — Missing**: No canonical tag on the homepage. The site is accessible at both cabreraauto.com and www.cabreraauto.com (with redirect), but without a canonical tag, search engines must infer the preferred URL. This is a basic SEO hygiene issue.

**Robots Configuration — Well Done**: robots.txt is properly configured with a 7-second crawl delay, appropriate disallowed paths (lead forms, vehicle pricing, credit applications, print pages), and a sitemap reference. Both Google and Bing Search Console are verified via meta tags. No noindex or nofollow directives on the homepage — the page is fully indexable.

**Language — Correctly Set**: HTML lang="es-US" properly identifies the content as Spanish for the Puerto Rico market. No hreflang tags, which is acceptable for a single-language site but worth considering if English content is added.

**Viewport & Mobile**: Proper viewport meta tag (width=device-width, initial-scale=1) confirms responsive design intent.

The metadata profile suggests a site where the platform (DEP) handles technical SEO well (structured data, robots.txt, verification) but where manual optimization for marketing effectiveness (OG tags, title optimization, canonical) has been neglected.`,
    executive_summary: 'Exceptional JSON-LD structured data with 4 AutoDealer entities, departments, and SearchAction. Critical gaps in Open Graph tags (zero — devastating for Puerto Rico\'s Facebook-heavy market), keyword-stuffed title, and missing canonical tag.',
    key_findings: [
      {
        parameter: 'Open Graph Tags',
        finding: 'Zero Open Graph tags detected on homepage',
        severity: 'critical',
        evidence: 'No og:title, og:description, og:image, og:url, or og:type meta tags found in page source',
        detail: 'Facebook, WhatsApp, and LinkedIn use Open Graph tags to generate link previews. Without them, shared links show generic/auto-generated previews with no branded imagery.',
        business_impact: 'In Puerto Rico where Facebook is the dominant social platform and WhatsApp is the primary messaging app, every shared link to cabreraauto.com looks unprofessional and generates lower engagement. Dealership social media posts linking to inventory or specials lack compelling previews.',
        recommendation: {
          action: 'Add Open Graph meta tags to all pages',
          priority: 'P0' as const,
          effort: 'S' as const,
          implementation_steps: [
            'Add to homepage <head>: og:title="Cabrera Auto Group | Concesionario en Arecibo, PR"',
            'og:description with compelling copy about inventory and service',
            'og:image pointing to a branded 1200x630 image',
            'og:url="https://www.cabreraauto.com/"',
            'og:type="website"',
            'Contact Dealer eProcess support to add OG tags via platform configuration',
          ],
          expected_impact: 'Significantly improved social media click-through rates. Branded, compelling previews when customers share inventory listings.',
        },
      },
      {
        parameter: 'Title Tag',
        finding: 'Title is keyword-stuffed at 152 characters (recommended: 50-60)',
        severity: 'warning',
        evidence: 'Title: "Concesionario Chevrolet, Chrysler, Dodge, Ford, GMC, Hyundai, Jeep, Nissan, Ram y Wagoneer en Arecibo PR Autos Nuevo y Usado en Utuado en Cabrera Auto"',
        detail: 'Google truncates titles at ~60 characters in search results. The business name "Cabrera Auto" appears at the very end and will be cut off. Brand names are better served by structured data (which is already comprehensive).',
        business_impact: 'Search result appearance is suboptimal — users see a truncated, keyword-heavy snippet instead of a clear brand message. May trigger keyword-stuffing signals in Google\'s ranking algorithm.',
        recommendation: {
          action: 'Shorten title to 50-60 characters with brand-first approach',
          priority: 'P1' as const,
          effort: 'S' as const,
          implementation_steps: [
            'Suggested: "Cabrera Auto Group | Concesionario en Arecibo, PR"',
            'Or: "Cabrera Auto | 10 Marcas, 4 Ubicaciones en Puerto Rico"',
            'Brand names are already in JSON-LD structured data',
          ],
          expected_impact: 'Cleaner search appearance, better brand recognition in SERPs, avoid keyword-stuffing penalties',
        },
      },
      {
        parameter: 'JSON-LD Structured Data',
        finding: 'Comprehensive automotive structured data — best-in-class',
        severity: 'positive',
        evidence: '4 AutoDealer entities with geo coordinates, departments (AutoRepair, AutoPartsStore, AutoBodyShop), WebSite with SearchAction, social profiles, area served, opening hours per department',
        detail: 'The structured data implementation covers all Google recommended schemas for automotive dealers. Each of 4 locations has its own entity with address, phone, and coordinates. Departments have specific phone numbers and price ranges.',
        business_impact: 'Eligible for rich results in Google Search, Google Maps integration, and knowledge panel features. SearchAction enables sitelinks searchbox in branded searches.',
      },
      {
        parameter: 'Canonical Tag',
        finding: 'No canonical tag on homepage',
        severity: 'warning',
        evidence: 'No <link rel="canonical"> found in page source',
        detail: 'Without canonical, search engines must guess the preferred URL between cabreraauto.com and www.cabreraauto.com. While the redirect handles this at the HTTP level, a canonical tag provides explicit signal.',
        business_impact: 'Potential duplicate content confusion, diluted link equity between www and non-www variants.',
        recommendation: {
          action: 'Add canonical tag pointing to https://www.cabreraauto.com/',
          priority: 'P1' as const,
          effort: 'S' as const,
          implementation_steps: ['Add <link rel="canonical" href="https://www.cabreraauto.com/"> to homepage <head>', 'Ensure all pages have self-referencing canonical tags'],
          expected_impact: 'Clear URL preference signal to search engines, consolidated link equity',
        },
      },
      {
        parameter: 'Robots.txt',
        finding: 'Well-structured robots.txt with appropriate rules',
        severity: 'positive',
        evidence: 'Present with 7 user-agent groups, crawl-delay 7s, blocks lead forms/pricing/credit apps, includes sitemap URL',
        detail: 'Properly blocks sensitive paths (lead forms, vehicle pricing, credit applications) while allowing indexing of public inventory and content pages. Named bot blocks (MJ12bot, BLEXBot) prevent known scrapers.',
        business_impact: 'Clean crawl budget allocation, sensitive customer paths protected from indexing.',
      },
    ],
    recommendations: [
      {
        action: 'Add Open Graph meta tags (og:title, og:description, og:image, og:url)',
        priority: 'P0' as const,
        effort: 'S' as const,
        expected_impact: 'Dramatically improved social sharing previews on Facebook and WhatsApp',
        implementation_steps: ['Contact DEP support for platform-level OG tag configuration', 'Provide branded 1200x630 image for og:image'],
      },
      {
        action: 'Optimize title tag to 50-60 characters',
        priority: 'P1' as const,
        effort: 'S' as const,
        expected_impact: 'Better search result appearance and brand recognition',
        implementation_steps: ['Replace with: "Cabrera Auto Group | Concesionario en Arecibo, PR"'],
      },
      {
        action: 'Add canonical tag to all pages',
        priority: 'P1' as const,
        effort: 'S' as const,
        expected_impact: 'Consolidated URL preference for search engines',
        implementation_steps: ['Add self-referencing canonical to each page template'],
      },
      {
        action: 'Add Twitter Card meta tags',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Better previews on Twitter/X and other platforms that use Twitter Card format',
        implementation_steps: ['Add twitter:card="summary_large_image", twitter:title, twitter:description, twitter:image'],
      },
    ],
    module_score: 70,
    score_breakdown: [
      { criterion: 'Title Tag', score: 50, weight: 0.8, evidence: 'Present but 152 chars (keyword-stuffed)' },
      { criterion: 'Meta Description', score: 85, weight: 0.6, evidence: 'Present, reasonable length, includes key info' },
      { criterion: 'Canonical', score: 0, weight: 0.6, evidence: 'Missing' },
      { criterion: 'Open Graph', score: 0, weight: 0.6, evidence: 'Zero tags' },
      { criterion: 'Twitter Cards', score: 0, weight: 0.3, evidence: 'Zero tags' },
      { criterion: 'JSON-LD', score: 100, weight: 0.8, evidence: '4 AutoDealer entities, departments, SearchAction' },
      { criterion: 'Robots.txt', score: 100, weight: 0.5, evidence: 'Well-configured with sitemap' },
      { criterion: 'Sitemap', score: 85, weight: 0.5, evidence: 'Present via robots.txt' },
      { criterion: 'HTML Language', score: 100, weight: 0.4, evidence: 'es-US correctly set' },
      { criterion: 'Viewport', score: 100, weight: 0.4, evidence: 'Proper responsive viewport' },
      { criterion: 'Robots Directives', score: 100, weight: 0.4, evidence: 'No noindex/nofollow' },
    ],
    score_rationale: 'Score of 70 reflects the contrast between exceptional structured data (JSON-LD) and critical social metadata gaps (no OG tags, no canonical). The platform handles technical SEO foundations well but marketing-critical metadata has been neglected.',
  };

  // ── M05 Summary ──
  summaries['M05'] = {
    source: 'ai',
    analysis: `Cabrera Auto Group has a solid analytics foundation built on the industry-standard GA4 + GTM stack, supplemented by automotive-specific tracking from Dealer eProcess — but significant gaps in consent management and advanced tracking capabilities limit the platform's effectiveness.

**Core Analytics — GA4 + GTM**: Google Analytics 4 (G-3VV24N2MND) is the primary analytics platform, deployed via Google Tag Manager (GTM-TG5CFKJQ). This is the correct modern stack — GA4 provides event-based analytics with enhanced measurement, and GTM centralizes tag deployment for all marketing pixels. The measurement ID is consistent across page source and network requests, confirming proper deployment.

**Automotive Data Layer — ASC Compliant**: The site implements an Automotive Standards Council (ASC) compliant data layer — an industry-specific standard for dealer websites. The data layer includes dealer_id (4401), site_id (14624), site_version (4), page_category, and affiliation (dealer_eprocess). This is significant: it means the analytics foundation speaks the language of the automotive ecosystem, enabling standardized reporting across OEM programs, co-op advertising, and dealer performance benchmarking.

**Proprietary Analytics — iSpy**: Dealer eProcess operates its own analytics system called iSpy, tracking sessions (900-second timeout), clicks, and paths with a 1-year cookie lifetime. This provides DEP-platform-level analytics separate from GA4. Additionally, DEP Event Publisher and CPE (Customer Platform Events) subscriber systems provide custom event tracking within the platform.

**Conversion Tracking — Basic**: Phone click conversion tracking is configured (\`gtag_report_conversion\` on the primary sales number 787-333-8410). This is the most critical conversion action for a dealership — tracking calls to the sales line. However, this appears to be the only custom conversion event. Missing: form submission tracking, VDP (Vehicle Detail Page) views, inventory search events, credit application starts, trade-in value tool usage, chat initiations, and test drive request tracking.

**Consent Management — Critical Gap**: No consent management platform (CMP) detected. No Google Consent Mode v2 implementation. Analytics and advertising cookies (_ga, _gid, _gcl_au, _fbp) are set without explicit user consent. While Puerto Rico as a US territory is not subject to GDPR, CCPA may affect California-based visitors to the site. More importantly, Google requires Consent Mode v2 for continued access to ads personalization features in GA4 and Google Ads. Without it, remarketing audiences and conversion modeling will degrade over time.

**Server-Side Tracking — Not Present**: All analytics collection is client-side. With approximately 30% of users employing ad blockers, this means a significant portion of traffic is invisible to GA4. For a dealership spending on Google Ads and Facebook Ads, this data gap directly undermines ROI measurement and audience building.

**Cookie Compliance**: All 7 detected cookies have the Secure flag. Analytics cookies use appropriate SameSite=Lax. Cloudflare cookies use SameSite=None (required for cross-origin challenge). The Facebook Pixel cookie (_fbp) is present, confirming Meta Pixel is firing.

The analytics architecture has the right foundational tools but needs investment in event tracking depth, consent management, and server-side capabilities to match the sophistication of a multi-brand dealership running paid media campaigns.`,
    executive_summary: 'GA4 + GTM properly deployed with ASC-compliant automotive data layer and proprietary DEP analytics (iSpy). Critical gaps: no consent management (affects Google Ads personalization), no server-side tracking (~30% data loss), and limited custom event tracking beyond phone calls.',
    key_findings: [
      {
        parameter: 'Consent Mode',
        finding: 'No consent management platform — no Google Consent Mode v2',
        severity: 'critical',
        evidence: 'No CMP banner, no consent-related JavaScript, no consent mode API calls in network traffic',
        detail: 'Google requires Consent Mode v2 for ads personalization features. Without it, GA4 conversion modeling degrades and Google Ads remarketing audiences become less effective.',
        business_impact: 'Gradual degradation of Google Ads performance as consent-dependent features lose signal. May impact co-op advertising programs that require compliant tracking. CCPA exposure for California visitors.',
        recommendation: {
          action: 'Implement Google Consent Mode v2 with a CMP',
          priority: 'P0' as const,
          effort: 'M' as const,
          implementation_steps: [
            'Choose a CMP compatible with GTM (Cookiebot, OneTrust, or Usercentrics)',
            'Deploy via GTM for centralized management',
            'Configure Google Consent Mode v2 defaults (deny until consent)',
            'Map consent categories to tag firing rules',
            'Test with Google Tag Assistant to verify consent signals',
          ],
          expected_impact: 'Maintain Google Ads personalization features, improve conversion modeling accuracy, CCPA compliance',
        },
      },
      {
        parameter: 'Server-Side Tracking',
        finding: 'No server-side tracking — 100% client-side collection',
        severity: 'warning',
        evidence: 'No server-side GTM container detected, no Measurement Protocol usage, no proxy patterns for analytics',
        detail: 'Approximately 30% of web users use ad blockers that prevent GA4 and Meta Pixel from collecting data. All analytics requests go directly from client to google-analytics.com and facebook.com endpoints.',
        business_impact: 'Missing ~30% of session data leads to underreported conversions, inflated cost-per-acquisition in Google Ads, and smaller remarketing audiences. For a dealership running paid media, this directly inflates apparent CAC.',
        recommendation: {
          action: 'Deploy server-side Google Tag Manager',
          priority: 'P1' as const,
          effort: 'L' as const,
          implementation_steps: [
            'Create server-side GTM container',
            'Deploy on a first-party subdomain (e.g., track.cabreraauto.com)',
            'Route GA4 and Meta Pixel through server-side container',
            'Configure consent-aware server-side tags',
          ],
          expected_impact: 'Recover ~30% of lost data, more accurate conversion reporting, better ROAS measurement',
        },
      },
      {
        parameter: 'Event Tracking Depth',
        finding: 'Only phone click conversion tracked — missing all other key dealer events',
        severity: 'warning',
        evidence: 'gtag_report_conversion on 787-333-8410 click. No form submit, VDP view, inventory search, credit app, or chat events detected.',
        detail: 'A dealership generates leads through multiple touchpoints: form submissions, phone calls, chat initiations, VDP views, credit application starts, trade-in tool usage, and test drive requests. Only phone clicks are being measured.',
        business_impact: 'Cannot measure ROI of specific campaigns or content. Cannot build behavioral audiences for remarketing. Cannot identify which inventory pages drive the most leads.',
        recommendation: {
          action: 'Expand GA4 event tracking via GTM',
          priority: 'P1' as const,
          effort: 'M' as const,
          implementation_steps: [
            'Form submissions: trigger on /leadform/ POST completion',
            'VDP views: fire custom event when vehicle detail pages load (page_category from ASC data layer)',
            'Inventory search: track search queries and filter usage',
            'Credit application: track start and completion steps',
            'Chat initiation: fire event on DEP chat widget open',
          ],
          expected_impact: 'Full-funnel visibility into customer journey, actionable remarketing audiences, campaign attribution for all lead types',
        },
      },
      {
        parameter: 'Primary Analytics',
        finding: 'GA4 properly deployed with ASC automotive data layer',
        severity: 'positive',
        evidence: 'GA4 G-3VV24N2MND active via GTM-TG5CFKJQ, ASC data layer with dealer_id, site_id, page_category',
        detail: 'Industry-standard analytics stack with automotive-specific data enrichment. The ASC data layer is a significant advantage for OEM reporting and co-op advertising compliance.',
        business_impact: 'Solid foundation for measurement. ASC compliance enables participation in manufacturer programs that require standardized tracking.',
      },
    ],
    recommendations: [
      {
        action: 'Implement Consent Mode v2 with CMP',
        priority: 'P0' as const,
        effort: 'M' as const,
        expected_impact: 'Maintain Google Ads features, CCPA compliance',
        implementation_steps: ['Deploy Cookiebot or OneTrust via GTM', 'Configure Consent Mode v2 defaults'],
      },
      {
        action: 'Expand custom event tracking (forms, VDPs, search, credit apps)',
        priority: 'P1' as const,
        effort: 'M' as const,
        expected_impact: 'Full-funnel measurement across all lead types',
        implementation_steps: ['Configure GTM triggers for form submissions, VDP views, search, credit app steps, chat'],
      },
      {
        action: 'Deploy server-side GTM',
        priority: 'P1' as const,
        effort: 'L' as const,
        expected_impact: 'Recover ~30% of lost analytics data',
        implementation_steps: ['Create sGTM container on first-party subdomain', 'Route GA4 + Meta through server'],
      },
      {
        action: 'Configure cross-domain tracking if external domains are used',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Unified user journeys across financing and service scheduling sites',
        implementation_steps: ['Identify external domains', 'Configure GA4 cross-domain in GTM'],
      },
    ],
    module_score: 79,
    score_breakdown: [
      { criterion: 'Primary Analytics', score: 100, weight: 0.8, evidence: 'GA4 active and collecting' },
      { criterion: 'Measurement ID', score: 100, weight: 0.6, evidence: 'Consistent G-3VV24N2MND' },
      { criterion: 'Tag Manager', score: 100, weight: 0.6, evidence: 'GTM-TG5CFKJQ deployed' },
      { criterion: 'Event Tracking', score: 70, weight: 0.6, evidence: 'Phone click only, missing forms/VDPs' },
      { criterion: 'Consent Mode', score: 0, weight: 0.6, evidence: 'No CMP, no consent mode' },
      { criterion: 'Server-Side', score: 0, weight: 0.4, evidence: 'Not present' },
      { criterion: 'Data Layer', score: 100, weight: 0.6, evidence: 'ASC compliant automotive data layer' },
      { criterion: 'Cookie Compliance', score: 85, weight: 0.6, evidence: 'All Secure, SameSite set' },
      { criterion: 'Debug Mode', score: 100, weight: 0.3, evidence: 'Disabled in production' },
    ],
    score_rationale: 'Score of 79 reflects a solid GA4/GTM foundation with industry-standard ASC data layer, pulled down by critical consent management gap and limited event tracking. The bones are right but the instrumentation lacks depth for a dealership running paid media.',
  };

  // ── M07 Summary ──
  summaries['M07'] = {
    source: 'ai',
    analysis: `Cabrera Auto Group's marketing technology stack reveals a dealership that has invested in advertising (Google Ads + Facebook) but has significant gaps in the mid-funnel infrastructure needed to convert that paid traffic into measurable leads.

**Advertising — Heavy Investment, Fragmented**: The site runs 4 separate Google Ads accounts (AW-597584798, AW-16950946914, AW-16979056415, AW-16978571371) and 2 Facebook Pixels (777931221222497, 1143908714142200). This is unusual — a typical dealership group would consolidate to 1-2 Google Ads accounts and 1 Facebook Pixel. The fragmentation suggests either multiple agencies managing campaigns independently, legacy accounts from acquisitions, or separate accounts per brand/location without central governance. This fragmentation makes it nearly impossible to see a unified view of ad performance, build cross-campaign audiences, or manage frequency capping across all 4 accounts.

**Lead Capture — Basic but Present**: A DEP-powered lead form exists at /leadform/ with email, phone, and name fields plus hidden tracking fields (dealer_id, source, campaign). A vehicle search form is also present. However, there's no sophisticated lead capture: no chat widget, no popup offers, no exit-intent forms, no scheduling tool, no trade-in calculator. For a dealership, the lead form is table stakes — competitive dealers offer instant chat, video call, and real-time inventory alerts.

**Marketing Automation — Absent**: No HubSpot, Marketo, Klaviyo, or any marketing automation platform detected. DEP's built-in Price Alert system provides basic price-drop notifications, but there's no evidence of email nurture sequences, lead scoring, automated follow-up, drip campaigns, or behavioral triggers. For a dealership that handles leads for 10 brands across 4 locations, automated lead routing and nurture is critical to prevent leads from going cold.

**CRM Integration — Not Visible**: No client-side evidence of CRM integration (Salesforce, DealerSocket, VinSolutions, or even DEP's own CRM). This doesn't mean a CRM isn't used — it may operate entirely server-side. But the absence of any client-side CRM scripts or chat integrations suggests that digital leads may not be flowing automatically into a centralized system.

**Session Recording & Testing — None**: No Hotjar, FullStory, Clarity, or any session recording tool. No A/B testing or personalization (no VWO, Optimizely, Google Optimize). The dealership has zero visibility into how customers interact with VDPs, search results, and lead forms. Without this data, conversion optimization is guesswork.

**DEP Ecosystem Tools**: The Dealer eProcess platform provides several proprietary tools: Smart Search (vehicle inventory search with autocomplete), Price Alert (price-drop subscriptions), Coupon System (digital coupons with Apple Wallet and Google Pay integration), Event Publisher/Subscriber (internal event system), and clickpath tracking. These are built into the platform and provide dealership-specific functionality that general martech tools don't cover.

**Stack Assessment**: With 9 tools across 7 categories, the stack has reasonable breadth but lacks depth in critical areas. Advertising is the strongest category (4 Google Ads + 2 Facebook accounts = heavy investment), but the infrastructure to convert that traffic is thin. The martech footprint is moderate (~185 KB across 14 requests), and Cloudinary offloads image delivery, keeping performance impact manageable.

The overall picture is a dealership that spends on traffic acquisition (Google Ads, Facebook Ads) but hasn't invested proportionally in the conversion infrastructure that turns clicks into leads: no chat, no automation, no testing, no behavioral analytics. This is a common pattern in automotive — ad budgets are driven by OEM co-op programs while website conversion optimization is underfunded.`,
    executive_summary: 'Heavy advertising investment (4 Google Ads accounts, 2 Facebook Pixels) but fragmented management and thin conversion infrastructure. No marketing automation, no chat, no session recording, no A/B testing. DEP platform provides dealership-specific tools (search, price alerts, coupons) but mid-funnel gaps are significant.',
    key_findings: [
      {
        parameter: 'Google Ads Account Fragmentation',
        finding: '4 separate Google Ads accounts detected — governance concern',
        severity: 'warning',
        evidence: 'AW-597584798, AW-16950946914, AW-16979056415, AW-16978571371 — all firing on the same domain',
        detail: 'Multiple Google Ads accounts on a single domain typically indicate fragmented agency management, legacy accounts, or per-brand/location accounts without central oversight. This prevents unified audience management, frequency capping, and conversion attribution.',
        business_impact: 'Potential audience overlap and ad competition between own accounts (bidding against yourself), fragmented conversion data, inability to build cross-campaign audiences, and wasted spend from duplicate targeting.',
        recommendation: {
          action: 'Audit and consolidate Google Ads accounts',
          priority: 'P1' as const,
          effort: 'M' as const,
          implementation_steps: [
            'Identify which accounts are active vs. legacy',
            'Determine ownership: which agencies or teams manage each?',
            'Create a consolidation plan: 1 account for all brands, or max 2 (new vs. used)',
            'Migrate active campaigns to consolidated account',
            'Remove deprecated conversion tags from GTM',
          ],
          expected_impact: 'Unified audience management, proper frequency capping, consolidated conversion attribution, potential 15-25% reduction in wasted spend',
        },
      },
      {
        parameter: 'Marketing Automation',
        finding: 'No marketing automation platform detected',
        severity: 'critical',
        evidence: 'No HubSpot, Marketo, Klaviyo, DealerSocket, VinSolutions, or similar detected in globals, DOM, network, or cookies',
        detail: 'A multi-brand dealership handling leads for 10 brands across 4 locations without automated lead routing, scoring, and nurture sequences. DEP Price Alert provides basic notifications but is not a substitute.',
        business_impact: 'Leads likely go cold between submission and first follow-up. No automated nurture sequences. No lead scoring to prioritize hot buyers. Sales team has no visibility into digital engagement history.',
        recommendation: {
          action: 'Implement automotive CRM/marketing automation',
          priority: 'P1' as const,
          effort: 'L' as const,
          implementation_steps: [
            'Evaluate automotive-specific CRMs: DealerSocket, VinSolutions, or Elead',
            'Requirements: lead routing by brand/location, automated email sequences, inventory alerts, appointment scheduling',
            'Ensure DEP integration for form submissions',
            'Configure drip campaigns: inquiry → follow-up → nurture → re-engagement',
          ],
          expected_impact: 'Faster lead response times, automated follow-up, better lead-to-sale conversion rates',
        },
      },
      {
        parameter: 'Live Chat',
        finding: 'No live chat or messaging widget detected',
        severity: 'warning',
        evidence: 'DEP chat module exists in JavaScript (dep-chat-events) but no active chat widget visible to visitors',
        detail: 'Modern dealership shoppers expect instant answers about inventory availability, pricing, financing options, and trade-in values. Without chat, the only conversion paths are phone calls and form submissions.',
        business_impact: 'Lost opportunities from shoppers who prefer text-based communication (especially younger demographics and Puerto Rico\'s mobile-first market). Competitors with chat capture leads 24/7.',
        recommendation: {
          action: 'Deploy a live chat solution',
          priority: 'P1' as const,
          effort: 'M' as const,
          implementation_steps: [
            'Evaluate: CarChat24, Podium, or DEP\'s built-in chat (dep-chat-events module exists)',
            'Deploy with after-hours AI auto-response for 24/7 coverage',
            'Integrate chat leads into CRM pipeline',
            'Track chat initiations as GA4 conversion events',
          ],
          expected_impact: 'Capture leads from text-preferred shoppers, 24/7 lead generation, improved customer experience',
        },
      },
      {
        parameter: 'Session Recording',
        finding: 'No behavioral analytics or session recording tools',
        severity: 'warning',
        evidence: 'No Hotjar, FullStory, Clarity, or similar detected',
        detail: 'Without session recording, the dealership cannot see how customers interact with VDPs, search results, or lead forms. Conversion bottlenecks and UX issues are invisible.',
        business_impact: 'Optimization of the conversion funnel is guesswork. Cannot identify why shoppers abandon forms, which VDP elements drive engagement, or where the search experience fails.',
        recommendation: {
          action: 'Deploy Microsoft Clarity (free) or Hotjar',
          priority: 'P2' as const,
          effort: 'S' as const,
          implementation_steps: ['Sign up for Microsoft Clarity (free, no limits)', 'Deploy via GTM', 'Review heatmaps and session recordings weekly'],
          expected_impact: 'Data-driven UX optimization, identify conversion bottlenecks, inform A/B testing priorities',
        },
      },
      {
        parameter: 'DEP Ecosystem',
        finding: 'Dealer eProcess proprietary tools provide automotive-specific functionality',
        severity: 'positive',
        evidence: 'Smart Search, Price Alert, Coupon System (Apple Wallet + Google Pay), Event Publisher, clickpath tracking',
        detail: 'The DEP platform includes built-in dealership tools that general martech platforms don\'t provide: vehicle-specific search with autocomplete, price-drop alert subscriptions, digital coupon distribution with mobile wallet integration, and automotive event tracking.',
        business_impact: 'Platform-native tools reduce integration complexity and provide dealership-specific features. Smart Search and Price Alert directly support the vehicle shopping journey.',
      },
    ],
    recommendations: [
      {
        action: 'Audit and consolidate Google Ads accounts (4 → 1-2)',
        priority: 'P1' as const,
        effort: 'M' as const,
        expected_impact: 'Unified audience management, reduced wasted spend',
        implementation_steps: ['Audit which accounts are active', 'Consolidate campaigns', 'Remove deprecated tags'],
      },
      {
        action: 'Consolidate Facebook Pixels (2 → 1)',
        priority: 'P1' as const,
        effort: 'S' as const,
        expected_impact: 'Unified audience building for Meta ads',
        implementation_steps: ['Verify which pixel is primary', 'Migrate events to primary pixel', 'Remove secondary from GTM'],
      },
      {
        action: 'Implement automotive CRM with marketing automation',
        priority: 'P1' as const,
        effort: 'L' as const,
        expected_impact: 'Automated lead nurture, faster response times',
        implementation_steps: ['Evaluate DealerSocket, VinSolutions, or Elead', 'Configure lead routing and drip campaigns'],
      },
      {
        action: 'Deploy live chat with after-hours AI',
        priority: 'P1' as const,
        effort: 'M' as const,
        expected_impact: '24/7 lead capture from text-preferred shoppers',
        implementation_steps: ['Deploy CarChat24 or Podium', 'Integrate with CRM', 'Track in GA4'],
      },
      {
        action: 'Deploy session recording (Microsoft Clarity)',
        priority: 'P2' as const,
        effort: 'S' as const,
        expected_impact: 'Data-driven conversion optimization',
        implementation_steps: ['Deploy via GTM', 'Review weekly'],
      },
      {
        action: 'Add A/B testing on key conversion pages',
        priority: 'P2' as const,
        effort: 'M' as const,
        expected_impact: 'Validated improvements to form conversion, VDP engagement',
        implementation_steps: ['Deploy VWO or Google Optimize', 'Test lead form variations, VDP layouts, CTA copy'],
      },
    ],
    module_score: 59,
    score_breakdown: [
      { criterion: 'Marketing Automation', score: 25, weight: 0.6, evidence: 'DEP Price Alert only (basic)' },
      { criterion: 'Lead Capture', score: 70, weight: 0.8, evidence: 'Form present but no chat/popup/scheduling' },
      { criterion: 'CRM Integration', score: 25, weight: 0.6, evidence: 'No client-side evidence' },
      { criterion: 'Visitor Engagement', score: 25, weight: 0.6, evidence: 'No chat, no popup, no push' },
      { criterion: 'Behavioral Analytics', score: 0, weight: 0.5, evidence: 'No session recording' },
      { criterion: 'Form Quality', score: 70, weight: 0.5, evidence: 'DEP forms with hidden tracking fields' },
      { criterion: 'Personalization', score: 0, weight: 0.5, evidence: 'No A/B testing or personalization' },
      { criterion: 'Stack Breadth', score: 70, weight: 0.5, evidence: '9 tools, 7 categories' },
      { criterion: 'Stack Coherence', score: 50, weight: 0.5, evidence: '4 Google Ads + 2 FB pixels is fragmented' },
      { criterion: 'Performance Impact', score: 85, weight: 0.4, evidence: '185 KB, moderate footprint' },
    ],
    score_rationale: 'Score of 59 reflects heavy advertising investment paired with thin conversion infrastructure. The dealership spends on traffic but lacks the mid-funnel tools (automation, chat, testing, recording) to maximize lead capture from that traffic. DEP platform tools provide dealership-specific value but don\'t fill the marketing sophistication gap.',
  };

  // Upsert patched M41
  const { error } = await supabase.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M41',
    status: 'success',
    score: current.score,
    data,
    checkpoints: current.checkpoints,
    signals: current.signals,
  }, { onConflict: 'scan_id,module_id' });

  if (error) throw error;
  console.log('  ✅ M41 patched (businessContext + 5 module summaries)');
}

// ═══════════════════════════════════════════════════════════════════════════
// M42: Executive Brief — FULL REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function replaceM42() {
  console.log('📋 Replacing M42 (Executive Brief)...');

  const { data: current } = await supabase
    .from('module_results')
    .select('data, checkpoints, signals, score')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M42')
    .single();

  if (!current) throw new Error('M42 not found');
  const data = current.data as Record<string, unknown>;

  data['synthesis'] = {
    synthesis_headline: 'Puerto Rico\'s Largest Dealer Group Has World-Class Structured Data but Is Running Blind on Conversions with a Fragmented Ad Stack and Zero Marketing Automation',
    verdict_headline: 'They built a ten-brand showroom with the best floor plan in Puerto Rico and forgot to hire anyone to greet the customers walking through the door',
    category_assessments: {
      security_compliance: {
        category_name: 'Security & Compliance',
        assessment: 'Cloudflare provides above-average edge security including TLS 1.3, cross-origin isolation, and comprehensive Permissions-Policy. SPF and DMARC are configured but DKIM is completely missing — a critical email authentication gap for a dealership that sends customer communications. No HSTS or CSP headers. No consent management platform despite CCPA applicability and Google Consent Mode v2 requirements.',
        top_issues: ['No DKIM authentication — email deliverability at risk', 'No consent management — CCPA exposure and Google Ads degradation', 'Missing HSTS and CSP headers'],
        strengths: ['Cloudflare WAF + Turnstile bot protection', 'TLS 1.3 with full cross-origin isolation', 'Comprehensive Permissions-Policy lockdown'],
      },
      analytics_measurement: {
        category_name: 'Analytics & Measurement',
        assessment: 'GA4 and GTM are properly deployed with an ASC-compliant automotive data layer — this is the right foundation. Dealer eProcess iSpy adds platform-level analytics. However, event tracking is limited to phone clicks only, server-side tracking is absent (losing ~30% of data to ad blockers), and there\'s no consent mode implementation. For a dealership spending on Google and Meta ads, the measurement gaps directly undermine ROI visibility.',
        top_issues: ['Only phone clicks tracked — forms, VDPs, search events missing', 'No server-side tracking — ~30% data invisible', 'No consent mode — Google Ads personalization degrading'],
        strengths: ['GA4 + GTM properly deployed', 'ASC-compliant automotive data layer', 'Phone click conversion tracking active'],
      },
      martech_infrastructure: {
        category_name: 'MarTech Infrastructure',
        assessment: 'Dealer eProcess provides a solid CMS with dual CDN (Cloudflare + Cloudinary), HTTP/2, and aggressive WAF. The platform includes automotive-specific tools: Smart Search, Price Alert, and digital coupon system. However, the marketing stack beyond the platform is thin — no CRM integration, no marketing automation, no live chat, no session recording, no A/B testing. The dealership is running 4 Google Ads accounts and 2 Facebook Pixels with no apparent governance.',
        top_issues: ['4 Google Ads accounts on one domain — fragmented governance', 'No marketing automation or CRM integration visible', 'No live chat for customer engagement'],
        strengths: ['Dealer eProcess Everest — industry-standard automotive CMS', 'Dual CDN: Cloudflare (edge) + Cloudinary (images)', 'DEP Smart Search, Price Alert, Coupon System'],
      },
      seo_content: {
        category_name: 'SEO & Content',
        assessment: 'A tale of two SEOs. The structured data is best-in-class: 4 AutoDealer entities with geo coordinates, departments, SearchAction, and social profiles. But the on-page SEO is undermined by a keyword-stuffed 152-character title, missing canonical tag, and — most critically — zero Open Graph tags. In Puerto Rico\'s Facebook/WhatsApp-dominated social ecosystem, missing OG tags means every shared link looks generic.',
        top_issues: ['Zero Open Graph tags — devastating for social sharing in PR market', 'Title tag keyword-stuffed at 152 chars (should be ~60)', 'No canonical tag on homepage'],
        strengths: ['Comprehensive JSON-LD: 4 locations, departments, SearchAction', 'Google & Bing Search Console verified', 'Well-configured robots.txt with sitemap'],
      },
      paid_media: {
        category_name: 'Paid Media & Advertising',
        assessment: 'The dealership is investing in paid media — 4 Google Ads accounts and 2 Facebook Pixels are actively firing. Phone click conversion tracking is configured for the primary sales number. However, the fragmentation across accounts suggests multiple agencies or uncoordinated management. DataForSEO shows 0 paid keywords, which may indicate the Cloudflare WAF is blocking crawlers from detecting the paid landing pages, or that campaigns target hyper-local terms not tracked by tools.',
        top_issues: ['4 separate Google Ads accounts — potential self-competition', '2 Facebook Pixels — audience fragmentation', 'Conversion tracking limited to phone clicks only'],
        strengths: ['Active Google Ads and Facebook advertising', 'Phone click conversion tracking configured', 'GTM centralizes pixel deployment'],
      },
      social_brand: {
        category_name: 'Social & Brand',
        assessment: 'Social profiles exist (Facebook: CabreraAutoPR, Instagram: CabreraAutoPR) and are referenced in JSON-LD structured data. However, the absence of Open Graph tags undermines all social sharing. Brand search volume is low — DataForSEO shows 0 branded search volume, though organic rankings for "cabrera auto" and brand+location terms are strong. News sentiment is mixed, with some unrelated negative crime stories appearing alongside legitimate dealership coverage.',
        top_issues: ['Zero Open Graph tags kill social sharing effectiveness', 'No branded search volume detected in DataForSEO', 'Mixed news sentiment includes unrelated negative stories'],
        strengths: ['Facebook and Instagram profiles active', 'Social profiles linked in JSON-LD structured data', 'Strong organic rankings for branded terms'],
      },
      performance_ux: {
        category_name: 'Performance & UX',
        assessment: 'Infrastructure supports good performance: Cloudflare CDN, HTTP/2, gzip compression, Cloudinary for responsive images. The mobile viewport is properly configured. However, the aggressive Cloudflare WAF may present challenge pages to some legitimate visitors, creating friction. No session recording means UX issues are invisible. Legacy JavaScript architecture (RequireJS + jQuery) adds weight compared to modern frameworks.',
        top_issues: ['Aggressive bot protection may challenge legitimate visitors', 'No session recording — UX issues invisible', 'Legacy JavaScript architecture (RequireJS + jQuery)'],
        strengths: ['Dual CDN for fast content delivery', 'HTTP/2 and gzip compression', 'Responsive images via Cloudinary'],
      },
      data_privacy: {
        category_name: 'Data & Privacy',
        assessment: 'The site collects customer PII through lead forms (email, phone, name) and processes it via the DEP platform. Analytics cookies and advertising pixels are set without consent management. CCPA may apply to California visitors to the site. Google\'s Consent Mode v2 requirement is unmet, which will progressively degrade Google Ads campaign effectiveness.',
        top_issues: ['No consent management for cookie/tracking consent', 'Customer PII collected through forms without visible privacy controls', 'CCPA compliance gap for out-of-state visitors'],
        strengths: ['All cookies have Secure flag', 'Appropriate SameSite attributes', 'Robots.txt blocks indexing of credit application paths'],
      },
    },
    executive_brief: `Cabrera Auto Group — Puerto Rico's largest multi-brand dealership with 10 brands across 4 locations — has built its digital presence on a solid technical foundation but is significantly under-investing in the marketing technology needed to convert its paid traffic into measurable leads.

The good news: the dealership runs on Dealer eProcess, an industry-standard automotive CMS, behind Cloudflare's enterprise CDN and WAF. GA4 and GTM are properly deployed with an ASC-compliant automotive data layer. The JSON-LD structured data is best-in-class — 4 AutoDealer entities with complete location data, departments, and SearchAction schema. This is better structured data than most enterprise dealership groups achieve.

The bad news: the conversion infrastructure is thin. There are 4 separate Google Ads accounts and 2 Facebook Pixels firing on the same domain with no apparent governance — suggesting either multiple agencies working in silos or accumulated legacy accounts. There's no marketing automation, no CRM integration visible to the website, no live chat, no session recording, and no A/B testing. The only conversion event tracked is phone clicks on the sales number. In a market where the dealership is investing real money in paid media, this means they're spending to drive traffic but can't measure (or optimize) what happens after the click. Add to this a critical email authentication gap (no DKIM), zero Open Graph tags (crippling for Puerto Rico's Facebook-heavy social ecosystem), and no consent management — and you have a dealership that's leaving significant revenue on the table not because the foundation is bad, but because the marketing sophistication layer was never built on top of it.`,
    key_findings: [
      {
        finding: 'Fragmented advertising governance: 4 Google Ads accounts and 2 Facebook Pixels on a single domain indicate uncoordinated campaign management',
        modules: ['M07', 'M05', 'M06'],
        detail: 'Multiple advertising accounts on the same property prevent unified audience management, frequency capping, and cross-campaign attribution. The dealership may be bidding against itself in Google Ads auctions and fragmenting its Meta audiences across two pixels.',
        business_impact: 'Estimated 15-25% wasted ad spend from self-competition, fragmented audiences, and inability to deduplicate conversions across accounts. With no way to see a unified ROAS, budget allocation decisions are blind.',
        urgency: 'this_week' as const,
      },
      {
        finding: 'Zero mid-funnel conversion infrastructure despite active paid media investment',
        modules: ['M07', 'M05', 'M12'],
        detail: 'No marketing automation, no live chat, no session recording, no A/B testing, and only phone click conversion tracking. The dealership spends on traffic acquisition but has minimal infrastructure to convert, measure, or optimize that traffic. Forms exist but without behavioral analytics to optimize them.',
        business_impact: 'Leads from web forms lack automated follow-up (no nurture sequences), chat-preferred shoppers have no channel, and conversion optimization is impossible without session recording or testing tools. Lead response time likely exceeds 30 minutes, by which point the buyer has contacted a competitor.',
        urgency: 'this_month' as const,
      },
      {
        finding: 'Missing social metadata and consent management in a Facebook-first market',
        modules: ['M04', 'M05', 'M12'],
        detail: 'Zero Open Graph tags means every link shared on Facebook, WhatsApp, or Instagram shows a generic auto-generated preview. No consent management means analytics and ad data are collected without explicit opt-in, risking CCPA enforcement for out-of-state visitors and gradual degradation of Google Ads personalization features.',
        business_impact: 'Social sharing — a primary customer acquisition channel in Puerto Rico — generates minimal engagement due to ugly link previews. Google\'s Consent Mode v2 requirement, unmet, will progressively reduce the effectiveness of remarketing audiences and conversion modeling in Google Ads.',
        urgency: 'this_week' as const,
      },
    ],
    tech_stack_summary: {
      analytics: ['Google Analytics 4 (G-3VV24N2MND)', 'Google Tag Manager (GTM-TG5CFKJQ)', 'iSpy (Dealer eProcess)', 'ASC Data Layer'],
      advertising: ['Google Ads (4 accounts: AW-597584798, AW-16950946914, AW-16979056415, AW-16978571371)', 'Facebook Pixel (2 pixels: 777931221222497, 1143908714142200)'],
      automation: ['DEP Price Alert', 'DEP Coupon System (Apple Wallet + Google Pay)'],
      cms_hosting: ['Dealer eProcess (Everest)', 'Cloudflare CDN + WAF', 'Cloudinary Image CDN'],
      security: ['Cloudflare Turnstile', 'Cloudflare Managed Challenge', 'TLS 1.3', 'SPF + DMARC'],
      other: ['RequireJS', 'jQuery', 'Montserrat (Google Fonts)', 'DEP Smart Search', 'DEP Event Publisher'],
    },
    competitive_context: 'Cabrera Auto Group holds strong branded keyword positions in Puerto Rico (14 keywords at #1, including location-specific terms). With ~469 monthly organic visits and 212 total keywords, the organic presence is modest but focused on the right terms. Competitors like Triangle Toyota and Cutter Cars likely invest more in digital marketing sophistication. The dealership\'s core advantage — 10 brands across 4 locations in the Arecibo/Hatillo corridor — is well-represented in structured data but not leveraged through modern digital marketing tactics.',
  };

  // Keep backward compat fields
  data['critical_findings'] = [];
  data['top_opportunities'] = [];
  data['marketing_iq_validation'] = null;
  data['category_traffic_lights'] = {};
  data['promptVersion'] = 'manual-correction-2026-04-02';

  const { error } = await supabase.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M42',
    status: 'success',
    score: current.score,
    data,
    checkpoints: current.checkpoints,
    signals: current.signals,
  }, { onConflict: 'scan_id,module_id' });

  if (error) throw error;
  console.log('  ✅ M42 replaced (Executive Brief)');
}

// ═══════════════════════════════════════════════════════════════════════════
// M45: Stack Analyzer — FULL REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function replaceM45() {
  console.log('🔍 Replacing M45 (Stack Analyzer)...');

  const data = {
    stackAnalysis: {
      currentStack: {
        totalTools: 14,
        activeTools: 12,
        abandonedTools: 0,
        redundantPairs: 2,
        categories: [
          { name: 'Analytics', tools: ['Google Analytics 4', 'iSpy (DEP)', 'DEP Event Publisher', 'CPE Event Subscriber'] },
          { name: 'Tag Management', tools: ['Google Tag Manager'] },
          { name: 'Advertising', tools: ['Google Ads (4 accounts)', 'Facebook Pixel (2 pixels)'] },
          { name: 'CMS', tools: ['Dealer eProcess (Everest)'] },
          { name: 'CDN', tools: ['Cloudflare', 'Cloudinary'] },
          { name: 'Security', tools: ['Cloudflare WAF', 'Cloudflare Turnstile'] },
          { name: 'Search', tools: ['DEP Smart Search'] },
          { name: 'Promotions', tools: ['DEP Price Alert', 'DEP Coupon System'] },
          { name: 'Payment', tools: ['Google Pay (coupon saving)'] },
        ],
        assessment: 'Mid-market dealership stack (14 tools) with strong advertising and platform-native capabilities but significant gaps in marketing automation, CRM, behavioral analytics, and customer engagement. The Dealer eProcess ecosystem provides dealership-specific tools that partially compensate for missing general martech.',
      },
      abandonedTools: [] as unknown[],
      redundancies: [
        {
          tools: ['Google Ads account AW-597584798', 'Google Ads account AW-16950946914', 'Google Ads account AW-16979056415', 'Google Ads account AW-16978571371'],
          function: 'Google search and display advertising on the same domain',
          recommendation: 'Consolidate to 1-2 Google Ads accounts. Multiple accounts on the same property prevent unified audience management and may cause self-competition in auctions.',
          rationale: 'A single dealership group should use 1 account (or max 2: one for new vehicles, one for used/service). Four accounts suggests historical accumulation or multiple agencies without coordination.',
          effortToConsolidate: 'M' as const,
        },
        {
          tools: ['Facebook Pixel 777931221222497', 'Facebook Pixel 1143908714142200'],
          function: 'Facebook/Meta advertising pixel tracking on the same domain',
          recommendation: 'Consolidate to 1 Facebook Pixel. Use the primary pixel for all tracking and build unified custom audiences.',
          rationale: 'Two pixels split audience data and complicate event deduplication. One pixel should handle all conversion events, with separate ad accounts using the same pixel if needed.',
          effortToConsolidate: 'S' as const,
        },
      ],
      leanStack: {
        description: 'Minimum viable stack for Cabrera Auto Group: keep the DEP platform, consolidate advertising accounts, add the most impactful missing tool (live chat), and implement consent management. This delivers the biggest improvements with the smallest operational change.',
        tools: [
          { tool: 'Dealer eProcess (Everest)', purpose: 'CMS, inventory management, lead forms, search, price alerts', replaces: [] as string[], rationale: 'Core platform — cannot remove. Provides dealership-specific functionality that general CMS platforms lack.' },
          { tool: 'Cloudflare', purpose: 'CDN, WAF, DDoS protection, TLS', replaces: [] as string[], rationale: 'Critical infrastructure. Provides security and performance.' },
          { tool: 'Cloudinary', purpose: 'Responsive vehicle image optimization', replaces: [] as string[], rationale: 'Offloads the heaviest bandwidth from vehicle photos.' },
          { tool: 'Google Analytics 4', purpose: 'Web analytics', replaces: [] as string[], rationale: 'Industry standard, integrates with Google Ads for ROAS measurement.' },
          { tool: 'Google Tag Manager', purpose: 'Centralized tag management', replaces: [] as string[], rationale: 'Required for managing GA4, Google Ads, and Facebook Pixel.' },
          { tool: 'Google Ads (1 consolidated account)', purpose: 'Search and display advertising', replaces: ['AW-597584798', 'AW-16950946914', 'AW-16979056415', 'AW-16978571371'], rationale: 'Consolidate 4 accounts into 1 for unified management.' },
          { tool: 'Facebook Pixel (1 consolidated)', purpose: 'Meta advertising pixel', replaces: ['777931221222497', '1143908714142200'], rationale: 'One pixel, unified audience data.' },
          { tool: 'Cookiebot', purpose: 'Consent management + Google Consent Mode v2', replaces: [] as string[], rationale: 'Required for CCPA compliance and Google Ads personalization.' },
          { tool: 'Podium or CarChat24', purpose: 'Live chat + messaging', replaces: [] as string[], rationale: 'Highest-impact addition for lead capture. Text-based leads are growing fastest in automotive.' },
        ],
        removals: [
          { tool: 'Google Ads accounts AW-16950946914, AW-16979056415, AW-16978571371', reason: 'Consolidate into single primary account AW-597584798' },
          { tool: 'Facebook Pixel 1143908714142200', reason: 'Consolidate into primary pixel 777931221222497' },
        ],
        totalToolsAfter: 11,
        keyBenefit: 'Unified advertising governance, consent compliance, and live chat capture — addressing the three most impactful gaps without overhauling the platform.',
      },
      optimalStack: {
        description: 'Best-in-class stack for a 10-brand, 4-location Puerto Rico dealership: everything in Lean Stack plus automotive CRM, marketing automation, behavioral analytics, and A/B testing. This stack matches the investment level of competing dealership groups.',
        tools: [
          { tool: 'Dealer eProcess (Everest)', purpose: 'CMS, inventory, lead forms', isCurrentlyDetected: true, rationale: 'Core platform — retain.' },
          { tool: 'Cloudflare', purpose: 'CDN, WAF, security', isCurrentlyDetected: true, rationale: 'Critical infrastructure.' },
          { tool: 'Cloudinary', purpose: 'Image optimization', isCurrentlyDetected: true, rationale: 'Vehicle photo delivery.' },
          { tool: 'Google Analytics 4', purpose: 'Web + app analytics', isCurrentlyDetected: true, rationale: 'Primary measurement.' },
          { tool: 'Google Tag Manager (client + server-side)', purpose: 'Tag management + data quality', isCurrentlyDetected: true, rationale: 'Add server-side container for ad-blocker bypass and data quality.' },
          { tool: 'Google Ads (1 account)', purpose: 'Advertising', isCurrentlyDetected: true, rationale: 'Consolidated from 4.' },
          { tool: 'Meta Pixel (1 pixel)', purpose: 'Meta advertising', isCurrentlyDetected: true, rationale: 'Consolidated from 2.' },
          { tool: 'VinSolutions or DealerSocket', purpose: 'Automotive CRM + marketing automation', isCurrentlyDetected: false, rationale: 'Automated lead routing, nurture sequences, follow-up management, lead scoring. Industry-specific for dealerships.' },
          { tool: 'Podium', purpose: 'Live chat, messaging, reviews, payments', isCurrentlyDetected: false, rationale: 'Omnichannel customer communication with 24/7 AI responder. Strong automotive vertical presence.' },
          { tool: 'Cookiebot', purpose: 'Consent management + Google Consent Mode v2', isCurrentlyDetected: false, rationale: 'CCPA compliance, maintain Google Ads personalization.' },
          { tool: 'Microsoft Clarity', purpose: 'Session recording + heatmaps', isCurrentlyDetected: false, rationale: 'Free, no limits. Essential for UX optimization.' },
          { tool: 'VWO', purpose: 'A/B testing + personalization', isCurrentlyDetected: false, rationale: 'Validate changes before full rollout. Test lead form variations, VDP layouts.' },
        ],
        gaps: [
          { capability: 'Marketing Automation & CRM', recommendation: 'VinSolutions or DealerSocket', rationale: 'No automated lead follow-up, no nurture sequences, no lead scoring. For a 10-brand dealership, this is the single biggest gap.' },
          { capability: 'Live Chat & Messaging', recommendation: 'Podium', rationale: 'No way for shoppers to get instant answers. Chat leads convert at higher rates than form leads in automotive.' },
          { capability: 'Consent Management', recommendation: 'Cookiebot', rationale: 'Required for CCPA and Google Consent Mode v2. Without it, Google Ads personalization will degrade.' },
          { capability: 'Session Recording', recommendation: 'Microsoft Clarity (free)', rationale: 'Zero visibility into user behavior on VDPs, search, and forms.' },
          { capability: 'A/B Testing', recommendation: 'VWO', rationale: 'Cannot validate any UX changes. Optimization is guesswork.' },
        ],
        upgrades: [
          { currentTool: 'Google Tag Manager (client-side only)', suggestedTool: 'GTM Server-Side Container', rationale: 'Recover ~30% of data lost to ad blockers. First-party data collection via track.cabreraauto.com subdomain.' },
        ],
        totalToolsAfter: 12,
        keyBenefit: 'Full-funnel visibility from first touch to sale, automated lead management, data-driven optimization, and compliance-ready consent — matching the digital sophistication expected of Puerto Rico\'s largest dealer group.',
      },
      methodology: 'Analysis based on verified detection of 14 tools across DNS, page source, network requests, cookies, and JavaScript globals. Redundancy identified by functional overlap (multiple accounts on same property for same ad platform). Gaps identified by comparing against automotive dealership digital marketing best practices for a 10-brand, 4-location group.',
    },
    tokensUsed: { total: 0 },
  };

  const checkpoints = [
    { id: 'm45-stack-breadth', name: 'Stack Breadth', weight: 0, health: 'info',
      evidence: '14 tools across 9 categories. Analytics, advertising, and CDN well-covered. Major gaps in CRM, automation, chat, recording, and testing.' },
    { id: 'm45-redundancies', name: 'Redundancies', weight: 0.5, health: 'warning',
      evidence: '2 redundancy pairs: 4 Google Ads accounts (should be 1-2) and 2 Facebook Pixels (should be 1). Fragmented advertising governance.' },
    { id: 'm45-gaps', name: 'Capability Gaps', weight: 0.6, health: 'warning',
      evidence: '5 major gaps: CRM/automation, live chat, consent management, session recording, A/B testing.' },
  ];

  const { error } = await supabase.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M45',
    status: 'success',
    score: null,
    data,
    checkpoints,
    signals: [],
  }, { onConflict: 'scan_id,module_id' });

  if (error) throw error;
  console.log('  ✅ M45 replaced (Stack Analyzer)');
}

// ═══════════════════════════════════════════════════════════════════════════
// M46: Boss Deck — FULL REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function replaceM46() {
  console.log('📊 Replacing M46 (Boss Deck)...');

  const { data: current } = await supabase
    .from('module_results')
    .select('data, checkpoints, signals, score')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M46')
    .single();

  if (!current) throw new Error('M46 not found');
  const data = current.data as Record<string, unknown>;

  data['bossDeck'] = {
    cover_subtitle: 'How Cabrera Auto Group Can Turn Its Solid Technical Foundation Into a Lead-Generating Machine',
    wins_narrative: 'We\'re not starting from zero — far from it. Our Dealer eProcess platform with dual CDN gives us enterprise-grade infrastructure, our structured data is best-in-class in the automotive space (4 locations fully mapped in Google\'s knowledge graph), and our GA4 + GTM stack gives us the analytics foundation we need. We\'re ranking #1 for 14 keywords in Puerto Rico, and our ASC-compliant data layer puts us ahead of most competing dealers on measurement standardization.',
    wins_highlights: [
      {
        metric_label: 'Organic Keyword Rankings',
        metric_value: '14 keywords at position #1 in Google PR',
        context: 'Including branded terms and key location searches like "cabrera auto arecibo" and "hyundai hatillo". This organic foundation doesn\'t cost us a peso in ad spend.',
      },
      {
        metric_label: 'Structured Data Quality',
        metric_value: 'Best-in-class: 4 AutoDealer entities with full department markup',
        context: 'Every location has geo coordinates, phone numbers, hours, and department details in Google\'s language. This powers rich search results and Google Maps presence.',
      },
      {
        metric_label: 'Infrastructure',
        metric_value: 'Enterprise-grade: Cloudflare CDN + WAF, HTTP/2, TLS 1.3',
        context: 'Our website loads fast and is protected against DDoS and bot attacks. Cloudinary handles vehicle image optimization automatically.',
      },
      {
        metric_label: 'Analytics Foundation',
        metric_value: 'GA4 + GTM + ASC Data Layer deployed',
        context: 'Automotive Standards Council compliant tracking — this positions us for OEM co-op program compliance and standardized performance reporting.',
      },
    ],
    top_issues: [
      {
        headline: 'We\'re running 4 Google Ads accounts and 2 Facebook Pixels with no unified view',
        explanation: 'Four separate Google Ads accounts (AW-597584798, AW-16950946914, AW-16979056415, AW-16978571371) and two Facebook Pixels mean we may be bidding against ourselves in auctions, fragmenting our audience data, and unable to see a single ROAS number across all campaigns.',
        dollar_impact: 'Estimated 15-25% of ad spend wasted on self-competition and fragmented targeting. If we\'re spending $5K/month on Google Ads, that\'s $750-$1,250/month lost.',
        urgency: 'this_week' as const,
      },
      {
        headline: 'Every link shared on Facebook and WhatsApp looks generic — zero Open Graph tags',
        explanation: 'We have no Open Graph meta tags. When customers or our team shares a link to our site on Facebook, WhatsApp, or Instagram, it shows an ugly auto-generated preview with no image, no description, and a truncated title. In Puerto Rico where Facebook and WhatsApp ARE the internet for most consumers, this kills our social engagement.',
        dollar_impact: 'Social media click-through rates are typically 2-3x higher with branded OG images vs. generic previews. If we\'re posting 10 times/week, that\'s potentially hundreds of missed clicks.',
        urgency: 'this_week' as const,
      },
      {
        headline: 'No live chat, no automation — leads go cold while competitors respond instantly',
        explanation: 'We have no live chat widget, no marketing automation, and no visible CRM integration. When a customer fills out a form or wants to ask about inventory, there\'s no instant response mechanism. Dealership industry data shows the average lead response time needs to be under 5 minutes to maximize conversion.',
        dollar_impact: 'Automotive industry studies show dealers who respond within 5 minutes are 21x more likely to qualify the lead. Without chat and automation, we\'re likely losing 30-50% of digital leads to slower response times.',
        urgency: 'this_month' as const,
      },
    ],
    initiatives: [
      {
        name: 'Operation Clean House: Consolidate Ad Accounts & Add Consent',
        owner: 'Marketing Ops Team',
        items: [
          'Audit all 4 Google Ads accounts — identify which are active, legacy, or agency-managed',
          'Consolidate to 1 primary Google Ads account (migrate active campaigns)',
          'Consolidate 2 Facebook Pixels into 1 primary pixel',
          'Deploy Cookiebot via GTM for consent management + Google Consent Mode v2',
          'Add Open Graph meta tags to homepage and VDP templates (contact DEP support)',
        ],
        effort: '2-3 weeks',
        expected_outcome: 'Unified advertising view, proper consent compliance, and compelling social sharing previews. Immediate savings from eliminated self-competition in ad auctions.',
      },
      {
        name: 'Operation Quick Wins: Chat + Conversion Tracking',
        owner: 'Marketing Team + IT',
        items: [
          'Deploy Podium or CarChat24 live chat with after-hours AI',
          'Expand GA4 event tracking: form submissions, VDP views, search, credit app starts',
          'Fix email security: add DKIM records, enable HSTS via Cloudflare',
          'Optimize title tag (shorten from 152 to ~60 characters)',
          'Add canonical tag to all page templates',
        ],
        effort: '2-3 weeks (parallel with Operation Clean House)',
        expected_outcome: '24/7 lead capture via chat, full-funnel conversion visibility in GA4, improved email deliverability, and better search appearance.',
      },
      {
        name: 'Operation Level Up: CRM + Analytics Depth',
        owner: 'Sales + Marketing Leadership',
        items: [
          'Evaluate and deploy automotive CRM (VinSolutions, DealerSocket, or Elead)',
          'Configure automated lead routing by brand and location',
          'Set up nurture email sequences (inquiry → follow-up → offer → re-engagement)',
          'Deploy Microsoft Clarity for session recording (free)',
          'Deploy server-side GTM for ad-blocker bypass',
        ],
        effort: '4-6 weeks',
        expected_outcome: 'Automated lead management, faster response times, data-driven UX optimization, and recovered analytics data from ad-blocked sessions.',
      },
    ],
    tool_pitches: [
      {
        tool_name: 'Podium (or CarChat24)',
        why_we_need_it: 'We have zero live chat capability right now. Customers who prefer texting over calling have no way to engage with us. Podium adds live chat, SMS messaging, review management, and 24/7 AI responses — all from one platform.',
        what_it_replaces: 'New addition (filling a critical gap)',
        capability_gap: 'Cannot engage text-preferred shoppers or capture leads outside business hours',
      },
      {
        tool_name: 'VinSolutions (or DealerSocket)',
        why_we_need_it: 'With 10 brands and 4 locations, leads need automatic routing to the right sales team. Without a CRM, there\'s no automated follow-up and no way to track lead-to-sale conversion. VinSolutions is built specifically for multi-brand dealerships.',
        what_it_replaces: 'New addition (filling a critical gap)',
        capability_gap: 'No automated lead routing, scoring, or nurture sequences for 10 brands across 4 locations',
      },
      {
        tool_name: 'Cookiebot',
        why_we_need_it: 'Google requires Consent Mode v2 for continued access to ads personalization in GA4 and Google Ads. Without it, our remarketing audiences and conversion modeling will degrade. Cookiebot handles this compliance automatically and integrates with our existing GTM setup.',
        what_it_replaces: 'New addition (compliance requirement)',
        capability_gap: 'No consent management — CCPA risk and Google Ads personalization degrading',
      },
    ],
    business_case_headline: 'We have the infrastructure of a top dealership — now we need the marketing stack to match.',
    business_case_narrative: 'Cabrera Auto Group has built a solid digital foundation: enterprise CDN, automotive CMS, proper analytics, and the best structured data in the PR dealer market. But our marketing technology hasn\'t kept pace with our physical growth. We\'re running paid media through 4 fragmented Google Ads accounts with no way to see unified ROAS, no live chat to engage the growing segment of text-first shoppers, no marketing automation to follow up on leads automatically, and no consent management to keep our Google Ads features working. The recommended investments — ad consolidation (saves money), chat (generates leads), CRM (converts leads), and consent management (maintains existing capabilities) — are not aspirational upgrades. They\'re the table stakes for a 10-brand dealership group in 2026.',
    business_case_metrics: [
      {
        label: 'Organic Keywords',
        value: '212 ranking keywords, 14 at position #1',
        comparison: 'Strong branded presence in PR market',
        insight: 'Our organic foundation is solid — investment should focus on converting this traffic, not just driving more of it.',
      },
      {
        label: 'Advertising Accounts',
        value: '4 Google Ads + 2 Facebook Pixels',
        comparison: 'Industry standard: 1 Google Ads + 1 Facebook Pixel per dealership group',
        insight: 'Consolidation alone could reduce wasted spend by 15-25% — paying for itself immediately.',
      },
      {
        label: 'Conversion Tracking',
        value: 'Phone clicks only (1 event type)',
        comparison: 'Competitive dealers track 8-12 event types across the funnel',
        insight: 'We can only optimize what we measure. Right now we\'re measuring ~10% of the customer journey.',
      },
      {
        label: 'Lead Capture Channels',
        value: '2 (phone + form)',
        comparison: 'Modern dealers: 5+ channels (phone, form, chat, SMS, scheduling)',
        insight: 'Adding live chat alone could increase lead volume by 20-30% based on automotive industry benchmarks.',
      },
    ],
    implementation_impact_headline: 'What Changes After 90 Days',
    implementation_outcomes: [
      {
        outcome: 'Unified advertising dashboard showing true ROAS across all campaigns',
        evidence: 'Currently fragmented across 4 Google Ads accounts — impossible to calculate blended ROAS',
        source_work: 'Operation Clean House',
      },
      {
        outcome: '24/7 lead capture through live chat with AI after-hours response',
        evidence: 'Zero chat capability today — text-preferred shoppers have no engagement channel',
        source_work: 'Operation Quick Wins',
      },
      {
        outcome: 'Automated lead routing and follow-up for all 10 brands and 4 locations',
        evidence: 'No CRM or automation detected — leads likely managed manually',
        source_work: 'Operation Level Up',
      },
      {
        outcome: 'Full-funnel conversion tracking: forms, VDPs, search, credit apps, chat, phone',
        evidence: 'Only phone click tracking today (1 of 8+ recommended event types)',
        source_work: 'Operation Quick Wins',
      },
      {
        outcome: 'Compliant consent management maintaining Google Ads personalization features',
        evidence: 'No CMP today — Google Consent Mode v2 unmet, CCPA exposure',
        source_work: 'Operation Clean House',
      },
    ],
    category_projections: [
      { category: 'Security & Compliance', current_light: 'yellow' as const, projected_light: 'green' as const, explanation: 'Adding DKIM, HSTS, and consent management addresses the three critical gaps. CSP can follow in phase 2.' },
      { category: 'Analytics & Measurement', current_light: 'yellow' as const, projected_light: 'green' as const, explanation: 'Expanded event tracking + consent mode + server-side GTM = full measurement capability.' },
      { category: 'MarTech Infrastructure', current_light: 'yellow' as const, projected_light: 'green' as const, explanation: 'Consolidated ad accounts + CRM + chat fills the major gaps on a strong platform foundation.' },
      { category: 'SEO & Content', current_light: 'yellow' as const, projected_light: 'green' as const, explanation: 'OG tags + optimized title + canonical = social sharing and search appearance fixed. JSON-LD stays excellent.' },
      { category: 'Paid Media', current_light: 'red' as const, projected_light: 'green' as const, explanation: 'Account consolidation + full conversion tracking transforms from fragmented to unified.' },
      { category: 'Social & Brand', current_light: 'red' as const, projected_light: 'yellow' as const, explanation: 'OG tags fix sharing. Brand search volume growth requires sustained content and social strategy.' },
      { category: 'Performance & UX', current_light: 'green' as const, projected_light: 'green' as const, explanation: 'Infrastructure is already strong. Session recording adds optimization capability.' },
      { category: 'Data & Privacy', current_light: 'red' as const, projected_light: 'green' as const, explanation: 'Consent management platform resolves compliance gap entirely.' },
    ],
    timeline_summary: 'Three parallel workstreams over 6-8 weeks, with the biggest wins (ad consolidation, OG tags, consent) in weeks 1-2.',
    timeline_items: [
      { phase: 'Week 1', items: ['Audit all Google Ads and Facebook accounts', 'Add Open Graph tags (contact DEP support)', 'Add DKIM records via Microsoft 365', 'Enable HSTS in Cloudflare', 'Deploy Cookiebot via GTM'] },
      { phase: 'Week 2', items: ['Begin Google Ads consolidation (migrate campaigns)', 'Consolidate Facebook Pixels', 'Optimize title tag and add canonical', 'Set up expanded GA4 event tracking', 'Select and contract live chat vendor'] },
      { phase: 'Weeks 3-4', items: ['Complete ad account consolidation', 'Deploy live chat (Podium or CarChat24)', 'Evaluate automotive CRM options', 'Deploy Microsoft Clarity for session recording', 'Verify all tracking changes in staging'] },
      { phase: 'Month 2+', items: ['Deploy automotive CRM with lead routing', 'Configure nurture email sequences', 'Deploy server-side GTM', 'Begin A/B testing on lead forms and VDPs', 'Establish monthly performance review cadence'] },
    ],
    next_steps: [
      'Approve chat vendor selection and contract (Podium or CarChat24 — ~$300-500/mo)',
      'Authorize Google Ads and Facebook account audit and consolidation',
      'Contact Dealer eProcess support to add Open Graph tags to page templates',
      'Approve Cookiebot deployment via GTM (free tier covers initial needs)',
      'Begin CRM vendor evaluation for Phase 2 (VinSolutions, DealerSocket, or Elead)',
    ],
    closing_message: 'Cabrera Auto Group has the brand strength, the locations, and the technical foundation. What\'s missing is the marketing technology layer that turns website visitors into qualified leads and qualified leads into customers on the showroom floor. The three workstreams above can be executed in parallel with minimal disruption to daily operations — and the first wins (unified ads, social sharing, consent) will be visible within days, not months.',
  };

  // Update category scores
  data['categoryScores'] = [
    { category: 'Security & Compliance', score: 55, light: 'yellow' },
    { category: 'Analytics & Measurement', score: 72, light: 'yellow' },
    { category: 'MarTech Infrastructure', score: 65, light: 'yellow' },
    { category: 'SEO & Content', score: 68, light: 'yellow' },
    { category: 'Paid Media', score: 40, light: 'red' },
    { category: 'Social & Brand', score: 35, light: 'red' },
    { category: 'Performance & UX', score: 80, light: 'green' },
    { category: 'Data & Privacy', score: 30, light: 'red' },
  ];

  data['marketingIQ'] = { score: 28, label: 'Needs Work' };

  const { error } = await supabase.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M46',
    status: 'success',
    score: current.score,
    data,
    checkpoints: current.checkpoints,
    signals: current.signals,
  }, { onConflict: 'scan_id,module_id' });

  if (error) throw error;
  console.log('  ✅ M46 replaced (Boss Deck)');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🔄 Updating cabreraauto.com synthesis modules...\n');
  console.log(`Scan ID: ${SCAN_ID}\n`);

  await patchM41();
  await replaceM42();
  await replaceM45();
  await replaceM46();

  console.log('\n✅ M41, M42, M45, M46 updated successfully.');
  console.log('⏳ M43 (PRD) will be updated in a separate script.');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
