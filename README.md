<div align="center">

# MarketingAlphaScan

### The $200,000 Marketing Audit. For $9.99.

**Forensic marketing intelligence that would take a McKinsey team 6 weeks — delivered in 90 seconds.**

[![CI](https://github.com/iancarlospr/mas/actions/workflows/ci.yml/badge.svg)](https://github.com/iancarlospr/mas/actions/workflows/ci.yml)
[![Deploy Web](https://img.shields.io/badge/web-vercel-black?logo=vercel)](https://marketingalphascan.com)
[![Deploy Engine](https://img.shields.io/badge/engine-docker-blue?logo=docker)](https://github.com/iancarlospr/mas/actions/workflows/deploy-engine.yml)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green?logo=node.js)](https://nodejs.org)

</div>

---

## The Problem

Every company with a website is leaking money. Broken analytics. Redundant $40K/yr MarTech tools nobody uses. Tag managers firing into the void. Consent banners that violate three regulations simultaneously. Paid media pixels that stopped working after the last site redesign. And nobody knows — because auditing all of this requires a team of specialists with six-figure salaries, weeks of manual inspection, and access to tools that cost thousands per month.

The marketing ops audit is the most valuable, most underdelivered service in digital. Agencies charge $150K-$250K for it. Internal teams don't have the cross-functional expertise. And the free "website graders" out there check if you have a meta description and call it a day.

**MarketingAlphaScan changes the unit economics of marketing intelligence permanently.**

## What It Actually Does

You enter a URL. Ninety seconds later, you have a forensic audit across **46 analysis modules** spanning 8 scoring categories — the same ground truth a principal marketing technologist would uncover over weeks of manual work.

This isn't a lighthouse score with a bow on it. This is:

- **Analytics Architecture Forensics** — Is your GA4 measurement ID actually firing? Are your custom events reaching BigQuery, or silently dropping? Is your consent management platform configured for Consent Mode v2, or are you hemorrhaging 40% of your European traffic data?

- **Paid Media Attribution Integrity** — Are your Meta CAPI events deduplicating correctly? Is your Google Ads enhanced conversion tag passing hashed PII? Did your GCLID survive that SPA route change, or is your $500K/yr ad spend flying blind?

- **MarTech Stack X-Ray** — You're paying for HubSpot, Marketo, AND Pardot? Your tag manager has 47 tags and 12 of them are firing on every page load? That abandoned A/B testing tool from 2022 is still injecting 180KB of JavaScript?

- **Compliance & Security Surface** — DMARC policy is set to `none` (hello, spoofing). No HSTS preload. Three consent violations that would cost you $50K each under GDPR. Your cookie banner says "we use cookies" and thinks that's consent.

- **Competitive Intelligence** — How does your traffic, domain authority, paid spend, and keyword portfolio compare to your top 5 competitors? Where are they winning that you're not?

- **AI-Synthesized Executive Brief** — A Gemini Pro-generated strategic narrative with prioritized recommendations, ROI projections, and a 5-week remediation roadmap. The deliverable your CMO would actually read.

## The 90-Second Scan

Under the hood, a scan isn't a single HTTP request. It's an orchestrated pipeline of **5 sequential phases** executing 46 specialized modules:

```
Phase 1: PASSIVE          7 modules    ~5s     HTTP headers, DNS, HTML parsing
Phase 2: BROWSER         10 modules   ~25s     Real Chrome session, DOM forensics
Phase 3: GHOSTSCAN        4 modules   ~15s     Deep interaction, accessibility, compliance
Phase 4: EXTERNAL         20 modules  ~20s     DataForSEO, market intelligence APIs
Phase 5: SYNTHESIS         5 modules  ~25s     Gemini AI analysis, scoring, roadmap
                          ──────────  ─────
                          46 modules   ~90s
```

**Phase 2 is where it gets interesting.** We don't use a headless browser — we use a *real* Chrome instance with a forensically-constructed identity. Randomized viewport dimensions. Platform-consistent WebGL fingerprints. Spoofed navigator properties. Canvas noise injection. A fake browsing history seeded from Google Search. The browser pool auto-detects your system Chrome installation for authentic TLS fingerprints (JA3/JA4), because Cloudflare, Akamai, and PerimeterX can tell the difference between Chromium and Chrome at the TLS handshake level.

If a bot wall fires anyway — Cloudflare Turnstile, Akamai Bot Manager, PerimeterX press-and-hold, DataDome CAPTCHA — the engine detects the specific provider, waits for auto-resolution, clears cookies, rotates the stealth profile, and retries. **97.9% success rate across 32 test URLs** including Fortune 500 sites with enterprise WAFs.

Every module failure is isolated. Nothing cascades. A timeout on M09 doesn't kill M10. A DataForSEO rate limit doesn't stall the synthesis phase. The scan always completes with whatever intelligence it could gather.

## Architecture

```
                                    ┌──────────────────────────────┐
                                    │         VERCEL               │
                                    │  ┌────────────────────────┐  │
                                    │  │   Next.js 15 (React 19)│  │
                                    │  │   App Router + SSR      │  │
                                    │  │   Tailwind + Recharts   │  │
                                    │  └───────────┬────────────┘  │
                                    └──────────────┼───────────────┘
                                                   │ HMAC-signed requests
                                                   ▼
┌─────────────┐    ┌──────────────────────────────────────────────────────┐
│  Supabase   │◄───│              DIGITALOCEAN                           │
│  (Postgres) │    │  ┌──────────┐   ┌────────────────────────────────┐  │
│             │    │  │  Caddy   │──▶│       Fastify 5 Engine         │  │
│  - Scans    │    │  │  (TLS)   │   │                                │  │
│  - Results  │    │  └──────────┘   │  BullMQ ──▶ ModuleRunner       │  │
│  - Payments │    │                 │  46 Modules (5 phases)         │  │
│  - Chat     │    │                 │  Patchright (real Chrome)      │  │
│  - Auth     │    │                 │  Gemini AI (Flash + Pro)       │  │
│             │    │                 │  DataForSEO (traffic intel)    │  │
│             │    │  ┌──────────┐   └────────────────────────────────┘  │
│             │    │  │  Redis   │◄── BullMQ job queue + caching        │
│             │    │  └──────────┘                                      │
└─────────────┘    └────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │     EXTERNAL SERVICES        │
                                    │  DataForSEO   Google PSI     │
                                    │  Gemini AI    Stripe         │
                                    │  Resend       PostHog        │
                                    └──────────────────────────────┘
```

### The Monorepo

```
marketing-alpha-scan/
├── apps/
│   ├── web/                    # Next.js 15 — dashboard, auth, checkout
│   └── engine/                 # Fastify 5 — scanner, AI, browser automation
├── packages/
│   ├── types/                  # Shared TypeScript types (46 module contracts)
│   ├── email-service/          # Transactional email orchestration
│   └── email-templates/        # React Email templates
├── supabase/
│   └── migrations/             # 8 PostgreSQL migrations (RLS, indexes, triggers)
├── e2e/                        # Playwright E2E tests (desktop + mobile)
└── .github/workflows/          # 7 CI/CD workflows
```

## The 46 Modules

Every module produces typed data (`ModuleDataMap`), scored checkpoints, and confidence-weighted signals. The MarketingIQ composite score weights 8 categories:

| Category | Weight | Modules | What It Measures |
|----------|--------|---------|-----------------|
| **Analytics Integrity** | 20% | M05, M08, M09 | GA4 firing, tag governance, behavioral tracking |
| **Paid Media Attribution** | 18% | M06, M06b, M21, M28, M29 | Pixel health, CAPI, landing page alignment |
| **Performance & UX** | 15% | M03, M13, M14 | Core Web Vitals, carbon footprint, mobile parity |
| **Compliance & Security** | 15% | M01, M10, M11, M12 | DMARC/SPF/DKIM, WCAG 2.1, consent, legal pages |
| **MarTech Efficiency** | 12% | M07, M20 | Tool redundancy, form analytics, SaaS signals |
| **SEO & Content** | 10% | M04, M15, M16, M34, M35, M40 | Metadata, social sharing, PR coverage, keyword gaps |
| **Market Position** | 6% | M24-M33, M36-M39 | Traffic, competitors, domain authority, local SEO |
| **Digital Presence** | 4% | M02, M17-M19, M22, M23 | CMS detection, careers, IR, support, sentiment |

### The Full Module Inventory

<details>
<summary><strong>Phase 1: Passive Analysis</strong> — HTTP-only, no browser required</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M01 | DNS & Security | DMARC, SPF, DKIM, HSTS, TLS grade, CAA records, DNSSEC, security headers, redirect chains |
| M02 | CMS & Infrastructure | CMS/CDN/framework/WAF detection via 100+ fingerprint signatures |
| M04 | Page Metadata | Title, meta descriptions, Open Graph, Twitter Cards, JSON-LD, robots.txt, sitemap, manifest |
| M16 | PR & Media | News coverage, press releases, media mentions |
| M17 | Careers & HR | Job listings, employer branding signals |
| M18 | Investor Relations | SEC filings, IR page detection, earnings signals |
| M19 | Support | Help desk, knowledge base, chatbot detection |

</details>

<details>
<summary><strong>Phase 2: Browser Analysis</strong> — Real Chrome session with stealth</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M03 | Performance | Lighthouse metrics, CWV (LCP, CLS, FCP, TTFB), resource waterfall |
| M05 | Analytics | GA4 measurement IDs, data layer events, consent mode, cross-domain, debug mode |
| M06 | Paid Media | Meta/Google/LinkedIn/TikTok pixels, click ID persistence, CAPI detection |
| M06b | PPC Landing Audit | Message match, CTA prominence, form friction, trust signals |
| M07 | MarTech Stack | Tool inventory from network requests, form analytics, automation signals |
| M08 | Tag Governance | TMS detection, tag audit, server-side tagging indicators, data layer quality |
| M13 | Perf & Carbon | Resource breakdown, carbon per pageview, sustainability score |
| M14 | Mobile & Responsive | Viewport parity, touch targets, mobile-specific issues |
| M15 | Social & Sharing | OG/Twitter cards, social link presence, share widget detection |
| M20 | Ecommerce/SaaS | Cart detection, pricing pages, SaaS metrics, checkout flow signals |

</details>

<details>
<summary><strong>Phase 3: GhostScan</strong> — Deep behavioral interaction</summary>

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
| M40 | Sitemap & Indexing | Sitemap health, indexation coverage |

</details>

<details>
<summary><strong>Phase 5: AI Synthesis</strong> — Gemini-powered strategic analysis</summary>

| ID | Module | What It Does |
|----|--------|-------------|
| M41 | Module Synthesis | Per-module AI summaries with findings, recommendations, evidence |
| M42 | Executive Brief | Strategic narrative, key findings, score rationale (Gemini Pro) |
| M43 | Remediation Roadmap | Prioritized 5-week workstream with effort/impact sizing |
| M44 | ROI Simulator | Dollar-value impact projections across 5 cost areas |
| M45 | Cost Cutter | Tool redundancy analysis with annual savings estimate |
| M46 | Knowledge Base | Structured knowledge graph for AI chat context |

</details>

## The Dashboard

Results are presented as a McKinsey-style **slide deck**, not a wall of data tables. Each module renders as a 16:9 aspect-ratio card — a self-contained "slide" with a header bar, scored checkpoints, and detailed evidence.

An Asana-style sidebar provides navigation with scroll sync (IntersectionObserver). Print mode (`Cmd+P`) renders each card as one landscape page. Free tier shows top-level scores with a frosted glass overlay; paid tier unlocks full evidence, recommendations, and the 4 synthesis slides.

```
┌──────────────┬───────────────────────────────────────────┐
│  LEFT NAV    │  SCROLLABLE CONTENT                       │
│  (240px)     │                                           │
│              │  ┌─────────────────────────────────────┐  │
│  Overview    │  │    16:9 SLIDE — MarketingIQ Score    │  │
│              │  └─────────────────────────────────────┘  │
│  ANALYTICS ▾ │                                           │
│    M05  82 🟢│  ┌─────────────────────────────────────┐  │
│    M08  68 🟡│  │    16:9 SLIDE — Analytics (M05)     │  │
│    M09  75 🟢│  └─────────────────────────────────────┘  │
│              │                                           │
│  PAID MEDIA ▾│  ┌─────────────────────────────────────┐  │
│    M06  71 🟢│  │    16:9 SLIDE — Paid Media (M06)    │  │
│    ...       │  └─────────────────────────────────────┘  │
│              │                                           │
│  🔒 EXECUTIVE│  ...                                      │
│  🔒 ROI      │                                           │
│  🔒 ROADMAP  │                                           │
└──────────────┴───────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Next.js 15** (App Router), **React 19**, Tailwind CSS, Recharts, Framer Motion |
| Backend | **Fastify 5**, BullMQ (Redis), Patchright (Playwright fork) |
| Database | **Supabase** (PostgreSQL, RLS, Auth, Storage) |
| AI | **Google Gemini** 2.5 Flash (speed) + Pro (quality) |
| Market Data | **DataForSEO** (traffic, keywords, competitors, domain authority) |
| Payments | **Stripe** (checkout sessions, webhooks) |
| Email | **Resend** (transactional, Standard Webhooks) |
| Analytics | **PostHog** (reverse-proxied through `/ingest/*`) |
| Bot Protection | **Cloudflare Turnstile** |
| Fonts | Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (data) |
| Hosting | **Vercel** (web), **DigitalOcean** (engine + Redis via Docker + Caddy) |
| CI/CD | **GitHub Actions** (7 workflows: CI, deploy-web, deploy-engine, db-migrate, security, backup, golden-dataset) |
| TypeScript | **5.7** (strict mode, `noUncheckedIndexedAccess`, ES2022 target) |

## Getting Started

### Prerequisites

- Node.js >= 20
- npm 10.8.0
- Docker (for local Redis)
- Supabase CLI (for local database)

### Setup

```bash
# Clone and install
git clone https://github.com/iancarlospr/mas.git
cd mas
npm install

# Start local infrastructure
docker compose -f docker-compose.dev.yml up -d    # Redis on :6379
supabase start                                      # Local Supabase

# Configure environment
cp apps/web/.env.example apps/web/.env.local        # Fill in values
cp apps/engine/.env.example apps/engine/.env         # Fill in values

# Run database migrations
supabase db push

# Start development
npm run dev                                         # web :3000, engine :3001
```

### Key Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ENGINE_HMAC_SECRET` | Both | Shared secret for web ↔ engine auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Engine | Bypasses RLS for module result writes |
| `GOOGLE_AI_API_KEY` | Both | Gemini Flash + Pro for AI synthesis |
| `DATAFORSEO_LOGIN/PASSWORD` | Engine | Market intelligence API |
| `STRIPE_SECRET_KEY` | Web | Payment processing |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Client-side Supabase connection |

## Deployment

### Web (Vercel) — Zero-config, push to deploy

```bash
git push origin main
# Vercel GitHub App auto-builds: turbo build (types → Next.js)
# deploy-web.yml verifies HTTP 200 health check
```

### Engine (DigitalOcean) — Docker + auto-rollback

```bash
git push origin main
# deploy-engine.yml: Docker build → GHCR → SSH deploy → health check
# Automatic rollback if health check fails after 60s
```

### Database (Supabase) — Migration on push

```bash
git push origin main
# db-migrate.yml: supabase link → supabase db push → diff verification
```

## CI/CD Pipeline

Every push triggers a 5-stage pipeline with path-based filtering:

```
changes (dorny/paths-filter)
  → lint + typecheck (fast gate, ~2min)
    → unit tests (parallel: engine 70%, web 60%, types 90%)
    → integration tests (Redis service container)
      → build validation (web + engine Docker, parallel)
        → E2E tests (main only, Playwright chromium + mobile)
```

Plus automated workflows:
- **Security scan**: Weekly Trivy + npm audit (HIGH/CRITICAL only)
- **Database backup**: Weekly `pg_dump` → artifact (30-day retention)
- **Golden dataset**: Weekly AI synthesis regression testing (M41-M45)

## The Business Model

**Free tier**: Full 46-module scan. See your MarketingIQ score, checkpoint health levels, and detected tools. Enough to know what's broken.

**Paid tier ($9.99)**: Unlock detailed evidence, actionable recommendations, the AI-generated Executive Brief, ROI Simulator, Remediation Roadmap, Cost Cutter analysis, AI Chat (50 messages), and a shareable PDF report.

The insight-to-price ratio is absurd by design. A single finding from the compliance module ("your DMARC policy is set to `none`") would cost $5,000 to discover through a traditional security audit. The cost cutter module routinely identifies $20K-$80K/yr in redundant MarTech spend. The ROI on $9.99 is functionally infinite.

## What Makes This Different

**1. Real browser, real Chrome, real fingerprints.** Most "website analyzers" make an HTTP request and parse the HTML. We launch an actual Chrome instance with a forensically-consistent identity — matching UA, viewport, WebGL renderer, canvas fingerprint, navigator properties, and TLS signature. We navigate from Google Search with a realistic referrer. We wait for SPAs to hydrate. We detect and resolve bot walls. This is what it takes to see the *real* state of a website, not the sanitized version served to bots.

**2. 46 modules, not 46 checks.** Each module is a self-contained analysis engine with its own retry logic, timeout, scoring formula, and typed data contract. M05 (Analytics) alone examines measurement IDs, data layer events, consent mode configuration, cross-domain tracking, debug mode, and 8 categories of network requests. Most "audit tools" would call that 8 separate features. We call it one module.

**3. AI synthesis that actually synthesizes.** The Gemini Pro integration doesn't summarize — it *reasons*. It cross-references findings across modules to produce insights that no individual module could generate alone. "Your GA4 consent mode is misconfigured AND your top 3 paid keywords are in healthcare AND you're missing a BAA notice" isn't something a checklist produces. It's something a $400/hr consultant notices after reading three different reports.

**4. Failure isolation as a first-class design principle.** Module failures never cascade. A DataForSEO rate limit doesn't stall the browser phase. A bot wall on M09 doesn't kill M10. Every module result — success, partial, or error — is upserted to the database immediately. The scan always completes with the maximum intelligence it could gather.

**5. The dashboard is a presentation, not a spreadsheet.** Results render as 16:9 slide cards that print as landscape pages. The sidebar navigates like Asana. The overview slide looks like the first page of a McKinsey deck. This matters because the person paying $9.99 needs to forward the results to their CMO, and CMOs don't read JSON.

---

<div align="center">

**Built with an unhealthy obsession for marketing technology.**

[marketingalphascan.com](https://marketingalphascan.com)

</div>
