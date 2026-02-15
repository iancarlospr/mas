<div align="center">

```
                          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                     ░░░░░                                       ░░░░░
                  ░░░░    ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗    ░░░░
               ░░░░       ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝       ░░░░
             ░░░          ██║  ███╗███████║██║   ██║███████╗   ██║            ░░░
            ░░            ██║   ██║██╔══██║██║   ██║╚════██║   ██║             ░░
           ░░             ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║              ░░
          ░░               ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝               ░░
         ░░              ███████╗ ██████╗ █████╗ ███╗   ██╗                        ░░
         ░░              ██╔════╝██╔════╝██╔══██╗████╗  ██║                        ░░
         ░░              ███████╗██║     ███████║██╔██╗ ██║                        ░░
          ░░             ╚════██║██║     ██╔══██║██║╚██╗██║                       ░░
           ░░            ███████║╚██████╗██║  ██║██║ ╚████║                      ░░
            ░░           ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝                   ░░
             ░░░                                                              ░░░
              ░░░░             .----.      .----.                          ░░░░
                ░░░░          / .--. \    / .--. \                     ░░░░
                  ░░░░░      | | ** | |  | | ** | |                ░░░░░
                     ░░░░░    \ '--' /    \ '--' /             ░░░░░
                        ░░░░░  '----'  /\  '----'          ░░░░░
                           ░░░░░      /  \             ░░░░░
                              ░░░░░  / /\ \        ░░░░░
                                 ░░░/ /  \ \░░░░░░░
                                   / /    \ \
                                  / /      \ \
                                 '-'        '-'
                            i see your cookies.
                            i see your pixels.
                            i see everything.
```

# MarketingAlphaScan

### The $200,000 Marketing Audit. For $9.99.

**Forensic marketing intelligence that would take a McKinsey team 6 weeks — delivered in 90 seconds.**

[![CI](https://github.com/iancarlospr/mas/actions/workflows/ci.yml/badge.svg)](https://github.com/iancarlospr/mas/actions)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## The Problem

Every company with a website is leaking money. Broken analytics. Redundant $40K/yr MarTech tools nobody uses. Tag managers firing into the void. Consent banners that violate three regulations simultaneously. Paid media pixels that stopped working after the last site redesign. And nobody knows — because auditing all of this requires a team of specialists with six-figure salaries, weeks of manual inspection, and access to tools that cost thousands per month.

The marketing ops audit is the most valuable, most underdelivered service in digital. Agencies charge $150K-$250K for it. Internal teams don't have the cross-functional expertise. And the free "website graders" out there check if you have a meta description and call it a day.

**MarketingAlphaScan changes the unit economics of marketing intelligence permanently.**

## What It Actually Does

You enter a URL. Ninety seconds later, you have a forensic audit across **46 analysis modules** spanning 8 scoring categories — the same ground truth a principal marketing technologist would uncover over weeks of manual work.

This isn't a Lighthouse score with a bow on it. This is:

- **Analytics Architecture Forensics** — Is your GA4 measurement ID actually firing? Are your custom events reaching BigQuery, or silently dropping? Is your consent management platform configured for Consent Mode v2, or are you hemorrhaging 40% of your European traffic data?

- **Paid Media Attribution Integrity** — Are your Meta CAPI events deduplicating correctly? Is your Google Ads enhanced conversion tag passing hashed PII? Did your GCLID survive that SPA route change, or is your $500K/yr ad spend flying blind?

- **MarTech Stack X-Ray** — You're paying for HubSpot, Marketo, AND Pardot? Your tag manager has 47 tags and 12 of them are firing on every page load? That abandoned A/B testing tool from 2022 is still injecting 180KB of JavaScript?

- **Compliance and Security Surface** — DMARC policy is set to `none` (hello, spoofing). No HSTS preload. Three consent violations that would cost you $50K each under GDPR. Your cookie banner says "we use cookies" and thinks that's consent.

- **Competitive Intelligence** — How does your traffic, domain authority, paid spend, and keyword portfolio compare to your top 5 competitors? Where are they winning that you're not?

- **AI-Synthesized Executive Brief** — A strategic narrative with prioritized recommendations, ROI projections, and a remediation roadmap. The deliverable your CMO would actually read.

## The 90-Second Scan

Under the hood, a scan isn't a single HTTP request. It's an orchestrated pipeline of **5 sequential phases** executing 46 specialized modules:

```
Phase 1: PASSIVE          7 modules    ~5s     HTTP headers, DNS, HTML parsing
Phase 2: BROWSER         10 modules   ~25s     Real browser session, DOM forensics
Phase 3: GHOSTSCAN        4 modules   ~15s     Deep interaction, accessibility, compliance
Phase 4: EXTERNAL         20 modules  ~20s     Market intelligence enrichment
Phase 5: SYNTHESIS         5 modules  ~25s     AI analysis, scoring, roadmap generation
                          ----------  -----
                          46 modules   ~90s
```

Every module failure is isolated. Nothing cascades. A timeout on one module doesn't kill the next. A rate limit from an external API doesn't stall the browser phase. The scan always completes with whatever intelligence it could gather.

## MarketingIQ Score

Every module produces typed data, scored checkpoints, and confidence-weighted signals. The MarketingIQ composite score weights 8 categories:

| Category | Weight | Modules | What It Measures |
|----------|--------|---------|-----------------|
| **Analytics Integrity** | 20% | M05, M08, M09 | GA4 firing, tag governance, behavioral tracking |
| **Paid Media Attribution** | 18% | M06, M06b, M21, M28, M29 | Pixel health, CAPI, landing page alignment |
| **Performance and UX** | 15% | M03, M13, M14 | Core Web Vitals, carbon footprint, mobile parity |
| **Compliance and Security** | 15% | M01, M10, M11, M12 | DMARC/SPF/DKIM, WCAG 2.1, consent, legal pages |
| **MarTech Efficiency** | 12% | M07, M20 | Tool redundancy, form analytics, SaaS signals |
| **SEO and Content** | 10% | M04, M15, M16, M34, M35, M40 | Metadata, social sharing, PR coverage, keyword gaps |
| **Market Position** | 6% | M24-M33, M36-M39 | Traffic, competitors, domain authority, local SEO |
| **Digital Presence** | 4% | M02, M17-M19, M22, M23 | CMS detection, careers, IR, support, sentiment |

### The Full Module Inventory

<details>
<summary><strong>Phase 1: Passive Analysis</strong> — HTTP-only, no browser required</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M01 | DNS and Security | DMARC, SPF, DKIM, HSTS, TLS grade, CAA records, DNSSEC, security headers, redirect chains |
| M02 | CMS and Infrastructure | CMS/CDN/framework/WAF detection via fingerprint signature matching |
| M04 | Page Metadata | Title, meta descriptions, Open Graph, Twitter Cards, JSON-LD, robots.txt, sitemap, manifest |
| M16 | PR and Media | News coverage, press releases, media mentions |
| M17 | Careers and HR | Job listings, employer branding signals |
| M18 | Investor Relations | SEC filings, IR page detection, earnings signals |
| M19 | Support | Help desk, knowledge base, chatbot detection |

</details>

<details>
<summary><strong>Phase 2: Browser Analysis</strong> — Real browser session with full DOM forensics</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M03 | Performance | Lighthouse metrics, CWV (LCP, CLS, FCP, TTFB), resource waterfall |
| M05 | Analytics | GA4 measurement IDs, data layer events, consent mode, cross-domain, debug mode |
| M06 | Paid Media | Meta/Google/LinkedIn/TikTok pixels, click ID persistence, CAPI detection |
| M06b | PPC Landing Audit | Message match, CTA prominence, form friction, trust signals |
| M07 | MarTech Stack | Tool inventory from network requests, form analytics, automation signals |
| M08 | Tag Governance | TMS detection, tag audit, server-side tagging indicators, data layer quality |
| M13 | Perf and Carbon | Resource breakdown, carbon per pageview, sustainability score |
| M14 | Mobile and Responsive | Viewport parity, touch targets, mobile-specific issues |
| M15 | Social and Sharing | OG/Twitter cards, social link presence, share widget detection |
| M20 | Ecommerce/SaaS | Cart detection, pricing pages, SaaS metrics, checkout flow signals |

</details>

<details>
<summary><strong>Phase 3: GhostScan</strong> — Deep behavioral interaction</summary>

```
        .-.
       (o o)  <-- shhh... i'm in your DOM
       | O |
       /   \      scrolling your pages
      |     |     clicking your buttons
      |     |     reading your cookies
       \   /
    ~~~~`~'~~~~
```

| ID | Module | What It Does |
|----|--------|-------------|
| M09 | Behavioral Intel | Scroll tracking, click heatmap signals, engagement event detection |
| M10 | Accessibility | WCAG 2.1 AA automated checks, color contrast, ARIA, keyboard nav |
| M11 | Console Errors | JavaScript errors, deprecation warnings, SDK failures |
| M12 | Compliance | Privacy policy, ToS, cookie consent, GDPR/CCPA signals |

</details>

<details>
<summary><strong>Phase 4: External Intelligence</strong> — Third-party API enrichment</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M21 | Ad Library | Active ad creatives across Meta, Google, LinkedIn |
| M22 | News Sentiment | Recent news coverage sentiment analysis |
| M23 | Social Sentiment | Social media brand sentiment |
| M24 | Monthly Visits | Estimated monthly traffic volume |
| M25 | Traffic by Country | Geographic traffic distribution |
| M26 | Rankings | Top organic keyword positions |
| M27 | Paid Traffic Cost | Estimated paid search spend |
| M28 | Top Paid Keywords | Highest-spend paid keywords |
| M29 | Competitors | Top organic and paid competitors |
| M30 | Traffic Sources | Channel breakdown (organic, paid, referral, social, direct) |
| M31 | Domain Trust | Domain authority, backlink profile, anchor diversity |
| M32 | Mobile vs Desktop | Traffic device split |
| M33 | Brand Search | Branded keyword volume and trends |
| M34 | Losing Keywords | Declining organic positions |
| M35 | Bounce Rate | Engagement quality metrics |
| M36 | Google Shopping | Product listing ads and merchant center signals |
| M37 | Review Velocity | Review generation rate across platforms |
| M38 | Local Pack | Google Maps/local search presence |
| M39 | Business Profile | Google Business Profile completeness |
| M40 | Sitemap and Indexing | Sitemap health, indexation coverage |

</details>

<details>
<summary><strong>Phase 5: AI Synthesis</strong> — Strategic analysis and recommendations</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M41 | Module Synthesis | Per-module AI summaries with findings, recommendations, evidence |
| M42 | Executive Brief | Strategic narrative, key findings, score rationale |
| M43 | Remediation Roadmap | Prioritized workstream with effort/impact sizing |
| M44 | ROI Simulator | Dollar-value impact projections across cost areas |
| M45 | Cost Cutter | Tool redundancy analysis with annual savings estimate |
| M46 | Knowledge Base | Structured knowledge graph for AI chat context |

</details>

## The Dashboard

Results are presented as a McKinsey-style **slide deck**, not a wall of data tables. Each module renders as a 16:9 aspect-ratio card — a self-contained "slide" with a header bar, scored checkpoints, and detailed evidence.

An Asana-style sidebar provides navigation with scroll sync. Print mode (`Cmd+P`) renders each card as one landscape page. Free tier shows top-level scores with a frosted glass overlay; the paid tier unlocks full evidence, recommendations, and the 4 synthesis slides.

```
+------------------+-----------------------------------------------+
|  LEFT NAV        |  SCROLLABLE CONTENT                           |
|  (240px)         |                                               |
|                  |  +---------------------------------------+    |
|  Overview        |  |    16:9 SLIDE -- MarketingIQ Score     |    |
|                  |  +---------------------------------------+    |
|  ANALYTICS       |                                               |
|    M05  82  [G]  |  +---------------------------------------+    |
|    M08  68  [A]  |  |    16:9 SLIDE -- Analytics (M05)      |    |
|    M09  75  [G]  |  +---------------------------------------+    |
|                  |                                               |
|  PAID MEDIA      |  +---------------------------------------+    |
|    M06  71  [G]  |  |    16:9 SLIDE -- Paid Media (M06)     |    |
|    ...           |  +---------------------------------------+    |
|                  |                                               |
|  [locked] EXEC   |  ...                                          |
|  [locked] ROI    |                                               |
|  [locked] ROADMAP|                                               |
+------------------+-----------------------------------------------+
```

## The Business Model

**Free tier**: Full 46-module scan. See your MarketingIQ score, checkpoint health levels, and detected tools. Enough to know what's broken.

**Paid tier**: Unlock detailed evidence, actionable recommendations, the AI-generated Executive Brief, ROI Simulator, Remediation Roadmap, Cost Cutter analysis, AI Chat, and a shareable PDF report.

The insight-to-price ratio is absurd by design. A single finding from the compliance module ("your DMARC policy is set to `none`") would cost $5,000 to discover through a traditional security audit. The cost cutter module routinely identifies $20K-$80K/yr in redundant MarTech spend.

## Repository Structure

```
apps/web/       Next.js 15 — dashboard, auth, checkout, reports
apps/engine/    Scan engine — module execution, browser automation, AI synthesis
packages/       Shared TypeScript types, email service, email templates
supabase/       Database migrations
e2e/            End-to-end tests
```

## Development

```bash
npm install
npm run dev          # web on :3000, engine on :3001
npm run build        # build all workspaces
npm run typecheck    # TypeScript strict check
npm test             # unit tests
npm run test:e2e     # end-to-end tests
```

See `CLAUDE.md` for detailed architecture, environment setup, and deployment procedures.

## What Makes This Different

**1. Real browser, real fingerprints.** Most "website analyzers" make an HTTP request and parse the HTML. We launch an actual browser with a forensically-consistent identity and navigate the site the way a real user would. We wait for SPAs to hydrate. We detect and handle bot protection. This is what it takes to see the *real* state of a website, not the sanitized version served to crawlers.

**2. 46 modules, not 46 checks.** Each module is a self-contained analysis engine with its own retry logic, timeout, scoring formula, and typed data contract. M05 (Analytics) alone examines measurement IDs, data layer events, consent mode configuration, cross-domain tracking, debug mode, and 8 categories of network requests. Most "audit tools" would call that 8 separate features. We call it one module.

**3. AI synthesis that actually synthesizes.** The AI integration doesn't summarize — it *reasons*. It cross-references findings across modules to produce insights that no individual module could generate alone. "Your consent mode is misconfigured AND your top 3 paid keywords are in healthcare AND you're missing a BAA notice" isn't something a checklist produces. It's something a $400/hr consultant notices after reading three different reports.

**4. Failure isolation as a first-class design principle.** Module failures never cascade. A third-party API rate limit doesn't stall the browser phase. A bot wall on one module doesn't kill the next. Every module result — success, partial, or error — is stored immediately. The scan always completes with the maximum intelligence it could gather.

**5. The dashboard is a presentation, not a spreadsheet.** Results render as 16:9 slide cards that print as landscape pages. The sidebar navigates like Asana. The overview slide looks like the first page of a McKinsey deck. This matters because the person paying needs to forward the results to their CMO, and CMOs don't read JSON.

---

<div align="center">

**Built with an unhealthy obsession for marketing technology.**

[marketingalphascan.com](https://marketingalphascan.com)

</div>
