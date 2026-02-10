# MarketingAlphaScan — Production Architecture Plan

## Context

MarketingAlphaScan is a forensic marketing intelligence platform that analyzes any URL to reverse-engineer a brand's marketing technology stack, strategy, and performance. The product has validated demand from marketing professionals. It must be built by a solo developer at near-$0 cost while meeting the quality bar of experienced principal engineers. The domain MarketingAlphaScan.com is on Cloudflare.

---

## 1. Monetization & Tier Architecture

| Tier | Trigger | What They Get | Cost to Serve |
|------|---------|---------------|---------------|
| **Peek** | Anonymous URL submit | Passive-only scan (6 modules), limited dashboard preview, MarketingIQ teaser | ~$0.01 |
| **Full Scan** | Email registration | Full P1 Bento Dashboard, all modules, individual AI insights | ~$0.30-0.60 |
| **Alpha Brief** | One-time $9.99 (anchored at $29.99) | P2 McKinsey report + PRD + PDF download + 50 AI Chat messages | ~$1.00-2.00 |
| **Chat Credits** | One-time $4.99 | 100 additional AI Chat messages | ~$0.50 |

**Conversion flow:** URL entry → Turnstile → scan starts → email capture during scan → full dashboard → paid upgrade CTA after seeing value.

---

## 2. Tech Stack (Final)

| Layer | Technology | Hosting | Cost |
|-------|-----------|---------|------|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion | Vercel Free | $0 |
| Scan Engine | Node.js, TypeScript, Fastify, Playwright, BullMQ (see note below) | DigitalOcean Droplet | $6/mo |
| Queue/Cache | Redis (installed on droplet) | DigitalOcean | included |
| Database | PostgreSQL via Supabase | Supabase Free | $0 |
| Auth | Supabase Auth (email/password, magic link, Google OAuth, Apple OAuth) | Supabase Free | $0 |
| File Storage | Supabase Storage (generated PDFs) | Supabase Free (1GB) | $0 |
| Payments | Stripe Checkout (one-time) | Stripe | 2.9% + $0.30/txn |
| AI | Google Gemini API (Flash + Pro) | Google AI | ~$0.01-0.05/scan |
| Market Data | DataForSEO API | DataForSEO | ~$0.05-0.15/scan |
| Analytics | PostHog (reverse proxy via Next.js rewrites) | PostHog Free (1M events/mo) | $0 |
| Email | Resend (transactional: verification, receipts) | Resend Free (3K/mo) | $0 |
| Blog/CMS | MDX files in Next.js repo | Vercel | $0 |
| Security | Cloudflare Turnstile, DNS, geo-blocking, CDN | Cloudflare Free | $0 |

**Why BullMQ over Temporal?** Temporal is a powerful workflow orchestration engine, but it requires its own server infrastructure (Cassandra/PostgreSQL + Elasticsearch) or Temporal Cloud ($25/mo minimum). Our scan workflow is a straightforward queue pattern (queue job → run modules → save results) — not a complex multi-service saga. BullMQ runs directly on the same droplet via Redis at zero extra cost. Migrate to Temporal later only if workflow complexity grows (e.g., scheduled recurring scans, multi-step approval flows).

**Why PostHog over DataFast?** PostHog provides session recordings, feature flags, A/B testing, funnels, and critically a reverse proxy to bypass adblockers (required per PRD). PostHog's free tier includes 1M events/mo. DataFast ($9/mo for 10K events) is simpler but lacks session recordings, feature flags, and the reverse proxy capability this product needs.

**Estimated monthly cost at launch: ~$6-10/mo** (DigitalOcean droplet + minimal API usage)

---

## 3. Monorepo Structure

```
MarketingAlphaScan/
├── apps/
│   ├── web/                          # Next.js 15 frontend (→ Vercel)
│   │   ├── app/
│   │   │   ├── (marketing)/          # Landing, pricing, about, blog
│   │   │   │   ├── page.tsx          # Landing page with URL input
│   │   │   │   ├── pricing/
│   │   │   │   ├── about/
│   │   │   │   └── blog/
│   │   │   │       └── [slug]/
│   │   │   ├── (auth)/               # Login, register, verify-email
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── verify/
│   │   │   ├── (dashboard)/          # Authenticated area
│   │   │   │   ├── scan/[id]/        # P1 Bento Dashboard
│   │   │   │   ├── report/[id]/      # P2 McKinsey Report (web view)
│   │   │   │   ├── chat/[id]/        # P3 AI Chat
│   │   │   │   └── history/          # Scan history
│   │   │   ├── api/
│   │   │   │   ├── scans/            # Proxy to scan engine
│   │   │   │   ├── webhooks/
│   │   │   │   │   └── stripe/       # Stripe webhook handler
│   │   │   │   └── ingest/           # PostHog reverse proxy
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── scan/                 # Scan-specific components
│   │   │   │   ├── scan-input.tsx
│   │   │   │   ├── scan-progress.tsx
│   │   │   │   ├── bento-dashboard.tsx
│   │   │   │   └── module-cards/     # Per-module visualization cards
│   │   │   ├── report/               # P2 report components
│   │   │   ├── chat/                 # AI chat components
│   │   │   └── marketing/            # Landing page sections
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts         # Browser client
│   │   │   │   ├── server.ts         # Server client
│   │   │   │   └── middleware.ts      # Auth middleware
│   │   │   ├── stripe.ts
│   │   │   └── utils.ts
│   │   ├── content/                  # MDX blog posts
│   │   │   └── under-the-stack/      # UnderTheStack™ blog
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── engine/                       # Scan engine (→ DigitalOcean)
│       ├── src/
│       │   ├── server.ts             # Fastify server entry
│       │   ├── routes/
│       │   │   ├── scans.ts          # POST /scans, GET /scans/:id
│       │   │   └── health.ts
│       │   ├── modules/              # All 45 modules
│       │   │   ├── registry.ts       # Module registry & metadata
│       │   │   ├── runner.ts         # Module execution orchestrator
│       │   │   ├── types.ts          # Module interface
│       │   │   ├── passive/          # Phase 1: No browser needed
│       │   │   │   ├── m01-dns-security.ts
│       │   │   │   ├── m02-cms-infrastructure.ts
│       │   │   │   ├── m04-page-metadata.ts
│       │   │   │   ├── m16-pr-media.ts
│       │   │   │   ├── m17-careers-hr.ts
│       │   │   │   ├── m18-investor-relations.ts
│       │   │   │   └── m19-support-success.ts
│       │   │   ├── browser/          # Phase 2: Playwright required
│       │   │   │   ├── m03-performance.ts
│       │   │   │   ├── m05-analytics.ts
│       │   │   │   ├── m06-paid-media.ts
│       │   │   │   ├── m06b-ppc-landing-audit.ts
│       │   │   │   ├── m07-martech.ts
│       │   │   │   ├── m08-tag-governance.ts
│       │   │   │   ├── m13-perf-carbon.ts
│       │   │   │   ├── m14-mobile-responsive.ts
│       │   │   │   ├── m15-social-sharing.ts
│       │   │   │   └── m20-ecommerce-saas.ts
│       │   │   ├── ghostscan/        # Phase 3: Active probing
│       │   │   │   ├── m09-behavioral.ts
│       │   │   │   ├── m10-accessibility.ts
│       │   │   │   ├── m11-console-errors.ts
│       │   │   │   └── m12-legal-compliance.ts
│       │   │   ├── external/         # Phase 4: Third-party APIs
│       │   │   │   ├── m21-ad-library.ts
│       │   │   │   ├── m22-news-sentiment.ts
│       │   │   │   ├── m23-social-sentiment.ts
│       │   │   │   └── dataforseo/
│       │   │   │       ├── m24-monthly-visits.ts
│       │   │   │       ├── ...       # M25-M40
│       │   │   │       └── m40-business-profile.ts
│       │   │   └── synthesis/        # Phase 5: AI
│       │   │       ├── m41-module-synthesis.ts
│       │   │       ├── m42-final-synthesis.ts
│       │   │       ├── m43-prd-generation.ts
│       │   │       ├── m44-roi-simulator.ts
│       │   │       ├── m45-cost-cutter.ts
│       │   │       └── m46-knowledge-base.ts
│       │   ├── ghostscan/
│       │   │   ├── browser-pool.ts   # Playwright browser pool manager
│       │   │   └── probes.ts         # Reusable probe functions
│       │   ├── queue/
│       │   │   ├── connection.ts     # Redis/BullMQ connection
│       │   │   ├── scan-queue.ts     # Queue definition
│       │   │   └── scan-worker.ts    # Worker that processes scans
│       │   ├── services/
│       │   │   ├── supabase.ts       # Supabase admin client
│       │   │   ├── gemini.ts         # Google AI client
│       │   │   └── dataforseo.ts     # DataForSEO client
│       │   └── utils/
│       │       ├── http.ts           # Fetch helpers
│       │       ├── dns.ts            # DNS lookup helpers
│       │       └── html.ts           # HTML parsing (cheerio)
│       ├── Dockerfile
│       ├── docker-compose.yml        # Engine + Redis
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── types/                        # Shared TypeScript types
│       ├── src/
│       │   ├── scan.ts               # Scan, ScanStatus, ScanTier
│       │   ├── modules.ts            # ModuleResult, ModuleId
│       │   ├── user.ts               # User types
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   └── migrations/                   # SQL migrations
│       ├── 001_users.sql
│       ├── 002_scans.sql
│       ├── 003_module_results.sql
│       ├── 004_payments.sql
│       └── 005_audit_log.sql
│
├── package.json                      # Workspace root
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── turbo.json                        # Optional: only if needed
```

---

## 4. Module System Design

### Module Interface

```typescript
// packages/types/src/modules.ts
export type ModuleId = 'M01' | 'M02' | ... | 'M46';
export type ModulePhase = 'passive' | 'browser' | 'ghostscan' | 'external' | 'synthesis';
export type ModuleTier = 'peek' | 'full' | 'paid';  // minimum tier required

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  phase: ModulePhase;
  minimumTier: ModuleTier;
  dependsOn?: ModuleId[];        // modules that must complete first
  timeout: number;                // ms
  retries: number;
}

export interface ModuleContext {
  url: string;
  scanId: string;
  tier: ModuleTier;
  page?: PlaywrightPage;         // shared browser page (phases 2-3)
  previousResults: Map<ModuleId, ModuleResult>;
}

export interface ModuleResult {
  moduleId: ModuleId;
  status: 'success' | 'partial' | 'error' | 'skipped';
  data: Record<string, unknown>;  // module-specific structured data
  signals: Signal[];               // detected technologies/patterns
  score: number;                   // 0-100 module score
  duration: number;                // ms
  error?: string;
}

export interface Signal {
  type: string;                    // e.g., 'analytics_tool', 'ad_pixel'
  name: string;                    // e.g., 'Google Analytics 4'
  confidence: number;              // 0-1
  evidence: string;                // where/how detected
  category: string;
}
```

### Module Registry (apps/engine/src/modules/registry.ts)

```typescript
export const MODULE_REGISTRY: ModuleDefinition[] = [
  { id: 'M01', name: 'DNS & Security Baseline', phase: 'passive', minimumTier: 'peek', timeout: 15000, retries: 2 },
  { id: 'M02', name: 'CMS & Infrastructure', phase: 'passive', minimumTier: 'peek', timeout: 15000, retries: 2 },
  // ... all 45 modules
  { id: 'M42', name: 'Final AI Synthesis', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M41'], timeout: 60000, retries: 1 },
];
```

### Execution Flow (apps/engine/src/modules/runner.ts)

```
Phase 1 (Passive): M01, M02, M04, M16-M19 — run in parallel, no browser
    ↓ results saved progressively
Phase 2 (Browser): Single Playwright page → M03, M05, M06, M06b (PPC page discovery+scan), M07, M08, M13-M15, M20 — sequential on shared page
    ↓ results saved progressively
Phase 3 (GhostScan): Active probing on same page → M09-M12 — sequential
    ↓ browser closed
Phase 4 (External): M21-M23, M24-M40 — run in parallel (API calls)
    ↓ all results available
Phase 5 (Synthesis): M41 (parallel per-module) → M42-M46 (sequential, depends on M41)
    ↓ scan complete
```

**Tier gating:** Peek tier stops after Phase 1. Full tier runs Phases 1-4 + M41. Paid tier runs everything.

### Reliability & Retry Strategy

**Module-level retries (inside scan worker, per-module):**

| Module Phase | Max Retries | Backoff | Notes |
|---|---|---|---|
| Passive | 4 | 1s → 2s → 4s → 8s | Fast/cheap, retry aggressively |
| Browser | 3 | 2s → 4s → 8s | Fresh page context per retry |
| GhostScan | 3 | 2s → 4s → 8s | Timing-sensitive probes |
| External APIs | 5 | 2s → 5s → 10s → 20s → 40s | Rate limits + transient outages |
| AI Synthesis | 4 | 3s → 6s → 12s → 24s | Gemini 429/503 transient errors |

**Job-level retries (BullMQ):**
- Worker crash / OOM: retry entire scan job **3 times** with 30s delay
- After 3rd failure: mark scan `failed`, preserve any partial results

**Phase timeout budgets:**
- Phase 1 (passive): 60s | Phase 2 (browser): 120s | Phase 3 (ghostscan): 90s | Phase 4 (external): 120s | Phase 5 (synthesis): 90s
- **Total max: ~8 minutes** (most scans complete in 3-4 min; budget covers worst-case retry storms)

**Graceful degradation rules:**
- Single module failure → mark `error`, continue scan, show "unavailable" in dashboard
- Playwright crash → restart browser, retry module, skip remaining browser modules if crash persists
- External API down → mark as `partial`, run AI synthesis on available data
- Target URL unreachable → short-circuit all phases, return early with error reason
- Target returns 403/blocking → run passive modules (DNS/headers still work), skip browser phases
- Any module error → never cascades to full scan failure; always produce partial results

---

## 5. Database Schema (Supabase/PostgreSQL)

```sql
-- Core tables

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),  -- null for anonymous
  url TEXT NOT NULL,
  domain TEXT NOT NULL,                     -- extracted from URL
  tier TEXT NOT NULL CHECK (tier IN ('peek', 'full', 'paid')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'passive', 'browser', 'ghostscan', 'external', 'synthesis', 'complete', 'failed')),
  marketing_iq INTEGER,                     -- 0-100 final score
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  country_code TEXT
);

CREATE TABLE module_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,                   -- 'M01', 'M02', etc.
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'partial', 'error', 'skipped')),
  data JSONB DEFAULT '{}',                   -- structured module output
  signals JSONB DEFAULT '[]',                -- detected signals
  score INTEGER,                             -- 0-100 module score
  ai_synthesis TEXT,                         -- M41 per-module insight
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scan_id, module_id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  scan_id UUID REFERENCES scans(id),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  product TEXT NOT NULL CHECK (product IN ('alpha_brief', 'chat_credits')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scans_user ON scans(user_id);
CREATE INDEX idx_scans_domain ON scans(domain);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_module_results_scan ON module_results(scan_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- RLS Policies
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users see own module results" ON module_results
  FOR SELECT USING (scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid()));
CREATE POLICY "Users see own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own chat" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 6. API Design

### Frontend → Scan Engine Communication

**Next.js API routes** proxy to the DigitalOcean scan engine (never expose engine directly):

```
POST /api/scans                    → Create scan, forward to engine
GET  /api/scans/:id                → Get scan status + results (from Supabase)
GET  /api/scans/:id/stream         → SSE stream for real-time progress
POST /api/scans/:id/upgrade        → Upgrade scan tier after payment
POST /api/chat/:scanId             → Send chat message, get AI response
POST /api/webhooks/stripe           → Stripe payment webhook
```

**Scan Engine internal API** (DigitalOcean, authenticated via shared secret):

```
POST /engine/scans                  → Start scan job (BullMQ)
GET  /engine/scans/:id/status       → Job status
GET  /engine/health                 → Health check
```

### Real-time Progress (SSE)

The frontend opens an SSE connection to `/api/scans/:id/stream`. The Next.js route polls Supabase `module_results` for the scan and streams status changes. Each module completion triggers an update so the dashboard can render progressively.

---

## 7. Deployment Architecture

```
                    ┌─────────────┐
                    │  Cloudflare  │
                    │  DNS + CDN   │
                    │  Turnstile   │
                    │  Geo-block   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Vercel     │
                    │  Next.js 15  │
                    │  (Frontend)  │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Supabase    │ │ DigitalOcean │ │   Stripe     │
   │  PostgreSQL  │ │   Droplet    │ │  Checkout    │
   │  Auth        │ │  Scan Engine │ │  Webhooks    │
   │  Storage     │ │  + Redis     │ │              │
   └─────────────┘ │  + Playwright│ └─────────────┘
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Gemini   │ │DataForSEO│ │ Resend   │
        │ AI API   │ │  API     │ │ Email    │
        └──────────┘ └──────────┘ └──────────┘
```

### DigitalOcean Droplet Setup
- **Size**: $6/mo (1 vCPU, 1GB RAM) — upgrade to $12/mo (2GB) when needed
- **Docker Compose**: Scan engine + Redis in containers
- **Playwright**: Uses single browser instance with page recycling (not new browser per scan)
- **Concurrency**: Process 1 scan at a time (queue handles backlog); scale with bigger droplet or multiple workers later

---

## 8. Build Phases (Implementation Order)

### Phase 0: Foundation (Week 1)
- [ ] Initialize monorepo (npm workspaces)
- [ ] Scaffold Next.js 15 app with TypeScript, Tailwind, shadcn/ui
- [ ] Scaffold engine with Fastify + TypeScript
- [ ] Set up shared types package
- [ ] Supabase project + database migrations
- [ ] Environment variables (.env.example)
- [ ] Git repository + .gitignore

### Phase 1: Auth & Core UI Shell (Week 2)
- [ ] Supabase Auth integration (email/password, magic link, Google OAuth, Apple OAuth, email verification)
- [ ] Auth pages: register, login, verify-email, OAuth callback handling
- [ ] Landing page with URL input component
- [ ] Basic dashboard layout (sidebar, header)
- [ ] PostHog integration with Next.js rewrite proxy

### Phase 2: Scan Infrastructure (Week 3)
- [ ] BullMQ queue + Redis setup in engine
- [ ] Module interface, registry, and runner orchestrator
- [ ] Scan API routes (create, status, stream)
- [ ] SSE progress streaming
- [ ] Supabase scan + module_results tables
- [ ] Scan progress UI (loading states, module completion indicators)
- [ ] Cloudflare Turnstile integration on scan form

### Phase 3: Passive Modules (Week 4)
- [ ] M01: DNS & Security (dns.resolve, HTTP header analysis)
- [ ] M02: CMS & Infrastructure (Wappalyzer-style tech detection via HTML/headers)
- [ ] M04: Page Metadata (HTML meta tags, OG, Schema.org, robots.txt, sitemap, llms.txt)
- [ ] M16: PR & Media (press page detection, RSS feeds, contact paths)
- [ ] M17: Careers & HR (job board links, ATS detection)
- [ ] M18: Investor Relations (SEC filings, ticker detection)
- [ ] M19: Support & Success (help center, hours, chat widget links)
- [ ] Peek tier fully functional at this point

### Phase 4: Browser Modules (Weeks 5-6)
- [ ] Playwright browser pool manager
- [ ] M03: Page Load & Performance (CWV, resource timing, asset analysis)
- [ ] M05: Analytics Architecture (JS variable detection, pixel firing, network sniffing)
- [ ] M06: Paid Media Infrastructure (ad pixels, click IDs, attribution params)
- [ ] M06b: PPC Landing Page Audit (hidden page discovery, tracking parity, consent parity)
- [ ] M07: MarTech Orchestration (cookies, forms, automation signals, chat widgets)
- [ ] M08: Tag Governance (GTM/TMS, dataLayer, container analysis)
- [ ] M13: Performance & Carbon (adblock simulation, CWV under conditions)
- [ ] M14: Mobile & Responsive (viewport emulation, media query analysis)
- [ ] M15: Social & Sharing (social preview cards, widget detection)
- [ ] M20: Ecommerce/SaaS (cart detection, pricing signals, payment infra)

### Phase 5: GhostScan Modules (Week 7)
- [ ] GhostScan probe framework (reusable interaction functions)
- [ ] M09: Behavioral Intelligence (experiment detection, session replay signals)
- [ ] M10: Accessibility Overlay Detection (a11y widget probing)
- [ ] M11: Console & Error Logging (error capture, error provocation)
- [ ] M12: Legal/Security/Compliance (consent banners, CSP, cookies audit, policy detection)

### Phase 6: External Intelligence (Week 8)
- [ ] DataForSEO client + rate limiting
- [ ] M24-M40: All DataForSEO modules (traffic, keywords, competitors, rankings)
- [ ] M21: Ad Library Recon (Facebook/Google ad transparency scraping)
- [ ] M22: News Sentiment (Google News search + basic sentiment)
- [ ] M23: Social Sentiment (UGC via search + sentiment)

### Phase 7: AI Synthesis (Week 9)
- [ ] Gemini API client (Flash + Pro)
- [ ] M41: Per-module AI synthesis (parallel, Gemini Flash)
- [ ] M42: Final synthesis + MarketingIQ scoring (Gemini Pro)
- [ ] M43: PRD generation (Gemini Pro)
- [ ] M44: ROI Simulator (Gemini Flash)
- [ ] M45: Cost Cutter Analysis (Gemini Flash)
- [ ] M46: AI Knowledge Base assembly for chat

### Phase 8: P1 Dashboard (Week 10)
- [ ] Bento-grid dashboard layout
- [ ] Module visualization cards (one per module with charts/tables/signals)
- [ ] MarketingIQ score display (animated gauge)
- [ ] Traffic light system (red/yellow/green per module)
- [ ] Responsive design
- [ ] Framer Motion animations (scroll-triggered, micro-interactions)
- [ ] Full Scan tier fully functional at this point

### Phase 9: Payments & P2 Report (Weeks 11-12)
- [ ] Stripe Checkout integration (one-time payment)
- [ ] Stripe webhook handler (payment confirmation → tier upgrade)
- [ ] P2 McKinsey-style report web view (presentation layout)
- [ ] PDF generation (React-PDF or Puppeteer-based)
- [ ] Download capability via Supabase Storage
- [ ] Chat credits system (credits table, decrement on use)

### Phase 10: P3 AI Chat (Week 13)
- [ ] Chat UI component
- [ ] Chat API route with Gemini integration
- [ ] Context injection from M46 knowledge base
- [ ] Message persistence in Supabase
- [ ] Credit tracking and gating

### Phase 11: Security & Hardening (Week 14)
- [ ] IP-based rate limiting (in-memory + Redis)
- [ ] Geo-blocking enforcement (Cloudflare + application-level)
- [ ] Audit logging for all sensitive actions
- [ ] CORS, Helmet, CSP headers on engine
- [ ] Input validation/sanitization on all endpoints
- [ ] Error handling audit (no stack traces to client)
- [ ] Scan queue abuse protection (max scans per IP per day)

### Phase 12: Blog & Polish (Week 15)
- [ ] MDX blog setup (UnderTheStack™)
- [ ] 2-3 launch blog posts
- [ ] Email templates (verification, scan complete, receipt) via Resend
- [ ] SEO optimization (meta tags, sitemap, robots.txt)
- [ ] Performance optimization (lazy loading, code splitting, image optimization)
- [ ] Cross-browser testing
- [ ] Final design polish (animations, transitions, responsive breakpoints)

---

## 9. Security Implementation

| Threat | Mitigation |
|--------|-----------|
| Bot/abuse scans | Cloudflare Turnstile on scan form + IP rate limit: **2 scans/day anonymous (Peek), 4 scans/day registered (Full Scan)**, unlimited for paid |
| DDoS | Cloudflare CDN + rate limiting on engine API + queue depth limits |
| Geo-blocking | Cloudflare firewall rules blocking: India (IN), Pakistan (PK), China (CN), Russia (RU), Philippines (PH), Nigeria (NG), Bangladesh (BD), Vietnam (VN), North Korea (KP), Iran (IR), Myanmar (MM), Cambodia (KH), Laos (LA) + application-level country code check as fallback |
| Scan queue abuse | Max queue depth per IP, priority queue: paid > registered > anonymous, auto-reject when queue > threshold |
| Data at rest | Supabase encrypts by default (AES-256), all JSONB scan data encrypted at database level |
| Data in transit | TLS/HTTPS on every hop: Cloudflare → Vercel (automatic), Vercel → Engine (HTTPS with certificate pinning), Engine → Supabase (SSL enforced), Engine → external APIs (HTTPS only) |
| Engine API auth | HMAC-signed requests between Vercel and engine (shared secret + timestamp + request body hash) — not just a static token. Reject requests older than 30 seconds to prevent replay attacks |
| SQL injection | Supabase client with parameterized queries (default behavior), no raw SQL from user input |
| XSS | React escapes by default, strict CSP headers, no dangerouslySetInnerHTML on user data, sanitize all module output before rendering |
| Input validation | Zod schema validation on all API endpoints — URL format, scan IDs (UUID), payment amounts |
| Audit trail | audit_log table tracking all scan initiations, payment events, auth events, tier upgrades, and admin actions with IP + user agent |
| Secrets management | All secrets in environment variables, never in code. `.env` files gitignored. Rotate engine shared secret quarterly |

---

## 10. Key Design Decisions

1. **MDX for blog (UnderTheStack™)** — MDX = Markdown + JSX, used by Vercel, Stripe, and top engineering teams. Zero cost, version controlled in git, renders as Next.js pages natively. Pragmatic choice over Directus/Strapi/Contentful — no extra hosting, no CMS complexity. Migrate to a headless CMS later if/when you hire content writers.

2. **Resend over HubSpot for email at launch** — simpler integration, better DX, free tier covers launch needs. Add HubSpot for marketing automation when there's an audience to nurture.

3. **SSE over WebSocket for progress** — simpler to implement through Vercel serverless functions, sufficient for one-directional progress updates.

4. **Single Playwright browser instance** — instead of spawning a new browser per scan. Pages are created/destroyed within a shared browser context. Saves ~200MB RAM per scan.

5. **Module results as JSONB** — flexible schema per module, no need for 45 separate tables. Queryable via PostgreSQL JSON operators.

6. **Scan engine as a sealed API vault** — the engine is never exposed publicly (no public DNS, no open ports to the internet). All traffic flows Vercel → Engine via HTTPS with HMAC-signed requests. The engine validates every request's signature + timestamp before processing. Supabase credentials on the engine use a service_role key (server-side only) for writing scan results. The engine's DigitalOcean firewall rules only allow inbound traffic from Vercel's IP ranges + your SSH key. This creates a zero-trust architecture where the engine trusts nothing that isn't cryptographically verified.

7. **BullMQ over Temporal** — BullMQ handles the queue pattern at zero extra cost on the same droplet. Temporal requires its own infrastructure ($25/mo+ or self-hosted complexity). Upgrade path to Temporal exists if workflow complexity grows.

---

## 11. Verification Plan

1. **Unit tests**: Each module has tests with mocked HTTP responses/browser pages
2. **Integration test**: Full scan lifecycle test (URL → queue → modules → results → dashboard)
3. **Manual E2E**:
   - Submit a URL as anonymous → verify Peek results load
   - Register → verify full scan runs all modules
   - Pay via Stripe test mode → verify P2 report generates and downloads
   - Chat with scan → verify AI responds with scan context
4. **Security**: Run scan against own domain, verify rate limits, test with blocked geo IP
5. **Performance**: Scan should complete in < 4 minutes, dashboard should load in < 2s
6. **Browser testing**: Playwright for automated smoke tests on Chrome/Firefox/Safari

---

## 12. Cost Projections

| Scale | Monthly Scans | DigitalOcean | DataForSEO | Gemini AI | Resend | Total |
|-------|--------------|-------------|-----------|----------|--------|-------|
| Launch | 100 | $6 | ~$5 | ~$2 | $0 | ~$13 |
| Growth | 1,000 | $12 | ~$50 | ~$20 | $0 | ~$82 |
| Scale | 5,000 | $24 | ~$250 | ~$100 | $20 | ~$394 |

At 5,000 scans/mo with 10% conversion to paid ($9.99): **$4,995 revenue vs. $394 cost = 92% margin**.

---

## Critical Files to Create First
1. `package.json` (workspace root)
2. `apps/web/package.json` + Next.js config
3. `apps/engine/package.json` + Fastify setup
4. `packages/types/src/modules.ts` (module interface)
5. `apps/engine/src/modules/runner.ts` (orchestrator)
6. `supabase/migrations/` (database schema)
7. `.env.example` (all required environment variables)

---

---
---

# PART II: BACKEND ARCHITECTURE PRD

## BE-1. System Overview

The scan engine is a standalone Node.js/TypeScript service deployed on a DigitalOcean droplet inside Docker. It is never publicly accessible — all requests flow through Vercel which acts as a reverse proxy. The engine processes scan jobs asynchronously using BullMQ/Redis and writes results directly to Supabase via the service_role key.

### Internal Architecture

```
Fastify API Server (port 3001)
  ├── HMAC auth middleware (validates all inbound requests)
  ├── POST /engine/scans → enqueue scan job in BullMQ
  ├── GET /engine/scans/:id/status → read job state from Redis
  └── GET /engine/health → Redis + browser + memory status

BullMQ Worker (single concurrency)
  ├── Dequeues scan job
  ├── Creates ModuleRunner instance
  ├── Runs phases: passive → browser → ghostscan → external → synthesis
  ├── Each module result saved to Supabase immediately (progressive)
  └── Finalizes scan with MarketingIQ score

Playwright Browser Pool
  ├── Single persistent Chromium instance
  ├── New BrowserContext per scan (isolated cookies/storage)
  ├── New Page created per scan, shared across browser/ghostscan phases
  ├── Network interceptor attached to capture ALL requests
  └── Auto-restart on crash (max 3 restarts per scan)
```

## BE-2. HMAC Authentication

Every request from Vercel to the engine is signed with HMAC-SHA256. The payload is `${timestamp}.${method}.${url}.${bodyHash}`. Requests older than 30 seconds are rejected (replay attack prevention). Uses `crypto.timingSafeEqual` to prevent timing attacks.

## BE-3. Queue Architecture

- **Queue name:** `scans`
- **Priority:** paid=1, full=5, peek=10 (lower = higher priority)
- **Concurrency:** 1 (single scan at a time on $6 droplet)
- **Job-level retries:** 3 attempts, 30s fixed delay between attempts
- **Stalled interval:** 60s (detects crashed workers)
- **Lock duration:** 600s (10 min max per scan)
- **Cleanup:** completed jobs removed after 24h, failed after 7 days

## BE-4. Module Runner

The `ModuleRunner` class orchestrates all 45 modules across 5 phases. Key behaviors:
- **Phase-level execution:** passive and external phases run modules in parallel; browser and ghostscan phases run sequentially on a shared Playwright page
- **Module-level retries:** each module retried independently per the retry config (see Section 4 retry table)
- **Progressive saving:** each module result upserted to Supabase `module_results` table immediately upon completion
- **Graceful degradation:** single module failure never cascades to scan failure
- **Browser crash recovery:** if Playwright crashes, browser is restarted and remaining browser modules are attempted
- **Timeout enforcement:** per-module timeout via `Promise.race` with a timeout promise
- **Network collection:** all HTTP requests captured by a shared `NetworkCollector` during browser phases, distributed to modules that need them (M05, M06, M07, M08)

## BE-5. External Service Clients

### Supabase Client
- Uses `service_role` key (bypasses RLS) for server-side writes
- All writes use `upsert` with `onConflict: 'scan_id,module_id'` for idempotent retries
- Audit log entries for every scan start, completion, failure, and payment event

### Gemini AI Client
- `gemini-2.0-flash` for M41 (per-module synthesis, ~40 parallel calls), M44, M45, M46
- `gemini-2.0-pro` for M42 (final synthesis), M43 (PRD generation)
- Standardized prompt templates per module type
- Response validation with Zod to ensure structured output
- Retry on 429/503 with exponential backoff

### DataForSEO Client
- Basic auth (base64 encoded login:password)
- DRY: single `traffic_analytics/overview` call shared across M24-M26, M30, M32, M35
- Rate limiting: max 30 concurrent requests, 2000/min
- Minimum $100 balance (prepaid model)

## BE-6. Docker Deployment

`docker-compose.yml` runs two services:
- **engine:** Node.js app with Playwright + Chromium, limited to 768MB RAM
- **redis:** Redis 7 Alpine, limited to 128MB RAM, persistent volume for data

Dockerfile installs Playwright Chromium dependencies at build time. Production build uses `npm ci --production` + compiled TypeScript from `dist/`.

## BE-7. Error Handling Categories

| Category | Example | Action |
|----------|---------|--------|
| Recoverable module | Network timeout, DNS fail, element not found | Retry with backoff |
| Non-recoverable module | 403 blocking, API auth failure | Mark module `error`, continue scan |
| Fatal scan | URL unreachable after all retries, OOM | Fail scan, BullMQ retries job |
| Infrastructure | Supabase write failure, Redis disconnect | Log, retry, alert if persistent |

## BE-8. Monitoring

Fastify's built-in Pino logger outputs structured JSON to stdout. DigitalOcean metrics agent collects CPU, memory, disk. Health endpoint exposes: Redis status, browser pool status, queue depth, memory usage (RSS/heap), uptime.

---
---

# PART III: FRONTEND COMPONENTS PRD

## FE-1. Design System

### Color Palette (Sophisticated, muted, premium)
```
Primary:      #1A1A2E (Deep Navy)     — headings, primary text
Secondary:    #16213E (Dark Blue)      — secondary elements
Accent:       #0F3460 (Rich Blue)      — interactive elements, links
Highlight:    #E94560 (Soft Red)       — CTAs, critical alerts, pricing
Success:      #06D6A0 (Soft Green)     — good scores, passing checks
Warning:      #FFD166 (Warm Amber)     — medium scores, warnings
Error:        #EF476F (Soft Pink-Red)  — failures, critical issues
Background:   #FAFBFC (Off-White)      — page background
Surface:      #FFFFFF (White)          — card backgrounds
Border:       #E2E8F0 (Light Gray)     — subtle borders
Muted:        #94A3B8 (Slate)          — secondary text, labels

Hero gradient: linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)
```

### Typography (Bold, imposing, C-suite authority)
```
Headings:  "Plus Jakarta Sans" (Google Fonts, variable weight)
Body:      "Inter" (Google Fonts, variable weight)
Mono/Data: "JetBrains Mono" (Google Fonts)

H1: 4rem/800wt  H2: 2.5rem/800wt  H3: 1.75rem/700wt  H4: 1.25rem/700wt
Body: 1rem/400wt  Small: 0.875rem  Micro: 0.75rem
Headings: -0.02em letter-spacing (tight), 1.2 line-height
Body: normal letter-spacing, 1.5 line-height
```

### Shadows & Motion
```
Shadow SM:  0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)
Shadow LG:  0 10px 15px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05)
Shadow XL:  0 20px 25px rgba(0,0,0,0.06), 0 8px 10px rgba(0,0,0,0.04)

Hover: scale(1.01) + Shadow LG, 200ms ease
Cards: staggered entrance (0.05s delay per card), fade+slide up
Scroll: intersection observer triggers, fade+slide 0.6s
Score gauge: count-up animation from 0, 2s ease-out
Loading: pulse animation (opacity 0.4→1→0.4, scale 0.98→1→0.98)
```

### Layout Principles
```
Max content width: 1280px centered
Section padding: 6rem vertical
Card padding: 2rem, border-radius: 1rem
Bento grid: CSS Grid auto-fit, min 320px columns
Ample white space — content breathes
No rigid 12-column grid — organic, flowing layout
```

## FE-2. Page Structure & Components

### Landing Page — `app/(marketing)/page.tsx`
1. **NavBar** (sticky, backdrop-blur): Logo, Features, Pricing, Blog, Login/Register
2. **Hero**: "Reverse-Engineer Any Brand's Marketing Stack in Minutes" + URL input + Turnstile
3. **Social proof bar**: scan count, rating
4. **Features bento**: 6 cards showing 45 modules, GhostScan, AI synthesis, MarketingIQ, reports, chat
5. **How it works**: 3-step visual (Enter URL → We Scan → Get Insights)
6. **Pricing**: 3-tier cards (Peek free, Full Scan free, Alpha Brief ~~$29.99~~ $9.99)
7. **Final CTA**: duplicate URL input with compelling copy
8. **Footer**: nav links, legal links, social links

### Auth Pages — `app/(auth)/`
- `login/page.tsx`: Email + password, magic link, Google OAuth, Apple OAuth buttons
- `register/page.tsx`: Same as login but with name field, creates account
- `verify/page.tsx`: Email verification confirmation
- All use `AuthForm` component with shadcn/ui inputs, Supabase Auth client

### Scan Progress — `app/(dashboard)/scan/[id]/loading.tsx`
- SSE connection to `/api/scans/:id/stream`
- Animated progress bar (percentage = completed modules / total modules)
- Phase indicator (1-5 with current highlighted)
- Completed module list with scores (fade in as they complete)
- In-progress module with spinner
- Email capture form (shown to unauthenticated users during scan)
- Estimated time remaining

### P1 Bento Dashboard — `app/(dashboard)/scan/[id]/page.tsx`
- **Header**: domain, scan date, MarketingIQ score gauge, action buttons (Download Report, Chat)
- **Category scores bar**: traffic light indicators per category (Security, Performance, etc.)
- **Tech stack summary**: detected technologies grouped by category with icons
- **Module cards grid**: bento layout, each card shows module name, score, top 3-5 signals, expand button
- **Expanded module view**: full signal list, charts/tables, AI synthesis, recommendations
- **AI insights section**: top findings and opportunities from M42
- **Upgrade CTA** (if not paid): "Unlock the Executive Report" with value proposition

### P2 McKinsey Report — `app/(dashboard)/report/[id]/page.tsx`
- Web-first layout with print-optimized `@media print` CSS
- Cover page with brand info, score, date, confidentiality
- Table of contents with anchor links
- Executive summary (1 page)
- Category deep dives with charts (using Recharts: bar, line, radar, treemap)
- Recommendations matrix (impact × effort quadrant chart)
- ROI simulator results (M44)
- Cost cutter analysis (M45)
- Technical appendix with full signal data
- Sources/citations throughout
- PDF download via `window.print()` with print stylesheet (or Puppeteer server-side for pixel-perfect)

### P3 AI Chat — `app/(dashboard)/chat/[id]/page.tsx`
- Message list with user/assistant roles
- Message input with send button
- Credit counter display
- Messages reference scan data with `[Source: M06, M05]` citations
- Typing indicator during AI response
- Message persistence in Supabase `chat_messages` table

### Blog — `app/(marketing)/blog/[slug]/page.tsx`
- MDX files in `content/under-the-stack/`
- Blog index page with card grid
- Individual post with MDX rendering (supports React components inline)
- SEO: generateMetadata for OG tags, JSON-LD Article schema
- Related posts at bottom

## FE-3. Key Component Inventory

| Component | File | Description |
|-----------|------|-------------|
| `ScanInput` | `components/scan/scan-input.tsx` | URL input, validation, Turnstile, submit |
| `ScanProgress` | `components/scan/scan-progress.tsx` | SSE-powered real-time progress |
| `BentoDashboard` | `components/scan/bento-dashboard.tsx` | Main P1 grid layout |
| `ModuleCard` | `components/scan/module-card.tsx` | Individual module result (collapsed/expanded) |
| `ScoreGauge` | `components/scan/score-gauge.tsx` | Animated SVG circular gauge |
| `TrafficLight` | `components/scan/traffic-light.tsx` | Red/yellow/green dot with label |
| `SignalBadge` | `components/scan/signal-badge.tsx` | Tech/signal badge with confidence level |
| `CategoryBar` | `components/scan/category-bar.tsx` | Horizontal category scores overview |
| `TechStack` | `components/scan/tech-stack.tsx` | Grouped technology icons/labels |
| `ReportView` | `components/report/report-view.tsx` | P2 web presentation layout |
| `ChatInterface` | `components/chat/chat-interface.tsx` | Message list + input + credits |
| `PricingCards` | `components/marketing/pricing-cards.tsx` | 3-tier pricing with anchor price |
| `EmailCapture` | `components/scan/email-capture.tsx` | In-scan email collection |
| `AuthForm` | `components/auth/auth-form.tsx` | Login/register with email+OAuth |
| `NavBar` | `components/marketing/navbar.tsx` | Sticky nav with blur backdrop |
| `Footer` | `components/marketing/footer.tsx` | Footer with links |

## FE-4. Authentication Flow

```
Anonymous → URL submit → Peek scan (no auth needed)
During scan → email capture prompt → Supabase createUser + sendMagicLink
Email verified → scan auto-upgrades to Full tier
Dashboard loads → "Download Report $9.99" CTA
User clicks → Stripe Checkout → payment → webhook → tier=paid → synthesis runs
Chat available → user sends message → Gemini responds with scan context
```

OAuth: Google/Apple buttons → Supabase OAuth → callback → session → redirect to dashboard

## FE-5. PostHog Analytics

Reverse proxy via Next.js rewrites (`/ingest/*` → `https://us.i.posthog.com/*`).

Key events: `scan_started`, `scan_completed`, `email_captured`, `report_purchased`, `chat_message_sent`, `module_expanded`, `page_viewed`.

Feature flags: `pricing_experiment`, `chat_enabled`, `new_dashboard`.

## FE-6. Stripe Integration

Two products: `alpha_brief` ($9.99) and `chat_credits` ($4.99).
Flow: Frontend → `POST /api/checkout` → Stripe Checkout Session → user pays → webhook at `POST /api/webhooks/stripe` → verify signature → insert payment → upgrade tier → trigger synthesis → send receipt email via Resend.

## FE-7. SSE Progress Streaming

`GET /api/scans/:id/stream` opens an SSE connection. The route polls Supabase every 2 seconds for scan status and module results. Only sends data when state changes. Closes when scan status is `complete` or `failed`. Frontend uses `EventSource` to consume the stream and update the progress UI in real time.

---

## APPENDIX A: Exhaustive Module Specifications

### Shared Utilities (DRY — reused across modules)

```
apps/engine/src/utils/
├── http.ts          # fetch with retries, redirect following, header extraction
├── dns.ts           # DNS resolver wrapper (A, AAAA, MX, NS, TXT, CNAME, SOA, CAA)
├── html.ts          # cheerio-based HTML parser, meta tag extractor, link extractor
├── url.ts           # URL normalization, domain extraction, path probing
├── network.ts       # Playwright network request collector & classifier
├── cookies.ts       # Cookie parser, classifier (analytics, marketing, functional, necessary)
├── js-globals.ts    # Playwright window.* object detector (check for known globals)
├── signals.ts       # Signal builder helpers (confidence scoring, evidence formatting)
├── page-prober.ts   # Common page probing (scroll, click, hover, form fill)
└── carbon.ts        # CO2 calculation using Sustainable Web Design model
```

**Key shared libraries:**
- `cheerio` — HTML parsing (passive modules)
- `playwright` — headless browser (browser + ghostscan modules)
- `node:dns/promises` — DNS resolution
- `mailauth` — SPF/DMARC/DKIM parsing
- `tldts` — domain/TLD extraction
- `zod` — runtime data validation
- `co2.js` — carbon footprint calculation (Green Web Foundation)

---

### M01: DNS & Security Baseline
**Phase:** Passive | **Tier:** Peek | **Timeout:** 15s | **Retries:** 4

**Signals to extract:**
- DNS records: A, AAAA, MX, NS, TXT, CNAME, SOA, CAA, DNSKEY, DS
- SPF record: parse mechanisms (ip4, ip6, include, a, mx, all), qualifier (~, -, +, ?), max lookups, flattened chain
- DMARC record: policy (none/quarantine/reject), rua/ruf endpoints, pct, sp, aspf, adkim
- DKIM: probe common selectors (google, default, s1, s2, selector1, selector2, k1, dkim, mandrill, mailgun, sendgrid, amazonses), key type, key length
- DNSSEC: signed/unsigned, DS record, DNSKEY algorithm, validation chain status
- TLS certificate: issuer, subject, SAN entries, expiry date, days until expiry, protocol version (TLS 1.2/1.3), cipher suite, certificate chain depth, CT log presence, OCSP stapling, key type (RSA/ECDSA), key size
- HTTPS redirect chain: full chain (http → https, www → non-www or vice versa), redirect count, final URL, HSTS preload list inclusion
- HTTP security headers: Strict-Transport-Security (max-age, includeSubDomains, preload), Content-Security-Policy (full directive breakdown), X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy (all directives), Cross-Origin-Embedder-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy
- Nameserver provider identification (Cloudflare, AWS Route53, Google Cloud DNS, GoDaddy, etc.)
- Email infrastructure: Google Workspace, Microsoft 365, ProtonMail, Zoho, custom, identified from MX records
- CAA records: allowed CAs, iodef reporting
- IP geolocation of A record (country, region, ASN, hosting provider)

**Detection method:** `node:dns/promises` for all DNS lookups, `mailauth` for SPF/DMARC/DKIM parsing, `node:tls` for certificate inspection, HTTP GET for header analysis, IP geolocation via free MaxMind GeoLite2 database.

**Libraries:** `node:dns/promises`, `mailauth`, `node:tls`, `tldts`, `geoip-lite`

---

### M02: CMS & Infrastructure
**Phase:** Passive | **Tier:** Peek | **Timeout:** 15s | **Retries:** 4

**Signals to extract:**
- CMS: WordPress (wp-content, wp-json), Shopify (cdn.shopify.com, Shopify.theme), Webflow (webflow.js), Wix (wix.com scripts), Squarespace (_squarespace), Drupal (Drupal.settings), Joomla (/media/jui), Ghost (/ghost/), Contentful, Strapi, Sanity, Prismic, HubSpot CMS, Adobe Experience Manager
- CMS version: meta generator tag, known version-specific paths, changelog files
- CDN: Cloudflare (cf-ray header, __cfduid), CloudFront (x-amz-cf-id, .cloudfront.net), Akamai (x-akamai-transformed), Fastly (x-served-by, x-cache fastly), Vercel (x-vercel-id), Netlify (x-nf-request-id), Bunny CDN, KeyCDN, StackPath, Azure CDN
- Server: nginx, Apache, IIS, LiteSpeed, Caddy, Express, Kestrel — from Server header + behavior fingerprinting
- Server-side language: PHP (x-powered-by, .php extensions), Node.js (x-powered-by: Express), Python (Django, Flask headers), Ruby (x-runtime, x-request-id rails patterns), .NET (x-aspnet-version, x-powered-by: ASP.NET), Java (x-powered-by: Servlet, JSESSIONID cookie), Go (no specific headers, detect by exclusion)
- Framework: React (data-reactroot, __NEXT_DATA__), Next.js (__NEXT_DATA__, _next/), Vue (__vue, data-v-), Nuxt (__NUXT__), Angular (ng-version, ng-app), Svelte, Remix, Gatsby, Astro, Eleventy
- Hosting provider: AWS (amazonaws.com in headers/IPs, x-amzn-*), GCP (*.run.app, *.appspot.com), Azure (*.azurewebsites.net), DigitalOcean (IP ranges), Heroku (*.herokuapp.com), Fly.io, Railway, Render
- Database hints: x-powered-by postgres, MongoDB ObjectId patterns, Redis session IDs, Supabase (sb-* cookies)
- API tech: GraphQL (/__graphql endpoint, graphql in scripts), REST, gRPC-web
- Build tool: Webpack (webpackJsonp), Vite, Parcel, Turbopack, esbuild — from bundled JS patterns
- JavaScript libraries: jQuery (jQuery version), Lodash, Moment.js, Axios, Three.js — from window globals or script sources
- HTTP/2 or HTTP/3 support
- Compression: gzip, brotli, deflate — from content-encoding header
- Server IP, ASN, and datacenter location

**Detection method:** HTTP HEAD + GET requests, response header analysis, HTML source pattern matching with cheerio, known URL path probing (/wp-json, /robots.txt, /.well-known), IP-to-ASN lookup.

**Libraries:** `cheerio`, `tldts`, `geoip-lite`, custom fingerprint database (JSON file of patterns)

---

### M04: Page Metadata
**Phase:** Passive | **Tier:** Peek | **Timeout:** 15s | **Retries:** 4

**Signals to extract:**
- Title tag: content, length, truncation risk
- Meta description: content, length, truncation risk
- All meta tags: charset, viewport, theme-color, format-detection, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, msapplication-*, google-site-verification, facebook-domain-verification, p:domain_verify (Pinterest), yandex-verification, bing-verification
- Open Graph: og:title, og:description, og:image (URL, dimensions if fetchable), og:url, og:type, og:site_name, og:locale, og:video, og:audio, article:published_time, article:author
- Twitter Cards: twitter:card, twitter:site, twitter:creator, twitter:title, twitter:description, twitter:image, twitter:player
- Schema.org / JSON-LD: all structured data types (Organization, WebSite, Product, Article, FAQPage, BreadcrumbList, LocalBusiness, etc.), extracted and parsed, validation against schema.org spec
- robots.txt: full content, directives per user-agent, disallowed paths, sitemap references, crawl-delay
- Sitemap.xml: URL count, last modified dates, changefreq distribution, nested sitemap index detection, image/video sitemaps
- llms.txt: presence, content, AI crawling directives
- Canonical URL: self-referencing or different, consistency across pages
- Hreflang: language/region tags, x-default, reciprocal validation
- Favicon: presence, format (ico, png, svg), sizes, apple-touch-icon, manifest icons
- manifest.json: name, short_name, display mode (standalone, fullscreen), orientation, theme_color, background_color, icons, start_url, scope — PWA readiness
- RSS/Atom feeds: auto-discovery links
- Preconnect/prefetch/preload hints: resources being prioritized
- Language: html lang attribute, content-language header
- Author/publisher: meta author, article:author, publisher schema
- Pagination: rel=next/prev
- AMP: amphtml link

**Detection method:** HTTP GET + cheerio HTML parsing, separate HTTP GETs for /robots.txt, /sitemap.xml, /llms.txt, /manifest.json, /favicon.ico.

---

### M03: Page Load & Performance
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Core Web Vitals: LCP (element, value, rating), INP (value, rating), CLS (value, shift sources, rating)
- Performance timing: TTFB, FCP, Speed Index, TBT, DOM Content Loaded, DOM Complete, Load Event, Time to Interactive
- Resource breakdown: total requests, total bytes transferred, by type (JS, CSS, images, fonts, media, XHR/fetch, other), by domain (first-party vs third-party), by protocol (h1/h2/h3)
- Largest resources: top 10 by size (URL, type, size, load time)
- Render-blocking resources: CSS and JS that block first paint (URL, size, load time)
- Long tasks: tasks > 50ms (count, total blocking time, longest task)
- DOM stats: total nodes, max depth, elements with inline styles count, total unique selectors
- Image analysis: total images, unoptimized (no srcset, no lazy loading, oversized for viewport, non-modern format), WebP/AVIF usage, SVG count
- Font loading: number of custom fonts, font-display values, FOIT/FOUT risk, total font bytes, font formats (woff2, woff, ttf)
- Compression: which resources are gzipped/brotli'd, which aren't, total savings opportunity
- Cache analysis: resources without Cache-Control, short TTL resources, immutable resources, ETag usage
- Third-party impact: third-party requests count, bytes, domains, estimated blocking time
- Network waterfall: full request/response timing for all resources (DNS, TCP, TLS, TTFB, download)
- JavaScript execution: total JS bytes, parsed/compiled time if available, unused JS estimate
- CSS analysis: total CSS bytes, unused CSS estimate, critical CSS coverage

**Detection method:** Playwright with `page.goto()` + Performance Observer API via `page.evaluate()`, CDP `Performance.getMetrics()`, network interception for resource analysis.

**Libraries:** `playwright`, `web-vitals` (injected via evaluate), CDP protocol

---

### M05: Analytics Architecture
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Google Analytics 4: measurement ID (G-*), config parameters, debug mode, consent mode, enhanced measurement events, user_id, user properties, custom dimensions, data streams
- Google Universal Analytics (legacy): tracking ID (UA-*), cross-domain linker, enhanced ecommerce, custom dimensions/metrics
- Google Tag Manager: container IDs (GTM-*), dataLayer contents (full snapshot), dataLayer.push events fired on load, consent mode status, server-side GTM indicators (custom endpoint)
- Adobe Analytics: s_account, s.pageName, s.eVar*, s.prop*, s.events, AppMeasurement version, visitor ID service (ECID)
- Mixpanel: window.mixpanel, token, distinct_id, tracking calls
- Amplitude: window.amplitude, API key, device_id, session_id
- Heap: window.heap, app_id, identity
- Segment: window.analytics, writeKey, anonymous_id, traits
- Rudderstack: window.rudderanalytics, writeKey, dataPlane URL
- mParticle: window.mParticle, apiKey, identity
- PostHog: window.posthog, token, distinct_id, feature flags, session recording status
- Pendo: window.pendo, apiKey, visitor/account metadata
- FullStory: window._fs_org, session URL, identity
- Hotjar: window.hj, site ID, recording/heatmap status
- Microsoft Clarity: window.clarity, project ID
- Plausible: data-domain attribute, script source
- Fathom: site ID, script source
- Matomo/Piwik: _paq array, site ID, tracker URL
- Tracking pixels fired: all image/script requests to known analytics domains
- Consent-aware tracking: Google Consent Mode status (ad_storage, analytics_storage, etc.), OneTrust/Cookiebot integration
- Server-side tracking indicators: requests to custom /collect endpoints, Measurement Protocol patterns
- User ID signals: any user identification calls (GA4 set user_id, Segment identify, etc.)
- Cross-domain tracking: linker parameters, cookie domain settings
- Data layer: full window.dataLayer dump, all custom variables, ecommerce data
- Cookie inventory: all analytics-related cookies with name, value (truncated), domain, expiry, secure, httpOnly, sameSite

**Detection method:** Playwright `page.evaluate()` to check window globals, network interception to catch pixel fires, cookie analysis via `context.cookies()`, dataLayer inspection.

---

### M06: Paid Media Infrastructure
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Meta/Facebook Pixel: fbq() calls, pixel ID, events tracked (PageView, ViewContent, AddToCart, Purchase, Lead, CompleteRegistration, etc.), custom events, advanced matching parameters, Conversions API (CAPI) indicators (server event deduplication IDs)
- Google Ads: gtag('config', 'AW-*'), conversion IDs, conversion labels, enhanced conversions (user data hashed), Google Ads remarketing tag, dynamic remarketing parameters
- Google Ads click IDs: gclid in URL params, auto-tagging detection, GCLID cookie (_gcl_aw)
- TikTok Pixel: ttq.track() calls, pixel ID, events
- LinkedIn Insight Tag: _linkedin_partner_id, conversion tracking, matched audiences
- Twitter/X Pixel: twq(), pixel ID, events
- Pinterest Tag: pintrk(), tag ID, events
- Snapchat Pixel: snaptr(), pixel ID, events
- Reddit Pixel: rdt(), pixel ID, events
- Microsoft/Bing UET: window.uetq, tag ID, events
- Quora Pixel: qp(), pixel ID
- Click IDs in URL: gclid, fbclid, ttclid, li_fat_id, msclkid, twclid, ScCid, rdt_cid, epik (Pinterest)
- UTM parameters: utm_source, utm_medium, utm_campaign, utm_term, utm_content
- Attribution cookies: _fbp, _fbc, _gcl_au, _gcl_aw, _ttp, _uetmsclkid, li_sugr
- Retargeting/audience pixels: custom audience signals, lookalike source events
- Ad network scripts: all scripts loaded from ad-related domains (count, domains, total bytes)
- Offline conversion indicators: upload hashed data patterns, user-data-web consent signals
- CAPI/Server-side: detection of server endpoints receiving conversion events (non-browser pixel fires)

**Detection method:** Playwright network interception (filter by ad domains), `page.evaluate()` for pixel globals, URL parameter parsing, cookie analysis.

---

### M06b: PPC Landing Page Audit (NEW — Hidden Paid Traffic Page Discovery)
**Phase:** Browser (after M06) + Passive enrichment in Phase 4 | **Tier:** Full | **Timeout:** 45s | **Retries:** 3

**Purpose:** Discover hidden PPC/paid traffic landing pages that are not linked from the main navigation, then audit their tracking configuration against the main site to reveal attribution gaps, compliance violations, and wasted ad spend.

**Why this matters:** Brands commonly create dedicated landing pages for paid campaigns in hidden subfolders (`/lp/`, `/go/`, `/a/best-product-campaign/`). These pages often have different (or broken) tracking compared to the main site. If the PPC page doesn't fire the same pixels as the main site, every ad click landing there is partially invisible — making ROAS appear 15-30% lower than reality and breaking attribution models.

**Discovery vectors (Phase 2 — browser phase):**

1. **Common PPC path pattern probing** — HTTP HEAD requests to known paid traffic folder patterns:
   - Paths: `/lp/`, `/landing/`, `/go/`, `/get/`, `/offer/`, `/promo/`, `/campaign/`, `/demo/`, `/free-trial/`, `/request-demo/`, `/signup/`, `/start/`, `/try/`, `/book/`, `/schedule/`
   - A/B variants: `/a/`, `/b/`, `/v1/`, `/v2/`
   - Suffix patterns: `/*-ppc`, `/*-paid`, `/*-ad`, `/*-sem`, `/*-campaign`, `/*-offer`
   - Subdomains: `lp.{{domain}}`, `offer.{{domain}}`, `get.{{domain}}`, `pages.{{domain}}`, `info.{{domain}}`, `go.{{domain}}`
   - Check response: 200 OK = discovered, 301/302 = follow and record, 404 = skip

2. **Sitemap URL mining (from M04)** — Scan all sitemap URLs for:
   - URLs matching PPC path patterns above
   - URLs with `noindex` meta tag (PPC pages are often noindex'd to prevent organic cannibalization)
   - URLs excluded from sitemap but present in robots.txt Disallow rules (reveals folder structures)

3. **robots.txt Disallow analysis (from M04)** — Disallowed paths often reveal PPC infrastructure:
   - `Disallow: /lp/` → confirms PPC folder exists
   - `Disallow: /campaign/` → reveals campaign structure
   - Use disallowed paths as probing targets (the page exists even if robots can't crawl it)

4. **Internal link extraction (from browser phase)** — During main page scan, collect ALL internal URLs from:
   - HTML `<a href>` tags (cheerio + Playwright)
   - JavaScript string literals containing internal URLs
   - JSON-LD `url` fields
   - Dynamically generated navigation (Playwright DOM after JS execution)
   - Network requests to internal URLs (XHR/fetch)
   - Filter for landing-page-like patterns

5. **Meta tag clues** — Pages with `<meta name="robots" content="noindex, nofollow">` that are still internally linked or appear in sitemaps are likely PPC/campaign pages

**Phase 2 scan (browser — up to 5 discovered pages):**

For each discovered PPC page, open in the SAME browser context and run a focused mini-scan:

| Check | What We Extract | How |
|-------|----------------|-----|
| **Tracking scripts present** | All analytics/pixel script tags in HTML source | cheerio parse of page HTML |
| **Tracking scripts firing** | Network requests to analytics/ad domains after page load | Playwright network interception (same approach as M05/M06) |
| **GA4/GTM containers** | Measurement IDs, container IDs on PPC page | `page.evaluate()` for window globals |
| **Ad pixels firing** | fbq(), gtag('event'), ttq.track() calls | `page.evaluate()` + network interception |
| **Consent banner present** | Same consent mechanism as main site? | DOM inspection for consent banner elements |
| **Cookies set** | Cookie inventory on PPC page | `context.cookies()` comparison |
| **Performance** | LCP, FCP, TTFB of PPC page | Performance Observer API |
| **UTM handling** | Visit PPC page WITH utm_source=test — do params persist through navigation? | Navigate with UTM params, check if they survive |
| **Conversion elements** | Forms, CTAs, phone numbers, chat widgets | DOM inspection |
| **noindex status** | Is the page noindex'd? (expected for PPC pages) | Meta tag check |

**Parity analysis (the core output):**

Compare PPC page tracking to the main page baseline (from M05/M06):

```typescript
interface TrackingParityResult {
  ppc_page_url: string;
  discovery_method: 'pattern_probe' | 'sitemap' | 'robots_disallow' | 'internal_link' | 'ad_library' | 'dataforseo';

  // What's on the main page
  main_page_tracking: {
    analytics_tools: string[];      // ['GA4 G-1234567', 'GTM GTM-ABC123']
    ad_pixels: string[];            // ['Meta Pixel 9876543', 'Google Ads AW-111222']
    consent_provider: string | null;
  };

  // What's on the PPC page
  ppc_page_tracking: {
    analytics_tools: string[];
    ad_pixels: string[];
    consent_provider: string | null;
  };

  // The delta — this is the finding
  missing_on_ppc: {
    analytics_tools: string[];      // Tools on main page but NOT on PPC page
    ad_pixels: string[];            // Pixels on main page but NOT on PPC page
    consent_banner: boolean;        // true = consent missing on PPC page
  };

  extra_on_ppc: {
    analytics_tools: string[];      // Tools on PPC page but NOT on main page (different config)
    ad_pixels: string[];            // Extra pixels (maybe PPC-specific)
  };

  performance_delta: {
    main_lcp_ms: number;
    ppc_lcp_ms: number;
    delta_ms: number;               // positive = PPC is slower
  };

  utm_persistence: boolean;         // Do UTM params survive through forms/navigation?

  risk_assessment: {
    attribution_gap: 'critical' | 'warning' | 'none';
    compliance_gap: 'critical' | 'warning' | 'none';
    performance_gap: 'critical' | 'warning' | 'none';
  };
}
```

**Phase 4 enrichment (passive — after M21 and M28 complete):**

When M21 (Ad Library) and M28 (Top Paid Keywords) return landing page URLs:
1. Cross-reference with pages already scanned in Phase 2
2. For any NEW URLs not yet scanned: run **passive-only** analysis (HTTP GET + cheerio) to check for tracking script presence in HTML source
3. Less thorough than browser scan (can't detect if scripts FIRE, only if they LOAD) but still catches the biggest gaps: "This ad points to /lp/spring-sale/ which doesn't even have the GA4 script tag in its HTML"

**Signals to extract (summary):**
- Total PPC landing pages discovered (count, by discovery method)
- Pages with full tracking parity (green)
- Pages with partial tracking (yellow — some tools missing)
- Pages with no/broken tracking (red — critical attribution gap)
- Pages missing consent mechanism (compliance violation)
- Performance comparison (main vs. PPC page average LCP)
- UTM parameter handling across PPC pages
- Estimated revenue impact of tracking gaps (fed into M44 ROI Simulator)

**Scoring checkpoints for M06b:**

| Checkpoint | Weight | Excellent | Good | Warning | Critical |
|-----------|--------|-----------|------|---------|----------|
| PPC pages discovered | 3 | ≥1 found (means brand runs PPC) | — | — | Info only |
| Tracking parity (analytics) | 10 | All PPC pages match main site | >80% match | 50-80% match | <50% match |
| Tracking parity (ad pixels) | 10 | All PPC pages fire same pixels | >80% match | 50-80% match | <50% match |
| Consent banner parity | 9 | All PPC pages have consent | >80% have consent | 50-80% have consent | <50% have consent |
| PPC page performance | 5 | PPC LCP ≤ main LCP | PPC LCP ≤ main+500ms | PPC LCP ≤ main+1500ms | PPC LCP > main+1500ms |
| UTM persistence | 6 | UTMs persist through forms | UTMs in URL only | UTMs dropped on redirect | Not testable |
| noindex on PPC pages | 3 | All PPC pages noindex'd | >80% noindex'd | <80% noindex'd | None noindex'd (SEO cannibalization risk) |

**Detection method:** HTTP HEAD probing for discovery, Playwright for browser-phase mini-scans (shared browser context), cheerio for Phase 4 passive enrichment, network interception for pixel fire detection, cookie comparison.

**Resource budget:** Max 5 PPC pages scanned with browser in Phase 2 (limit to prevent timeout). Additional pages via passive-only in Phase 4 (no limit, HTTP GETs are cheap).

---

### M07: MarTech Orchestration
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Marketing automation: HubSpot (hs-script-loader, _hsq, hubspot tracking code), Marketo (munchkin, mktoForm), Pardot (piAId, piCId), ActiveCampaign (trackcmp), Mailchimp (mc.js, mcPopup), Klaviyo (window.klaviyo, _learnq), Braze (window.appboy/braze), Iterable, Customer.io (window._cio), Drip (window._dcq), ConvertKit
- CRM signals: Salesforce (sfdc), HubSpot CRM, Zoho CRM, Pipedrive — detected from form actions, hidden fields, cookie patterns
- Email capture forms: all form elements with email inputs (action URL, hidden fields, method, form builder used)
- Popup/modal tools: OptinMonster, Sumo, Hello Bar, Privy, Sleeknote, Wisepops, Justuno, Unbounce popups — from script sources and DOM elements
- Live chat: Intercom (window.Intercom, intercomSettings), Drift (window.drift), Zendesk (window.zE), Crisp (window.$crisp), Tawk.to (window.Tawk_API), LiveChat (window.LiveChatWidget), Tidio, Olark, Freshchat, HubSpot chat
- Chatbot/AI: Intercom Fin, Drift bot, Ada, Qualified, custom chatbot indicators
- Push notifications: OneSignal, PushEngage, Pushwoosh, WebPush, Firebase Cloud Messaging (FCM)
- SMS marketing: Attentive, Postscript, Klaviyo SMS — form fields with phone number collection
- CDP signals: Segment, Rudderstack, mParticle, Tealium AudienceStream
- Personalization engines: Optimizely, Dynamic Yield, Monetate, Evergage/Interaction Studio
- Notification/engagement: Beamer (changelog), Canny, UserVoice, Appcues, Pendo guides, Intercom tours, WalkMe, Chameleon
- Cookies set by MarTech tools: comprehensive inventory with tool attribution
- Form builders: Typeform, JotForm, Google Forms, HubSpot Forms, Marketo Forms, Gravity Forms, WPForms, Formstack
- Scheduling tools: Calendly, HubSpot meetings, Acuity, SavvyCal — embed detection
- Referral/affiliate: ReferralCandy, Ambassador, Impact, ShareASale, CJ Affiliate — script/cookie detection
- Review/testimonial widgets: Trustpilot widget, G2 badges, Capterra badges, Yotpo, Bazaarvoice
- Video platforms: Wistia, Vidyard, Vimeo, YouTube embeds — with tracking integration detection

**Detection method:** Playwright `page.evaluate()` for window globals, DOM inspection for chat widgets/forms/modals, network interception for MarTech domains, cookie inventory.

---

### M08: Tag Governance
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- TMS providers: GTM (container IDs, multiple containers), Tealium iQ (utag.js, profile), Adobe Launch (satellite-*), Ensighten (Ensighten.js), Segment
- Container inventory: all container IDs found, per-container tag count estimate
- dataLayer analysis: full dataLayer snapshot on page load, all keys and value types, ecommerce data structure, custom dimensions, user properties
- Tag firing audit: tags fired on page load (passive), tags fired on scroll, tags fired on click (active probing)
- Consent mode: Google Consent Mode status, consent signal integration (OneTrust → GTM, Cookiebot → GTM), default vs. updated consent states
- Tag sequencing: tag firing order, race conditions (pixel fires before consent)
- Custom HTML tags: inline script tags injected by TMS (security risk assessment)
- Tag errors: failed tag loads, console errors from tags, blocked requests
- Multiple TMS conflict: more than one TMS detected (GTM + Tealium = governance issue)
- Server-side tagging: GTM server container indicators (transport_url, custom /g/collect endpoint)
- Tag categories: count by category (analytics, advertising, social, utility, unknown)
- Piggyback tags: tags loaded by other tags (chain detection)
- Tag latency: load time per tag (from network timing)

**Detection method:** Playwright `page.evaluate()` for dataLayer, GTM internals (`google_tag_manager` object), network interception for tag-related requests, active probing (scroll + click) to trigger interaction-based tags.

---

### M09: Behavioral Intelligence (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- A/B testing tools: Optimizely (window.optimizely, experiment data), VWO (window._vwo_code, _vis_opt), LaunchDarkly (window.ldclient), Split.io, Statsig, GrowthBook, Kameleoon, AB Tasty, Convert
- Active experiments: experiment IDs, variation assignments, experience names if accessible
- Session recording: FullStory (window._fs_org), Hotjar (window.hj, hj.settings), LogRocket (window.LogRocket), Mouseflow, Microsoft Clarity (window.clarity), Lucky Orange, Smartlook, PostHog recordings
- Heatmap signals: Hotjar heatmap active, Crazy Egg, ClickTale, Mouseflow heatmaps
- Feature flags: LaunchDarkly, Flagsmith, Unleash, ConfigCat, Split.io — detected from globals and network calls
- User segmentation cookies: visitor type (new/returning), cohort IDs, experiment bucket cookies
- Personalization: Dynamic content based on cookies/state, geo-personalization, behavioral triggers
- Browser state dump: all localStorage keys + value types/sizes (not values for privacy), all sessionStorage keys, all cookies with attributes, IndexedDB database names
- Service Workers: registered scope, active, waiting, types of cached resources
- Web Workers: detected worker scripts
- Progressive profiling: forms that adapt based on known user data (hidden field pre-fill)

**Active probing (GhostScan interactions):**
1. Scroll to 25%, 50%, 75%, 100% — observe new network requests (scroll-triggered pixels/tags)
2. Wait 30s idle — observe time-based triggers (exit intent, engagement popups)
3. Move mouse to corners — detect exit-intent popups
4. Click on CTA buttons — observe conversion tracking events fired
5. Open/close navigation — detect interaction-based tag firing

**Detection method:** Playwright `page.evaluate()` for tool globals, localStorage/sessionStorage enumeration, cookie dump, network monitoring during active probing.

---

### M10: Accessibility Overlay Detection (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Overlay tools: AccessiBe (acsb- prefixed elements), UserWay (userway widget), AudioEye, EqualWeb, MaxAccess, TruAbilities, Recite Me — from script sources, DOM elements, window globals
- WCAG quick audit: heading hierarchy (h1-h6 order), missing alt text count, empty links count, form labels present, color contrast issues (computed styles), ARIA roles used, landmark regions (main, nav, footer, header), skip navigation link, focus indicators visible, keyboard navigability (tab order)
- Screen reader compatibility: ARIA live regions, aria-label/aria-labelledby coverage, role attributes, hidden content (aria-hidden), announcements
- Language attributes: html lang, lang on foreign-language content
- Focus management: visible focus indicators, focus trap in modals, programmatic focus
- Touch targets: elements smaller than 44x44px (mobile accessibility)
- Media alternatives: video captions/subtitles, audio descriptions
- Auto-playing media: auto-play video/audio without controls
- Overlay widget functionality test: if overlay detected, probe its activation and check what it actually changes

**Active probing:**
1. Tab through first 20 focusable elements — check focus visibility
2. Click accessibility widget (if detected) — observe DOM changes
3. Check keyboard operability of key interactions (menus, modals, dropdowns)

**Detection method:** Playwright DOM analysis, computed style inspection for contrast, element size measurement, ARIA attribute scanning.

---

### M11: Console & Error Logging (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- JavaScript errors: all console.error messages (message, stack trace, source file, line number)
- Warnings: all console.warn messages
- Deprecation notices: deprecated API usage warnings
- Network errors: 4xx responses (URL, status), 5xx responses (URL, status), failed requests (DNS, timeout, CORS)
- Mixed content: HTTP resources loaded on HTTPS page
- CSP violations: Content-Security-Policy violation reports
- CORS errors: blocked cross-origin requests
- Unhandled promise rejections: rejection reasons
- Resource loading failures: failed images, scripts, stylesheets, fonts
- Error monitoring tools: Sentry (window.__SENTRY__, Sentry.init), Bugsnag (window.Bugsnag, bugsnag API key), Datadog RUM (window.DD_RUM), New Relic (window.newrelic, NREUM), Rollbar (window.Rollbar), LogRocket, TrackJS
- Error frequency: total error count, unique errors, errors per category
- Console.log count: development artifacts left in production
- Performance warnings: layout shift warnings, long task warnings

**Active probing (error provocation):**
1. Navigate to common 404 paths (/asdf, /404-test) — capture error handling
2. Resize viewport rapidly — trigger responsive/layout errors
3. Click interactive elements — trigger JS errors from broken handlers
4. Submit forms with invalid data — capture validation errors
5. Block critical resources (via route.abort) — observe graceful degradation

**Detection method:** Playwright `page.on('console')`, `page.on('pageerror')`, `page.on('requestfailed')`, CDP `Runtime.exceptionThrown`, network interception for HTTP errors.

---

### M12: Legal, Security & Compliance (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Privacy policy: URL found, last updated date, GDPR mentions, CCPA mentions, data controller identified, DPO contact, data retention policies, international transfer mechanisms
- Terms of Service: URL found, last updated date
- Cookie policy: separate cookie policy page, cookies listed, categories defined
- Cookie consent banner: provider (OneTrust, Cookiebot, CookieYes, TrustArc, Osano, Complianz, GDPR Cookie Consent), banner appears on load, accept/reject options, granular consent categories, consent mode integration, behavior (accept-all auto-enabled cookies count, reject-all remaining cookies count)
- GDPR compliance: consent before tracking, right to erasure link (DSAR), data processing agreements mentioned, legitimate interest claims, privacy shield / EU-US Data Privacy Framework
- CCPA compliance: "Do Not Sell My Personal Information" link, opt-out mechanism, CA consumer rights
- HIPAA indicators (healthcare): BAA mentions, PHI handling policies, encrypted data at rest, access controls mentioned
- SOC 2 indicators: trust page, security certifications displayed, SOC 2 badge/report link
- PCI DSS 4.0: payment page script inventory (Req 6.4.3), SRI hashes on payment page scripts, CSP on payment pages (Req 11.6.1), inline scripts on payment pages (risk)
- HHS Accessibility Mandate: VPAT (Voluntary Product Accessibility Template) link, accessibility statement, Section 508 compliance
- CSP analysis: all directives, unsafe-inline presence (risk), unsafe-eval presence (risk), data: URIs allowed, wildcard sources, report-uri/report-to configured
- HSTS: present, max-age value, includeSubDomains, preload, HSTS preload list membership
- Clickjacking: X-Frame-Options or CSP frame-ancestors
- MIME sniffing: X-Content-Type-Options: nosniff
- Subresource Integrity (SRI): script/link tags with integrity attributes, coverage percentage
- Cookie security audit: cookies without Secure flag, cookies without HttpOnly, cookies with SameSite=None without Secure, excessively long expiry, tracking cookies set before consent
- Third-party cookie inventory: all third-party cookies with domain, purpose classification
- Zero Trust URL architecture: internal paths exposed, admin panels accessible, API endpoints discoverable, debug modes enabled
- Security.txt: /.well-known/security.txt presence and content

**Active probing:**
1. Load page — observe cookie consent banner behavior
2. Click "Accept All" — count cookies set, network requests fired
3. Reload page, click "Reject All" — count cookies set, network requests fired (compare)
4. Check which tracking fires before consent (compliance violation)
5. Probe for /.well-known/security.txt, /security, /privacy, /terms, /legal paths

**Detection method:** Playwright for consent banner interaction, cookie before/after comparison, DOM inspection for legal links, HTTP GETs for legal page discovery, CSP header parsing.

---

### M13: Performance & Carbon (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Adblock simulation: load page with common ad/tracker domains blocked → measure CWV improvement, identify what breaks, what tracking survives, total bytes saved, rendering impact
- CWV comparison: with vs. without third-party scripts (delta measurement)
- Carbon footprint: total page weight in GB × energy intensity (0.194 kWh/GB SWD model) × grid carbon intensity (494g CO2/kWh global avg) = grams CO2 per page view, annual estimate (× monthly traffic if available from M24)
- Green hosting: check if hosting IP is in The Green Web Foundation database
- Resource optimization score: percentage of images in modern formats, compression coverage, unused CSS/JS ratio, font optimization, caching coverage
- Third-party bloat: % of page weight from third parties, number of third-party domains, total third-party requests

**Detection method:** Playwright with route.abort() for adblock simulation, `co2.js` library for carbon calculation, Green Web Foundation API for green hosting check.

---

### M14: Mobile & Responsive (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Viewport meta tag: content, width=device-width, initial-scale, user-scalable
- Actual vs declared viewport: render at 375px width, check if content overflows
- Media queries: all CSS media queries extracted, breakpoint values, mobile-first vs desktop-first
- Responsive images: srcset usage, sizes attribute, picture element, art direction
- Mobile elements: hamburger menu, touch-friendly buttons (44px+ targets), bottom navigation, mobile-specific CTAs
- Small element detection: all interactive elements < 44x44px at mobile viewport
- Horizontal scroll: page width exceeds viewport at mobile size
- Text readability: font-size < 12px at mobile, line-height issues
- AMP: amphtml link, AMP validation
- PWA readiness: service worker registered, manifest.json valid, offline capability, install prompt
- Mobile page speed: performance metrics at mobile viewport + 3G throttling
- Touch-specific: -webkit-tap-highlight-color, touch-action CSS, :hover-only interactions (no :focus equivalent)

**Active probing:**
1. Render at 375x812 (iPhone), 393x851 (Pixel), 768x1024 (iPad) — check layout at each
2. Check for horizontal overflow at each viewport
3. Measure all tap targets at mobile viewport
4. Simulate 3G connection — measure load time

**Detection method:** Playwright viewport emulation, DOM measurement for element sizes, CSS computed styles, service worker detection via `navigator.serviceWorker`.

---

### M15: Social & Sharing (GhostScan)
**Phase:** GhostScan | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Social profiles: links to Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Discord, Mastodon, Threads, GitHub, Medium, Substack — all found URLs
- Share buttons: native share widgets (ShareThis, AddThis, AddToAny), custom share links, Web Share API usage
- OG image analysis: dimensions (should be 1200x630), file size, format, alt text, presence
- Twitter Card validation: card type matches content, image meets requirements
- Social proof elements: follower counts displayed, social media feeds embedded, testimonial widgets, trust badges, customer count claims
- Embedded social: Twitter/X embeds, Instagram embeds, YouTube embeds, TikTok embeds, Facebook embeds
- Social login: "Sign in with Google/Facebook/Twitter/GitHub/Apple" buttons
- Social meta consistency: OG title vs page title, OG description vs meta description, OG URL vs canonical

**Active probing:**
1. Click social share buttons — verify they open correct sharing dialogs
2. Check social link targets — verify they lead to actual brand profiles (not broken links)

---

### M16-M19: Content Page Discovery (Passive)
**Phase:** Passive | **Tier:** Peek | **Timeout:** 15s | **Retries:** 4

These modules share a common pattern: probe known URL paths and parse HTML for signals.

**M16: PR & Media** — Probe: /press, /newsroom, /media, /news, /press-releases, /media-kit
- Press page URL, press releases (titles, dates, count), media kit download link, press contacts (email, phone), RSS feed for news, media mentions/logos ("As seen in..."), crisis communication page

**M17: Careers & HR** — Probe: /careers, /jobs, /join-us, /about/team, /team, /culture
- Careers page URL, ATS provider (Greenhouse, Lever, Workday, BambooHR, Ashby, iCIMS — from iframe src or script), open positions count, job categories, team page, culture/values page, Glassdoor/Indeed links, hiring velocity (are jobs being added recently?)

**M18: Investor Relations** — Probe: /investors, /ir, /investor-relations, /sec-filings, /annual-report
- IR portal URL, ticker symbol (from page content or schema), SEC filings link, quarterly earnings, annual report PDF, ESG/sustainability report, board of directors page, financial data APIs (Bloomberg, Yahoo Finance identifiers)

**M19: Support & Success** — Probe: /support, /help, /help-center, /knowledge-base, /status, /community, /contact
- Help center URL and provider (Zendesk, Intercom Articles, Freshdesk, HelpScout, Notion, GitBook, ReadMe), support channels (email, phone, chat, ticket), SLA/uptime page, system status page (StatusPage.io, Instatus, BetterUptime), community forum (Discourse, Circle, Tribe), business hours, contact form

**Detection method:** HTTP GET probing of known paths (handle 404/redirect gracefully), HTML parsing with cheerio for content extraction, ATS/helpdesk fingerprinting from scripts/iframes.

---

### M20: Ecommerce/SaaS (Browser)
**Phase:** Browser | **Tier:** Full | **Timeout:** 30s | **Retries:** 3

**Signals to extract:**
- Ecommerce platform: Shopify, WooCommerce, Magento, BigCommerce, Salesforce Commerce Cloud, Medusa, Saleor — from fingerprints
- Cart detection: add-to-cart button presence, cart icon/counter, mini-cart, cart page URL
- Pricing page: /pricing URL, pricing tiers (count, names, prices if parseable), currency, billing toggle (monthly/annual), free tier/trial indicators, enterprise/"Contact Sales" tier
- Product schema: Product JSON-LD (name, price, availability, reviews, SKU, brand, image)
- Payment processors: Stripe (stripe.js, Stripe Elements), PayPal (paypal.com/sdk), Square, Braintree, Adyen, Authorize.net, Recurly, Chargebee, Paddle, LemonSqueezy — from scripts and iframe sources
- Subscription billing: recurring billing indicators, plan management links, upgrade/downgrade CTAs
- Checkout flow: multi-step vs single-page, guest checkout available, account creation required
- Currency/localization: currency symbol, multiple currency support, geo-pricing, hreflang-based pricing
- Shipping: shipping calculator, free shipping threshold, shipping partners
- Promo/coupon: coupon code field in checkout, promotional banners, discount indicators
- Product catalog signals: category pages, search functionality, filters/facets, product count estimates
- Reviews/ratings: on-product reviews, star ratings, review count, review provider (Yotpo, Judge.me, Stamped, Bazaarvoice, Trustpilot widget)

**Active probing:**
1. Click "Add to Cart" (if found) — observe tracking events (fbq, gtag), dataLayer pushes, network requests
2. Navigate to /cart or cart page — capture checkout flow initiation events
3. Check pricing toggle (monthly/annual) — capture price change events

---

### M21: Ad Library Recon (External)
**Phase:** External | **Tier:** Full | **Timeout:** 60s | **Retries:** 5

**Signals to extract:**
- Facebook/Meta ads: active ad count, ad creative types (image, video, carousel), ad copy samples, landing page URLs, estimated duration running, geographic targeting, platforms (Facebook, Instagram, Messenger, Audience Network)
- Google ads: active ad count, ad formats (search, display, video), ad copy, landing pages, geographic targeting, advertiser verification status

**API approach:** Use ScrapeCreators or Apify for Facebook Ad Library (official Meta API limited to EU/political ads only). Use SerpApi or SearchAPI for Google Ads Transparency Center. Both are pay-per-request but cheaper than building a custom scraper.

**Fallback approach:** Direct HTTP requests to ad library URLs with brand domain search, parse response HTML. Less reliable but $0 cost.

---

### M22-M23: Sentiment Scanners (External)
**Phase:** External | **Tier:** Full | **Timeout:** 60s | **Retries:** 5

**M22: News Sentiment** — Google News search for brand name
- Recent articles (title, source, date, URL), headline sentiment (positive/negative/neutral via Gemini Flash), media coverage frequency, crisis detection (negative news spike), industry context mentions

**M23: Social Sentiment** — Google Search with site: filters (twitter.com, reddit.com, linkedin.com)
- UGC mentions, sentiment distribution, complaint themes, brand advocacy signals, competitor comparison mentions, viral content detection

**Method:** DataForSEO SERP API (Google News, Google Search with site: operators) for result retrieval + Gemini Flash for sentiment classification.

---

### M24-M40: DataForSEO Market Intelligence

**All use DataForSEO API v3. Total estimated cost per scan: ~$0.05-0.15**

| Module | DataForSEO Endpoint | Cost/Request | Key Data |
|--------|---------------------|-------------|----------|
| M24: Monthly Visits | `domain_analytics/traffic_analytics/overview` | ~$0.01 | Total visits, visits by page (top 10), historical trend |
| M25: Traffic by Country | `domain_analytics/traffic_analytics/overview` | included | Country distribution, top countries |
| M26: Rankings | `domain_analytics/traffic_analytics/overview` | included | Global rank, country rank, category rank |
| M27: Paid Traffic Cost | `dataforseo_labs/google/domain_metrics_by_categories` | ~$0.005 | Monthly ad spend estimate, paid traffic volume |
| M28: Top Paid Keywords | `dataforseo_labs/google/ranked_keywords` (paid filter) | ~$0.01 | Keywords, CPC, position, intent classification |
| M29: Competitor Overlap | `dataforseo_labs/google/domain_intersection` | ~$0.01 | Competing domains, shared keywords, unique keywords |
| M30: Traffic Sources | `domain_analytics/traffic_analytics/overview` | included | Direct, organic, paid, referral, social, email % |
| M31: Domain Trust | `backlinks/summary` | ~$0.02 | Domain rank, backlink count, referring domains, trust/citation flow |
| M32: Mobile vs Desktop | `domain_analytics/traffic_analytics/overview` | included | Device split, mobile traffic trend |
| M33: Brand Search Trend | `dataforseo_labs/google/keyword_overview` (brand keyword) | ~$0.005 | Monthly search volume, YoY trend, MoM change |
| M34: Losing Keywords | `dataforseo_labs/google/ranked_keywords` (losing filter) | ~$0.01 | Keywords dropping rank, traffic loss estimate |
| M35: Bounce Rate | `domain_analytics/traffic_analytics/overview` | included | Bounce rate, pages/session, avg session duration |
| M36: Google Shopping | `merchant/google/products` | ~$0.001 | Product listings, pricing, seller count |
| M37: Review Velocity | `business_data/google/reviews` | ~$0.0015 | Review count, average rating, review velocity, recent sentiment |
| M38: Local Pack | `dataforseo_labs/google/serp_competitors` (local) | ~$0.01 | Local visibility, GMB ranking signals |
| M39: Business Profile | `business_data/google/my_business_info` | ~$0.0015 | Profile completeness, missing fields, categories, hours, photos |

**Note:** M24-M26, M30, M32, M35 can share a single `traffic_analytics/overview` API call. DRY principle: make one call, distribute data to all these modules.

---

### M41-M46: AI Synthesis (Gemini API)

**M41: Per-Module AI Synthesis** — Gemini Flash, parallel (one call per module)
- Input: module result data + signals
- Output per module: executive summary (3-5 sentences), key findings (bulleted), risk indicators with severity, actionable recommendations (specific, not generic), competitive context, score (0-100) with rationale
- Prompt template standardized across all modules for consistency

**M42: Final Synthesis + MarketingIQ** — Gemini Pro
- Input: all M41 outputs + raw module scores
- Output: MarketingIQ score (0-100 weighted composite), traffic light per category (Security, Performance, Analytics, Paid Media, MarTech, Content, Compliance, Mobile, Social), executive brief (C-suite), top 10 critical findings, top 10 opportunities, tech stack summary, competitive positioning

**M43: PRD Generation** — Gemini Pro
- Input: all findings + recommendations from M41-M42
- Output: prioritized fix list with effort estimation (S/M/L/XL), dependency mapping, success criteria per fix, suggested implementation timeline

**M44: ROI Simulator** — Gemini Flash
- Input: M42 findings + traffic data (M24) + paid media data (M27-M29)
- Output: estimated revenue impact of tracking gaps, wasted ad spend from attribution errors, performance impact on conversion rate, total estimated monthly loss

**M45: Cost Cutter** — Gemini Flash
- Input: all detected tools from M05-M09 + pricing knowledge
- Output: overlapping tools identified, abandoned/unused tools (detected but not firing), cheaper alternatives, consolidation opportunities, estimated monthly savings

**M46: Knowledge Base Assembly** — Gemini Flash
- Input: all module data + M41-M45 outputs
- Output: structured knowledge base (JSON) that the AI Chat (P3) can reference to answer any question about the scan. Organized by topic, cross-referenced by module.

---
---

# PART IV: SCORING & AI INTELLIGENCE PRD

## SC-1. MarketingIQ Scoring Philosophy

MarketingIQ is NOT a generic "website health" score. It measures **marketing technology effectiveness** — how well a brand's digital infrastructure acquires, tracks, attributes, and converts demand. A site with perfect Lighthouse scores but broken analytics and no attribution tracking should score LOW. A slightly slow site with pristine tracking, consent-aware tag governance, and server-side attribution should score HIGH.

**Design principles:**
- **Evidence-based weights** — every category weight traces to documented business impact research
- **Transparency** — the formula, weights, and checkpoint rubrics are visible to users in the report
- **Actionability** — every deducted point maps to a specific fixable issue
- **Stability** — small changes don't cause wild score swings (logarithmic dampening)
- **Defensibility** — methodology follows Lighthouse's log-normal model and Modified-Angoff standard-setting

**Scoring model:** Lighthouse-inspired log-normal distribution applied per-module, then weighted composite across categories.

---

## SC-2. Category Weights & Justification

| # | Category | Weight | Modules | Business Impact Justification |
|---|----------|--------|---------|-------------------------------|
| 1 | **Analytics & Data Integrity** | 20% | M05, M08, M09 | If tracking is broken, every marketing decision is based on bad data. Foundation of all measurement. A company spending $50K/mo on ads with misconfigured GA4 is flying blind. |
| 2 | **Paid Media & Attribution** | 18% | M06, M06b, M21, M28, M29 | Direct revenue/ROI impact. Broken attribution = wasted ad spend. Google/Meta report that 15-30% of conversions are lost without enhanced conversions/CAPI. M06b catches hidden PPC page tracking gaps — the #1 source of "dark" conversions. Average company wastes 26% of ad budget on wrong channels (Forrester). |
| 3 | **Performance & UX** | 15% | M03, M13, M14 | Deloitte/Google: **100ms improvement = 8.4% conversion increase** (retail). Sites loading in 1s convert at 3.05% vs 1.68% at 2s (45% drop). Vodafone: optimized LCP → +8% sales. Most researched, most defensible category. |
| 4 | **Compliance & Security** | 15% | M01, M10, M11, M12 | Average GDPR fine: **€2.8M** (2024, 30% YoY increase). CCPA intentional violation: **$7,988 per violation**. Binary catastrophic risk — one consent banner misconfiguration can trigger regulatory action. PCI DSS 4.0 Requirements 6.4.3 and 11.6.1 now mandatory for any site processing payments. |
| 5 | **MarTech Efficiency** | 12% | M07, M20 | Average enterprise uses 91 MarTech tools but actively uses only 33% (Gartner). Tool redundancy wastes $50-200K/year for mid-market companies. Automation gaps mean manual work that doesn't scale. |
| 6 | **SEO & Content Foundation** | 10% | M04, M15, M16 | Organic search = highest ROI channel at 748% (FirstPageSage). Proper metadata, structured data, and social sharing multiply content distribution at zero marginal cost. |
| 7 | **Market Position** | 6% | M24-M35 | Competitive context that calibrates all other scores. A 60/100 analytics score means something different for a startup vs. a Fortune 500. Traffic trends reveal growth trajectory. |
| 8 | **Digital Presence** | 4% | M02, M17, M18, M19 | Infrastructure signals and organizational maturity. Having investor relations, structured careers pages, and a support center indicates operational sophistication — but these are hygiene factors, not growth drivers. |

**Total: 100%**

---

## SC-3. Module-Level Scoring Rubric

Each module contains **checkpoints** — specific, measurable signals that are individually assessed and scored. Every checkpoint has:

```typescript
interface Checkpoint {
  id: string;                    // e.g., 'M01_SPF_RECORD'
  name: string;                  // e.g., 'SPF Record Configuration'
  weight: number;                // relative importance within module (1-10)
  health: CheckpointHealth;      // assessed by module logic
  evidence: string;              // what was found
  recommendation?: string;       // what to fix (if not excellent/good)
}

type CheckpointHealth =
  | 'excellent'   // above best practice — 100% of weight
  | 'good'        // meets best practice — 75% of weight
  | 'warning'     // below best practice, not broken — 35% of weight
  | 'critical'    // missing or broken — 0% of weight
  | 'info';       // informational, excluded from scoring
```

**Module score formula:**
```
module_score = (Σ checkpoint_earned / Σ checkpoint_max) × 100

where:
  checkpoint_earned = checkpoint.weight × health_multiplier
  checkpoint_max = checkpoint.weight × 1.0
  health_multiplier = { excellent: 1.0, good: 0.75, warning: 0.35, critical: 0.0 }
  info checkpoints excluded from both numerator and denominator
```

### Example: M01 DNS & Security Baseline Checkpoints

| Checkpoint | Weight | Excellent | Good | Warning | Critical |
|-----------|--------|-----------|------|---------|----------|
| SPF record | 8 | Exists, `-all`, ≤10 lookups, flattened | Exists, `~all`, ≤10 lookups | Exists but `+all` or >10 lookups | Missing |
| DMARC policy | 9 | `p=reject` with rua/ruf | `p=quarantine` with rua | `p=none` | Missing |
| DKIM | 7 | Found, 2048-bit+ key | Found, 1024-bit key | Found, weak key (<1024) | Not detected |
| DNSSEC | 5 | Signed with valid chain | Signed (no validation check) | — | Unsigned |
| TLS certificate | 10 | Valid, >90 days, TLS 1.3, ECDSA | Valid, >30 days, TLS 1.2+ | Valid, <30 days expiry | Expired or missing |
| HSTS | 8 | Present, max-age >1yr, preload, includeSubDomains | Present, max-age >6mo | Present, max-age <6mo | Missing |
| CSP | 7 | Strict policy, no unsafe-inline/eval | Present, minor issues | Present but overly permissive | Missing |
| X-Content-Type-Options | 4 | `nosniff` present | — | — | Missing |
| X-Frame-Options / frame-ancestors | 5 | CSP frame-ancestors set | X-Frame-Options set | — | Neither set |
| Referrer-Policy | 4 | `strict-origin-when-cross-origin` | `no-referrer` or `origin` | `unsafe-url` | Missing |
| Permissions-Policy | 4 | Comprehensive, restrictive | Present, basic | Present, permissive | Missing |
| HTTPS redirect chain | 6 | HTTP→HTTPS, ≤1 redirect | HTTP→HTTPS, 2 redirects | HTTP→HTTPS, 3+ redirects | No HTTPS redirect |
| Email infrastructure | 3 | Professional (Google Workspace/M365) | Custom mail server | — | No MX records |
| CAA records | 3 | Specified, matching cert issuer | Specified | — | Missing |
| IP geolocation coherence | 2 | CDN or expected region | — | Unexpected region | — (info only) |

**Max possible score for M01:** Each checkpoint at excellent = 100/100

### Example Score Calculation

If a site has: SPF good (8×0.75=6), DMARC missing (9×0=0), DKIM excellent (7×1.0=7), DNSSEC unsigned (5×0=0), TLS good (10×0.75=7.5), HSTS missing (8×0=0), CSP missing (7×0=0), XCTO present (4×1.0=4), XFO set (5×0.75=3.75), Referrer good (4×0.75=3), Permissions missing (4×0=0), HTTPS good (6×0.75=4.5), Email good (3×0.75=2.25), CAA missing (3×0=0), IP info (excluded):

Earned: 6+0+7+0+7.5+0+0+4+3.75+3+0+4.5+2.25+0 = **38**
Max: 8+9+7+5+10+8+7+4+5+4+4+6+3+3 = **83**
Module score: 38/83 × 100 = **45.8/100** (Yellow — "Needs Attention")

Every module follows this same pattern. Full checkpoint tables for all 40+ scored modules would be defined in the codebase as JSON configuration files in `apps/engine/src/modules/checkpoints/`.

---

## SC-4. Category Score Aggregation

```
category_score = weighted_average(module_scores in category)

where module weights within a category are equal by default,
UNLESS a module errored/was skipped — then it's excluded from the average
(don't penalize for modules that couldn't run)
```

**Example — Analytics & Data Integrity category (20% of MarketingIQ):**
- M05 Analytics Architecture: scored 72
- M08 Tag Governance: scored 58
- M09 Behavioral Intelligence: scored 81

Category score = (72 + 58 + 81) / 3 = **70.3**

---

## SC-5. Composite MarketingIQ Formula

```
MarketingIQ_raw = Σ (category_weight × category_score)
                = (0.20 × analytics) + (0.18 × paid_media) + (0.15 × performance)
                  + (0.15 × compliance) + (0.12 × martech) + (0.10 × seo)
                  + (0.06 × market_position) + (0.04 × digital_presence)

MarketingIQ = clamp(0, 100, MarketingIQ_raw + critical_penalties + excellence_bonuses)
```

---

## SC-6. Critical Penalties (Circuit Breakers)

These override the composite — certain findings are so severe they MUST drag the score down regardless of how well other categories perform. A beautiful website with perfect performance but zero tracking is not a "good" marketing technology stack.

| Penalty | Points | Trigger Condition | Rationale |
|---------|--------|-------------------|-----------|
| Zero analytics | -15 | No analytics tool detected in M05 (no GA4, no Adobe, no Mixpanel, nothing) | Cannot measure anything. Marketing is unaccountable. |
| Tracking fires before consent | -12 | M12 detects ad/analytics pixels firing before consent banner interaction | Active GDPR/ePrivacy violation. Regulatory risk. |
| SSL certificate expired | -10 | M01 detects expired or absent TLS certificate | Browser warnings kill trust and conversions. |
| No privacy policy | -8 | M12 finds no privacy policy page | Legal requirement in every jurisdiction. |
| No consent mechanism with tracking | -8 | M12: tracking active (M05/M06 found pixels) but no consent banner detected | GDPR Article 7 violation for EU visitors. |
| Critical CSP + HSTS both missing | -5 | M01: neither Content-Security-Policy nor HSTS configured | Basic security hygiene failure. |
| Mixed content on HTTPS page | -5 | M11 detects HTTP resources loaded on HTTPS page | Browser security warnings, broken padlock. |
| Payment page without SRI | -4 | M12: payment/checkout page detected (M20) with scripts lacking Subresource Integrity | PCI DSS 4.0 Requirement 6.4.3 violation. |

**Maximum total penalty: -67** (all firing simultaneously = catastrophic stack)
**Typical penalty for a mediocre site: -5 to -15** (one or two issues)

**Design note:** Penalties are intentionally harsh. A site triggering the "tracking before consent" penalty (-12) would need to score ~12 points higher across all categories just to compensate. This forces the score to accurately reflect marketing-specific risk.

---

## SC-7. Excellence Bonuses (Reward Sophistication)

These reward implementations that go beyond baseline — signals that a mature, sophisticated marketing operation is running the stack.

| Bonus | Points | Trigger Condition | Rationale |
|-------|--------|-------------------|-----------|
| Server-side tracking | +5 | M05/M06: GTM Server Container detected OR Conversions API (Meta CAPI) active | Gold standard for tracking accuracy. Resistant to browser restrictions, ITP, ad blockers. |
| Full consent mode v2 | +4 | M08/M12: Google Consent Mode v2 active with granular default/update states for all 5 consent types | Proper privacy-first implementation that still enables modeling. |
| All Core Web Vitals passing | +3 | M03: LCP < 2.5s AND INP < 200ms AND CLS < 0.1 | Google's own thresholds. Top 28% of sites. |
| SRI coverage > 80% | +2 | M12: >80% of third-party scripts have integrity attributes | Security best practice, exceeds most implementations. |
| Zero errors on load | +2 | M11: no JS errors, no failed network requests, no console.error on page load | Clean runtime environment. Production-grade. |
| Comprehensive structured data | +2 | M04: Organization + WebSite + at least one content-specific type (Product, Article, FAQ, etc.) with valid JSON-LD | Rich search features, AI-ready content. |

**Maximum total bonus: +18**
**Typical bonus for a well-run site: +3 to +8** (CWV passing + structured data + clean errors)

---

## SC-8. Traffic Light Thresholds

### Per Category
| Light | Score Range | Label | Dashboard Color |
|-------|------------|-------|-----------------|
| 🟢 Green | 70-100 | Healthy | `#06D6A0` |
| 🟡 Yellow | 40-69 | Needs Attention | `#FFD166` |
| 🔴 Red | 0-39 | Critical | `#EF476F` |

### Overall MarketingIQ
| Score | Label | One-liner | Dashboard Treatment |
|-------|-------|-----------|---------------------|
| 85-100 | **Marketing Leader** | Top-tier marketing technology operation. Few improvements needed. | Green gauge, confetti animation |
| 70-84 | **Competitive** | Solid foundation with optimization opportunities. | Green gauge, subtle glow |
| 50-69 | **Developing** | Significant gaps requiring attention. Revenue leakage likely. | Yellow gauge, pulse animation |
| 30-49 | **At Risk** | Critical issues threatening performance and compliance. | Red gauge, warning icon |
| 0-29 | **Critical** | Fundamental infrastructure problems. Immediate action required. | Red gauge, alert banner |

### Score Distribution Expectation
Based on Lighthouse's HTTPArchive data model adapted for marketing stacks:
- **~5% of sites** score 85+ (Marketing Leader)
- **~15% of sites** score 70-84 (Competitive)
- **~40% of sites** score 50-69 (Developing) ← most sites land here
- **~30% of sites** score 30-49 (At Risk)
- **~10% of sites** score 0-29 (Critical)

This distribution ensures the score feels meaningful — a 90+ is genuinely impressive, not routine.

---

## SC-9. Score Presentation

The MarketingIQ score is presented with full transparency:

**P1 Dashboard (Bento Grid):**
- Large animated gauge (0-100) with color
- Label ("Competitive", etc.)
- 8 category scores as horizontal bars with traffic lights
- "How is this calculated?" expandable showing weights and formula

**P2 Report (McKinsey Style):**
- Full scoring methodology page
- Category-by-category breakdown with checkpoint details
- Penalties and bonuses called out explicitly
- Comparison to industry averages (from DataForSEO traffic data: "Your Analytics score of 72 puts you above 65% of sites in the SaaS category")

---

## AI-1. AI Prompt Engineering — Design Principles

All AI prompts (M41-M46) follow these rules:

1. **Structured output only** — every prompt demands a specific JSON schema, validated with Zod on the response
2. **Anti-hallucination** — every prompt includes: "Only reference data present in the input. Never invent findings, tools, or statistics. If data is insufficient, say 'insufficient data' rather than guessing."
3. **Evidence-backed** — every finding must cite the specific signal/checkpoint that triggered it
4. **Calibrated severity** — clear definitions of critical/warning/info/positive prevent AI from over-alarming
5. **Actionable specificity** — "Improve tracking" is rejected; "Add enhanced conversions to Google Ads tag AW-12345" is required
6. **Consistent tone** — authoritative, direct, no hedging. Written for a VP of Marketing or CMO, not a junior analyst
7. **Token efficiency** — prompts are concise but complete. Module data is pre-filtered to relevant signals only (don't send M01 data to a prompt about paid media)

### Gemini Model Allocation

| Module | Model | Reason | Estimated Input Tokens | Estimated Output Tokens |
|--------|-------|--------|----------------------|------------------------|
| M41 (×40) | Gemini Flash | High parallelism, moderate reasoning | ~2K per call | ~800 per call |
| M42 | Gemini Pro | Complex cross-module synthesis, scoring | ~15K (all M41 outputs) | ~3K |
| M43 | Gemini Pro | Long-form structured document generation | ~18K | ~5K |
| M44 | Gemini Flash | Mathematical reasoning, formula application | ~5K | ~1.5K |
| M45 | Gemini Flash | Pattern matching (tool overlap detection) | ~4K | ~1K |
| M46 | Gemini Flash | Data restructuring, no deep reasoning | ~20K | ~8K |

**Total estimated tokens per scan:** ~120K input + ~50K output
**Estimated Gemini cost per scan:** ~$0.01-0.03 (Flash) + ~$0.02-0.05 (Pro) = **~$0.03-0.08**

---

## AI-2. M41 Prompt — Per-Module AI Synthesis

This prompt runs once per scored module (~40 times in parallel via Gemini Flash).

```
SYSTEM:
You are a senior marketing technology analyst at a forensic auditing firm.
You are analyzing a single module from a comprehensive scan of {{domain}}.
Your analysis will be read by a VP of Marketing or CMO. Be direct, specific,
and authoritative. Never soften findings or use hedging language.

RULES — YOU MUST FOLLOW ALL OF THESE:
1. ONLY reference data present in the input below. Never invent findings,
   tools, configurations, or statistics that are not in the data.
2. Every finding MUST cite specific evidence from the scan data
   (e.g., "Detected GA4 property G-XXXXXXXX with debug_mode enabled").
3. Severity calibration:
   - critical: Immediate revenue loss, compliance violation, or security risk
   - warning: Optimization opportunity with measurable impact
   - info: Contextual observation, no immediate action needed
   - positive: Something done well — acknowledge it
4. Recommendations must be SPECIFIC and ACTIONABLE:
   ❌ BAD: "Improve your tracking setup"
   ✅ GOOD: "Add enhanced conversions to Google Ads tag AW-12345 by enabling
   user-provided data collection in GTM, which improves attribution accuracy
   by 15-30% based on Google's published benchmarks"
5. If the module errored or returned limited data, state this explicitly.
   Do not attempt to fill gaps with assumptions.

USER:
## Module: {{module_name}} ({{module_id}})
## Category: {{category_name}}
## Domain: {{domain}}
## Module Score: {{score}}/100

### Checkpoint Results
{{checkpoints_json}}

### Raw Data
{{module_data_json}}

### Detected Signals
{{signals_json}}

Produce your analysis as valid JSON matching this exact schema:

{
  "executive_summary": "string — 3-5 sentences. Lead with the most important
    finding. Reference specific tools, configurations, and scores. End with
    the single most impactful recommendation.",

  "key_findings": [
    {
      "finding": "string — What was found, stated as a fact",
      "severity": "critical | warning | info | positive",
      "evidence": "string — Exact data point from the scan (quote it)",
      "business_impact": "string — Why this matters in dollars, risk, or
        competitive terms"
    }
  ],

  "recommendations": [
    {
      "action": "string — Specific, implementable instruction. Include tool
        names, setting names, code changes, or vendor actions.",
      "priority": "P0 | P1 | P2 | P3",
      "effort": "S | M | L | XL",
      "expected_impact": "string — Quantified where possible. Use industry
        benchmarks when scan data is insufficient."
    }
  ],

  "score_rationale": "string — 2-3 sentences explaining why this module
    scored {{score}}/100. Reference the specific checkpoints that drove
    the score up or down."
}

Priority definitions:
- P0: Do today. Active compliance violation, revenue leak, or security hole.
- P1: Do this week. Significant optimization with clear ROI.
- P2: Do this month. Improvement opportunity, not urgent.
- P3: Backlog. Nice-to-have, low impact relative to effort.

Effort definitions:
- S: < 2 hours, single person, no approval needed
- M: 2-8 hours, single person, may need access/approval
- L: 1-2 weeks, may need multiple people or vendor coordination
- XL: 1+ months, significant project, budget/resources required
```

---

## AI-3. M42 Prompt — Final Synthesis & MarketingIQ

This is the most critical prompt. It produces the executive-level output and validates the composite score. Runs once on Gemini Pro.

```
SYSTEM:
You are the Chief Marketing Technology Officer presenting the final
executive brief for a forensic audit of {{domain}}.

You have the complete output from 40+ individual module analyses. Your job
is to synthesize these into a unified strategic assessment that a CEO, CMO,
or board member can act on in 60 seconds.

RULES:
1. The MarketingIQ score has already been calculated algorithmically as
   {{calculated_score}}. Your job is to VALIDATE it — if the score feels
   wrong given the evidence, flag the discrepancy and explain why.
2. Do not repeat module-level findings verbatim. Synthesize across modules
   to identify THEMES and PATTERNS.
3. Critical findings must be ranked by BUSINESS IMPACT, not technical
   severity. A missing privacy policy (legal risk) outranks a slow LCP
   (performance opportunity).
4. The executive brief is for someone with 60 seconds. Lead with the
   single most important sentence about this brand's marketing technology.
5. Do not soften language. If the stack is broken, say it's broken.
   If it's excellent, say it's excellent.

USER:
## Domain: {{domain}}
## Calculated MarketingIQ: {{calculated_score}}/100
## Label: {{calculated_label}}

### Category Scores
{{category_scores_json}}

### All Module Syntheses (M41 outputs)
{{all_m41_outputs_json}}

### Raw Module Scores
{{module_scores_json}}

### Traffic Data (from M24, if available)
Monthly visits: {{monthly_visits}}
Bounce rate: {{bounce_rate}}
Traffic sources: {{traffic_sources_json}}

### Category Weights Applied
{{category_weights_json}}

### Penalties Applied
{{penalties_json}}

### Bonuses Applied
{{bonuses_json}}

Produce your synthesis as valid JSON:

{
  "marketing_iq_validation": {
    "algorithmic_score": {{calculated_score}},
    "ai_assessment": "string — Does the score accurately reflect the
      evidence? If so, confirm. If not, explain the discrepancy.",
    "suggested_adjustment": 0,
    "adjustment_rationale": "string — Only if suggesting adjustment.
      Otherwise 'Score accurately reflects findings.'"
  },

  "category_traffic_lights": {
    "analytics_integrity": {
      "score": 0-100, "light": "green|yellow|red",
      "one_liner": "string — 10-word summary"
    },
    "paid_media_attribution": { ... },
    "performance_ux": { ... },
    "compliance_security": { ... },
    "martech_efficiency": { ... },
    "seo_content": { ... },
    "market_position": { ... },
    "digital_presence": { ... }
  },

  "executive_brief": "string — 150-200 words. Paragraph 1: The verdict
    (1-2 sentences). Paragraph 2: The biggest risk (2-3 sentences).
    Paragraph 3: The biggest opportunity (2-3 sentences). Written for a
    C-suite audience. No jargon without explanation.",

  "critical_findings": [
    {
      "rank": 1-10,
      "finding": "string — Cross-module synthesized finding",
      "modules": ["M05", "M06"],
      "business_impact": "string — Quantified where possible",
      "urgency": "immediate | this_week | this_month | this_quarter"
    }
  ],

  "top_opportunities": [
    {
      "rank": 1-10,
      "opportunity": "string — Specific improvement",
      "modules": ["M03", "M14"],
      "estimated_impact": "string — Revenue, conversion, or efficiency gain",
      "effort": "S | M | L | XL"
    }
  ],

  "tech_stack_summary": {
    "analytics": ["tool names found"],
    "advertising": ["tool names found"],
    "automation": ["tool names found"],
    "cms_hosting": ["platform, CDN, hosting"],
    "security": ["WAF, SSL provider, etc."],
    "other": ["everything else"]
  },

  "competitive_context": "string — 3-4 sentences positioning this
    domain's stack relative to industry patterns. Use traffic data
    and tool prevalence to contextualize."
}
```

---

## AI-4. M43 Prompt — PRD Generation

Runs once on Gemini Pro. Produces the remediation roadmap.

```
SYSTEM:
You are a Principal Product Manager at McKinsey Digital producing a
remediation roadmap for {{domain}} based on a comprehensive marketing
technology audit.

This PRD will be downloaded as a PDF by a VP of Marketing and shared with
their engineering and operations teams. It must be immediately actionable —
every task must be specific enough that an engineer or marketer can start
working on it without asking clarifying questions.

RULES:
1. Every task MUST trace back to a specific finding from the audit.
   Include the module ID (e.g., "M05", "M12") as a citation.
2. Tasks are grouped into workstreams. Each workstream targets a
   specific business outcome (not a module or technical area).
3. Effort estimates: S = <2 hours, M = 2-8 hours, L = 1-2 weeks,
   XL = 1+ months. Be realistic, not optimistic.
4. Dependencies must be logical. Never suggest fixing attribution
   before fixing base analytics. Never suggest compliance fixes
   before consent mechanisms are in place.
5. Success criteria must be MEASURABLE. Not "improved performance"
   but "LCP < 2.5s measured via Lighthouse CI on 3 consecutive runs."
6. The implementation timeline is a SUGGESTION, not a mandate.
   Acknowledge resource constraints.

USER:
## Domain: {{domain}}
## MarketingIQ: {{score}}/100 ({{label}})

### Final Synthesis (M42 output)
{{m42_output_json}}

### All Module Analyses (M41 outputs)
{{all_m41_outputs_json}}

### Detected Tech Stack
{{tech_stack_summary_json}}

Produce the PRD as valid JSON:

{
  "title": "Marketing Technology Remediation PRD — {{domain}}",
  "date": "{{scan_date}}",
  "marketing_iq": {{score}},

  "current_state_assessment": "string — 3-4 paragraphs. What's working,
    what's broken, what's missing. Reference specific tools and scores.",

  "target_state": "string — 2-3 paragraphs. What the optimized stack
    should look like. Be specific about tools, configurations, and
    integration patterns.",

  "workstreams": [
    {
      "id": "WS-01",
      "name": "string — Business outcome focused (e.g., 'Restore Revenue
        Visibility' not 'Fix Analytics')",
      "owner_role": "string — Who should own this (e.g., 'Marketing Ops
        Manager', 'Web Developer', 'Legal/Compliance')",
      "priority": "P0 | P1 | P2 | P3",
      "estimated_total_effort": "string — e.g., '2-3 weeks'",
      "business_impact": "string — What improves when this is done",
      "tasks": [
        {
          "id": "WS-01-T01",
          "task": "string — Specific, actionable instruction",
          "rationale": "string — Why this matters, with audit citation [M05]",
          "effort": "S | M | L | XL",
          "dependencies": ["WS-01-T00 or null"],
          "success_criteria": "string — Measurable verification",
          "tools_needed": "string — Access, tools, or vendor coordination"
        }
      ]
    }
  ],

  "implementation_timeline": {
    "week_1": {
      "focus": "string — Theme for this week",
      "tasks": ["WS-XX-TXX task IDs"]
    },
    "week_2": { ... },
    "week_3_4": { ... },
    "month_2": { ... },
    "month_3_plus": { ... }
  },

  "risk_register": [
    {
      "risk": "string — What could go wrong during remediation",
      "likelihood": "high | medium | low",
      "impact": "high | medium | low",
      "mitigation": "string — How to prevent or recover"
    }
  ],

  "expected_outcomes": {
    "marketing_iq_target": "number — Projected score after all P0+P1 fixes",
    "timeline_to_target": "string — Estimated weeks/months",
    "key_metrics_to_track": [
      "string — e.g., 'GA4 conversion tracking accuracy (compare to CRM)'"
    ]
  }
}
```

---

## AI-5. M44 Prompt — ROI Simulator

Runs once on Gemini Flash. Estimates financial impact of identified issues.

```
SYSTEM:
You are a marketing finance analyst. Calculate the estimated financial
impact of the marketing technology issues found in a forensic audit of
{{domain}}.

RULES:
1. Be CONSERVATIVE. Underestimate rather than overestimate. Mark
   confidence levels honestly.
2. Show ALL math. Every number must have a documented source or a
   clearly stated assumption.
3. Use these industry benchmarks (cite them):
   - Average ecommerce conversion rate: 2.5-3.0%
   - Every 100ms page speed improvement: +8.4% conversion (Deloitte)
   - Server-side tracking recovers 15-30% of lost conversions (Google)
   - Enhanced conversions improve attribution accuracy by 15-30% (Google)
   - Average bounce rate: 41-55% (Semrush)
   - Average CPC (search): $1.50-3.00 depending on industry
   - GDPR average fine: €2.8M (2024)
   - CCPA per-violation penalty: $2,663-$7,988
4. When data is insufficient, say "insufficient data" with confidence: low.
   Never fabricate numbers.
5. If traffic data (M24) is not available, use conservative estimates
   based on the site's detected tech stack sophistication.

USER:
## Domain: {{domain}}

### Traffic Intelligence
Monthly visits: {{monthly_visits or 'unavailable'}}
Bounce rate: {{bounce_rate or 'unavailable'}}
Traffic sources: {{traffic_sources or 'unavailable'}}
Estimated monthly ad spend: {{ad_spend_estimate or 'unavailable'}}
Top paid keywords: {{top_keywords or 'unavailable'}}

### Performance Data (M03)
LCP: {{lcp_value}}ms ({{lcp_rating}})
INP: {{inp_value}}ms ({{inp_rating}})
CLS: {{cls_value}} ({{cls_rating}})

### Analytics Issues (M05)
{{m05_findings_json}}

### Attribution Issues (M06)
{{m06_findings_json}}

### Tag Governance Issues (M08)
{{m08_findings_json}}

### Compliance Issues (M12)
{{m12_findings_json}}

### Critical Findings (from M42)
{{m42_critical_findings_json}}

Produce the ROI simulation as valid JSON:

{
  "tracking_gap_cost": {
    "title": "Revenue Invisible Due to Broken/Missing Tracking",
    "monthly_estimate_low": "$X",
    "monthly_estimate_high": "$X",
    "calculation_steps": [
      "Step 1: ...",
      "Step 2: ...",
      "Step 3: ..."
    ],
    "assumptions": ["list of assumptions made"],
    "confidence": "high | medium | low",
    "source_modules": ["M05", "M08"]
  },

  "attribution_waste": {
    "title": "Ad Spend Wasted Due to Attribution Errors",
    "monthly_estimate_low": "$X",
    "monthly_estimate_high": "$X",
    "calculation_steps": [...],
    "assumptions": [...],
    "confidence": "high | medium | low",
    "source_modules": ["M06", "M08"]
  },

  "performance_impact": {
    "title": "Revenue Lost from Slow Page Performance",
    "monthly_estimate_low": "$X",
    "monthly_estimate_high": "$X",
    "calculation_steps": [...],
    "assumptions": [...],
    "confidence": "high | medium | low",
    "source_modules": ["M03", "M13", "M14"]
  },

  "compliance_risk": {
    "title": "Potential Regulatory Fine Exposure",
    "annual_estimate_range": "$X - $Y",
    "risk_factors": ["list of specific compliance gaps found"],
    "applicable_regulations": ["GDPR", "CCPA", "PCI DSS"],
    "confidence": "low",
    "source_modules": ["M12", "M01"]
  },

  "tool_redundancy_waste": {
    "title": "Monthly Spend on Redundant/Unused Tools",
    "monthly_estimate": "$X",
    "tools_identified": ["tool1 (~$X/mo)", "tool2 (~$X/mo)"],
    "confidence": "medium | low",
    "source_modules": ["M05", "M07", "M09"]
  },

  "summary": {
    "total_monthly_opportunity_low": "$X",
    "total_monthly_opportunity_high": "$X",
    "total_annual_opportunity_low": "$X",
    "total_annual_opportunity_high": "$X",
    "headline": "string — One sentence: '{{domain}} is leaving an
      estimated $X-$Y per month on the table due to tracking gaps,
      attribution errors, and performance issues.'"
  }
}
```

---

## AI-6. M45 Prompt — Cost Cutter Analysis

Runs once on Gemini Flash. Identifies redundant and abandoned tools.

```
SYSTEM:
You are a marketing technology auditor specializing in stack
rationalization. Analyze the detected tools for {{domain}} and identify
cost reduction opportunities.

You have access to a tool pricing knowledge base (provided below).
Use it for pricing estimates. When a tool is not in the knowledge base,
estimate based on market tier (startup/mid-market/enterprise) and
state "estimated" explicitly.

RULES:
1. "Redundant" = two tools serving the same primary function
   (e.g., GA4 + Adobe Analytics = redundant analytics).
2. "Abandoned" = tool script loads but no active tracking fires,
   OR tool is detected but misconfigured/inactive.
3. "Cheaper alternative" = only suggest when the alternative provides
   equivalent functionality. Don't suggest Plausible to replace GA4
   for an enterprise with 50 custom dimensions.
4. Every recommendation includes estimated savings with source.

USER:
## Domain: {{domain}}
## Company tier: {{company_tier — startup/mid-market/enterprise, inferred from tech stack}}

### All Detected Tools (from M05, M06, M07, M08, M09, M20)
{{all_detected_tools_json}}

### Tool Activity Status
{{tool_activity_status — which tools fired events vs. just loaded}}

### Tool Pricing Knowledge Base
{{pricing_db_json — embedded reference data:
  GA4: free | GA360: ~$50K+/yr
  Adobe Analytics: ~$100K+/yr
  Mixpanel: $0-$1K/mo
  Amplitude: $0-$2K/mo
  Heap: $0-$1K/mo
  Segment: $0-$1.2K/mo
  HubSpot Marketing: $800-$3.6K/mo
  Marketo: $1K-$4K/mo
  Pardot: $1.25K-$4K/mo
  Intercom: $74-$999/mo
  Drift: $2.5K+/mo
  Zendesk: $19-$115/agent/mo
  Hotjar: $0-$171/mo
  FullStory: $0-$849/mo
  Optimizely: $36K+/yr
  VWO: $357-$1.7K/mo
  OneTrust: $1K+/mo
  Cookiebot: $0-$40/mo
  Sentry: $0-$80/mo
  ... (expanded at implementation)
}}

Produce the analysis as valid JSON:

{
  "redundancies": [
    {
      "tools": ["Tool A", "Tool B"],
      "function": "string — What function they both serve",
      "recommendation": "Keep X, remove Y",
      "rationale": "string — Why X over Y",
      "estimated_monthly_savings": "$X",
      "effort_to_consolidate": "S | M | L"
    }
  ],

  "abandoned_tools": [
    {
      "tool": "Tool Name",
      "evidence": "string — Script loads but no events fire / misconfigured",
      "estimated_monthly_cost": "$X",
      "recommendation": "Remove script tag from {{location}}"
    }
  ],

  "cheaper_alternatives": [
    {
      "current_tool": "Expensive Tool",
      "alternative": "Cheaper Tool",
      "current_estimated_cost": "$X/mo",
      "alternative_cost": "$Y/mo",
      "savings": "$Z/mo",
      "tradeoffs": "string — What you lose by switching",
      "recommendation_strength": "strong | moderate | weak"
    }
  ],

  "stack_health_summary": {
    "total_tools_detected": 0,
    "active_tools": 0,
    "inactive_or_abandoned": 0,
    "redundant_pairs": 0,
    "estimated_total_monthly_spend": "$X",
    "estimated_monthly_savings": "$X",
    "estimated_annual_savings": "$X"
  }
}
```

---

## AI-7. M46 Prompt — Knowledge Base Assembly

Runs once on Gemini Flash. Structures all scan data for the chat feature (P3).

```
SYSTEM:
You are a data architect. Restructure the complete audit data for
{{domain}} into a queryable knowledge base that an AI chat assistant
can use to answer ANY question about this scan.

The knowledge base must be organized so that:
1. A question about "analytics" retrieves all analytics-related data
   from every module that detected analytics signals
2. A question about "what cookies does this site use" retrieves the
   consolidated cookie inventory from M05, M07, M09, M12
3. A question about "how can I improve performance" retrieves M03
   findings + M13 findings + M42 recommendations + M43 workstreams

RULES:
1. DO NOT summarize or interpret. Restructure the raw data into
   topics with cross-references.
2. Preserve all numerical data, tool names, and specific findings.
3. Every entry must reference its source module(s).
4. The output will be stored as a JSONB column and queried by the
   chat system with topic-based retrieval.

USER:
## All Module Data
{{all_module_results_json}}

## All AI Syntheses (M41 outputs)
{{all_m41_outputs_json}}

## Final Synthesis (M42)
{{m42_output_json}}

## PRD (M43)
{{m43_output_json}}

## ROI Simulator (M44)
{{m44_output_json}}

## Cost Cutter (M45)
{{m45_output_json}}

Produce the knowledge base as valid JSON:

{
  "domain": "{{domain}}",
  "scan_date": "{{date}}",
  "marketing_iq": {{score}},

  "topics": {
    "analytics": {
      "summary": "string",
      "tools_detected": [...],
      "findings": [...],
      "recommendations": [...],
      "source_modules": ["M05", "M08", "M09"]
    },
    "advertising": { ... },
    "performance": { ... },
    "security": { ... },
    "compliance": { ... },
    "seo": { ... },
    "martech": { ... },
    "ecommerce": { ... },
    "mobile": { ... },
    "social": { ... },
    "content": { ... },
    "competitors": { ... },
    "costs": { ... }
  },

  "entities": {
    "tools": {
      "Google Analytics 4": {
        "category": "analytics",
        "status": "active",
        "configuration": {...},
        "issues": [...],
        "source_modules": ["M05"]
      },
      ... one entry per detected tool
    },
    "cookies": {
      "cookie_name": {
        "domain": "...",
        "category": "analytics|marketing|functional|necessary",
        "tool": "attributed tool or unknown",
        "secure": true/false,
        "source_modules": ["M05", "M12"]
      }
    }
  },

  "financials": {
    "roi_simulation": {{m44_output}},
    "cost_analysis": {{m45_output}},
    "source_modules": ["M44", "M45"]
  },

  "remediation": {
    "prd": {{m43_output}},
    "source_modules": ["M43"]
  }
}
```

---

## AI-8. P3 Chat System Prompt

This is the system prompt for the AI Chat feature (P3). It uses the M46 knowledge base as context.

```
SYSTEM:
You are the AlphaScan AI Assistant for {{domain}}. You have access to
the complete results of a forensic marketing technology audit.

You can answer ANY question about this domain's marketing technology
stack, performance, compliance, tracking, paid media, and more.

RULES:
1. Always cite your sources using [Source: MXX] notation.
   Example: "Your site uses GA4 (G-XXXXXXXX) with enhanced measurement
   enabled [Source: M05]."
2. If asked about something not covered by the scan, say:
   "That wasn't covered in this scan. The audit analyzed [list relevant
   modules]. For that specific question, I'd recommend [actionable
   alternative]."
3. When giving recommendations, reference the PRD workstreams:
   "This is addressed in Workstream WS-02, Task WS-02-T03 [Source: M43]."
4. Be specific. Use actual tool names, configuration values, and
   numbers from the scan data.
5. Keep responses concise unless the user asks for detail.
   Default to 2-3 paragraphs max.
6. You may use the ROI data to quantify impact:
   "Fixing this attribution gap could recover an estimated $X-$Y/month
   in trackable conversions [Source: M44]."

CONTEXT — SCAN KNOWLEDGE BASE:
{{m46_knowledge_base_json}}

USER: {{user_message}}
```

---

## AI-9. Prompt Versioning & Iteration

All prompts are stored as **versioned template files** in the engine codebase:

```
apps/engine/src/modules/synthesis/prompts/
├── m41-module-synthesis.v1.txt
├── m42-final-synthesis.v1.txt
├── m43-prd-generation.v1.txt
├── m44-roi-simulator.v1.txt
├── m45-cost-cutter.v1.txt
├── m46-knowledge-base.v1.txt
└── chat-system.v1.txt
```

**Why text files, not hardcoded strings?**
- Easy to iterate without code changes
- Can A/B test prompt versions via PostHog feature flags
- Version history in git for accountability
- Non-engineers can review/edit prompts

**Prompt testing strategy:**
1. Create a "golden dataset" of 10 scans with known characteristics
2. Run each prompt version against the golden dataset
3. Score outputs on: accuracy, specificity, actionability, hallucination rate
4. Only ship prompts that score >90% on all criteria

---

## AI-10. Anti-Hallucination Safeguards

Beyond the prompt-level rules, the code enforces guardrails:

1. **Zod validation on every AI response** — if the JSON schema doesn't match, retry with a stricter prompt that includes the validation error
2. **Evidence cross-referencing** — after M42 generates findings, a post-processing step verifies that every cited module actually produced relevant data. Strip any finding that references modules that returned `error` or `skipped`
3. **Tool name validation** — M45's detected tools must match the tool names found in M05-M09 signal data. If the AI invents a tool name not in the scan, it's stripped
4. **Score validation** — M42's MarketingIQ validation cannot adjust the algorithmic score by more than ±10 points. If the AI suggests a larger adjustment, it's capped and flagged for review
5. **Pricing validation** — M44's ROI estimates are capped at reasonable bounds. Monthly opportunity cannot exceed 20× estimated monthly ad spend. Compliance risk cannot exceed GDPR maximum (4% of estimated revenue)
6. **Retry with correction** — if Zod validation fails, the AI is re-prompted with: "Your previous response had these validation errors: [errors]. Fix them and try again." Max 2 retries before falling back to a simplified template-based output

---
---

# PART V: OPERATIONS & INFRASTRUCTURE PRD

## OP-1. Scan Lifecycle State Machine

The `scans.status` column tracks WHERE the scan is in the pipeline, not its health. Health is derived from `module_results` statuses.

### State Diagram

```
                                    ┌──────────────┐
                         ┌─────────│   cancelled   │
                         │         └──────────────┘
                         │ (user/system cancel)
                         │
┌─────────┐    worker    ┌─────────┐    done     ┌──────────┐   done    ┌────────────┐
│ queued   │───picks up──▶│ passive │───────────▶│ browser  │────────▶│ ghostscan  │
└─────────┘              └─────────┘             └──────────┘          └────────────┘
     │                        │                       │                      │
     │                        │ [tier=peek]           │                      │
     │                        ▼                       │                      │
     │                   ┌──────────┐                 │                      │
     │                   │ complete │◀────────────────┘──────────────────────┘
     │                   └──────────┘   [if all phases finish]               │
     │                        ▲                                              │
     │                        │                                              ▼
     │                   ┌──────────┐   done    ┌────────────┐   done   ┌──────────┐
     │                   │synthesis │◀──────────│  external  │◀─────────│ghostscan │
     │                   └──────────┘           └────────────┘          └──────────┘
     │                        │
     │                        ▼
     │                   ┌──────────┐
     │                   │ complete │
     │                   └──────────┘
     │
     │  (fatal: URL unreachable, OOM, 3x job retry exhausted)
     ▼
┌──────────┐
│  failed  │
└──────────┘
```

### State Definitions

| State | Meaning | Entry Condition | Exit Condition |
|-------|---------|-----------------|----------------|
| `queued` | Scan job created, waiting in BullMQ | POST /api/scans creates job | Worker dequeues job |
| `passive` | Phase 1 running (M01, M02, M04, M16-M19) | Worker starts processing | All passive modules complete/errored/timed out |
| `browser` | Phase 2 running (M03, M05-M08, M06b, M13-M15, M20) | Passive phase done AND tier ≥ full | All browser modules complete/errored/timed out |
| `ghostscan` | Phase 3 running (M09-M12) | Browser phase done | All ghostscan modules complete/errored/timed out |
| `external` | Phase 4 running (M21-M40 + M06b enrichment) | GhostScan phase done, browser closed | All external modules complete/errored/timed out |
| `synthesis` | Phase 5 running (M41-M46) | External phase done | All synthesis modules complete/errored/timed out |
| `complete` | All applicable phases finished | Final phase done | Terminal state |
| `failed` | Scan terminated due to fatal error | Unrecoverable error at any phase | Terminal state |
| `cancelled` | User or system cancelled | Cancel request received | Terminal state |

### Tier-Gated Transitions

```
Peek:  queued → passive → complete
       (stops after Phase 1, skips browser/ghostscan/external/synthesis)

Full:  queued → passive → browser → ghostscan → external → synthesis(M41 only) → complete
       (M41 runs per-module synthesis on all data, M42-M46 skipped)

Paid:  queued → passive → browser → ghostscan → external → synthesis(M41-M46) → complete
       (full synthesis including PRD, ROI, Cost Cutter, Knowledge Base)
```

### Upgrade Flow

When a registered user pays for Alpha Brief during or after a Full scan:

```
Existing scan at 'complete' (tier=full)
  → POST /api/scans/:id/upgrade (Stripe payment confirmed)
  → tier updated to 'paid'
  → status set to 'synthesis'
  → BullMQ job enqueued for M42-M46 only (M41 data already exists)
  → M42-M46 run
  → status → 'complete'
```

This means synthesis modules MUST be idempotent — running M42-M46 on a scan that already has M41 results works correctly. M41 results are NOT re-generated (they're already stored in `module_results`).

### Failure Handling at Each State

| State | Failure Type | Action |
|-------|-------------|--------|
| `queued` | Queue timeout (>10min wait) | Mark `failed`, reason: "queue_timeout" |
| `passive` | All passive modules fail | Mark `failed`, reason: "target_unreachable" (URL probably invalid/blocked) |
| `passive` | Some passive modules fail | Continue to next phase, failed modules marked `error` |
| `browser` | Playwright crashes 3x | Skip remaining browser modules, continue to `ghostscan` |
| `browser` | Target blocks headless browser (403) | Run remaining browser modules on mobile UA fallback, then continue |
| `ghostscan` | Active probing blocked/timeout | Mark probing modules `partial`, continue to `external` |
| `external` | DataForSEO API down | Mark DataForSEO modules `error`, continue with available data |
| `external` | All external modules fail | Continue to `synthesis` with available data only |
| `synthesis` | Gemini API down | Retry 4x. If still down, mark synthesis modules `error`, set status `complete` with note "AI synthesis unavailable" |
| Any state | OOM kill | BullMQ detects stalled job → retries (3x). If all retries fail → `failed` |
| Any state | Worker crash | Same as OOM — BullMQ stalled job detection → retry |

### Scan Health (derived, not stored)

The scan's overall health is computed from `module_results` when the frontend requests it:

```typescript
type ScanHealth = 'healthy' | 'partial' | 'degraded' | 'minimal';

function computeScanHealth(moduleResults: ModuleResult[]): ScanHealth {
  const total = moduleResults.length;
  const successful = moduleResults.filter(r => r.status === 'success').length;
  const ratio = successful / total;

  if (ratio >= 0.9) return 'healthy';    // 90%+ modules succeeded
  if (ratio >= 0.7) return 'partial';    // 70-89% succeeded
  if (ratio >= 0.4) return 'degraded';   // 40-69% succeeded
  return 'minimal';                       // <40% succeeded
}
```

Frontend renders: "This scan completed with partial results. 4 modules encountered errors and are marked as unavailable."

---

## OP-2. Scan Caching & Deduplication

### Problem

Running the same scan twice for the same domain wastes compute, API credits, and queue capacity. A popular domain like apple.com could get scanned hundreds of times.

### Cache Strategy

**Cache key:** normalized domain (not full URL)
- `https://www.apple.com/iphone/16` → cache key: `apple.com`
- `http://Apple.COM` → cache key: `apple.com`
- Normalization: lowercase, strip www, strip path, strip protocol, extract registered domain via `tldts`

**Cache TTL:** 24 hours

**Cache behavior by tier:**

| Scenario | Behavior |
|----------|----------|
| Anonymous Peek scan, fresh cache exists (any tier ≥ peek, <24h) | Return cached scan immediately. Zero cost. |
| Registered Full scan, fresh Full/Paid cache exists (<24h) | Return cached scan. User gets instant results. |
| Registered Full scan, only Peek cache exists | Run new Full scan (Peek data insufficient). |
| Paid Alpha Brief | **Never serve from cache.** Always run fresh synthesis (M42-M46) on existing data. If browser/external data <4h old, reuse that data and only re-run synthesis. If >4h old, full re-scan. |
| User explicitly clicks "Force Re-scan" | Bypass cache, run fresh scan. Counts against daily rate limit. |

### Implementation

**Pre-scan cache check** (in Next.js API route, before forwarding to engine):

```sql
SELECT id, tier, status, marketing_iq, created_at
FROM scans
WHERE domain = $1
  AND tier >= $2           -- requested tier or higher
  AND status = 'complete'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 1;
```

If found → return existing `scan_id` to frontend. No BullMQ job created.

**Database support:**

```sql
-- New index for cache lookups (add to migrations)
CREATE INDEX idx_scans_cache ON scans(domain, tier, status, created_at DESC);

-- New column to track cache hits
ALTER TABLE scans ADD COLUMN cache_source UUID REFERENCES scans(id);
-- NULL = fresh scan, non-null = this scan was served from cache (points to original)
```

**Frontend UX for cached results:**

```
┌──────────────────────────────────────────────────────┐
│ ✓ This domain was scanned 3 hours ago.               │
│   Showing fresh results.                              │
│                                                       │
│   [View Results]    [Force Re-scan ↻]                 │
└──────────────────────────────────────────────────────┘
```

**PostHog tracking:**
- `scan_cache_hit` — domain, original_scan_age_hours, requester_tier
- `scan_cache_miss` — domain, reason (no_cache, stale, tier_mismatch)
- Track cache hit rate: target >40% after launch (popular domains get repeat scans)

### Cache Warming (future optimization)

For the top 100 most-scanned domains, run automated re-scans every 24h to keep cache fresh. Only implement when scan volume justifies it (~1000+ scans/month).

---

## OP-3. Data Retention & GDPR Compliance

### What We Store and Why

| Data Category | What | Retention | Legal Basis |
|--------------|------|-----------|-------------|
| **Scan results** (module_results.data, signals) | Technical data about scanned websites | 90 days active, then purged | Legitimate interest (service delivery) |
| **Scan metadata** (scans.domain, tier, score, dates) | Domain name, MarketingIQ score, timestamps | 1 year, then purged | Legitimate interest (analytics, product improvement) |
| **AI synthesis** (module_results.ai_synthesis, M42-M46 outputs) | AI-generated analysis text | 90 days, same as scan results | Legitimate interest |
| **User accounts** (auth.users) | Email, name, auth provider, created_at | Active account lifetime | Contract (account creation) |
| **Payments** (payments table) | Stripe session ID, amount, status | 7 years (legal/tax requirement) | Legal obligation |
| **Chat messages** (chat_messages) | User questions + AI responses | 90 days, same as scan | Contract (service delivery) |
| **Audit log** (audit_log) | Actions, IPs, timestamps | 1 year | Legitimate interest (security) |
| **IP addresses** (scans.ip_address, audit_log.ip_address) | User IP addresses | 90 days, then anonymized (set to NULL) | Legitimate interest (rate limiting, security) |

### Automated Cleanup (pg_cron)

```sql
-- Run daily at 3:00 AM UTC via Supabase pg_cron

-- 1. Purge detailed scan data after 90 days (keep metadata)
UPDATE module_results
SET data = '{}', signals = '[]', ai_synthesis = NULL
WHERE created_at < now() - interval '90 days';

-- 2. Delete chat messages after 90 days
DELETE FROM chat_messages
WHERE created_at < now() - interval '90 days';

-- 3. Anonymize IP addresses after 90 days
UPDATE scans SET ip_address = NULL
WHERE ip_address IS NOT NULL
  AND created_at < now() - interval '90 days';

UPDATE audit_log SET ip_address = NULL
WHERE ip_address IS NOT NULL
  AND created_at < now() - interval '90 days';

-- 4. Delete full scan records after 1 year
DELETE FROM scans
WHERE created_at < now() - interval '1 year';

-- 5. Delete orphaned module_results (cascade should handle, but safety net)
DELETE FROM module_results
WHERE scan_id NOT IN (SELECT id FROM scans);

-- 6. Clean expired chat credits (users with 0 credits and no activity for 1 year)
DELETE FROM chat_credits
WHERE remaining = 0
  AND updated_at < now() - interval '1 year';
```

### Right to Erasure (GDPR Article 17)

When a user requests account deletion:

```sql
-- 1. Delete all scan results for this user
DELETE FROM scans WHERE user_id = $1;
-- (CASCADE deletes module_results, chat_messages)

-- 2. Delete chat credits
DELETE FROM chat_credits WHERE user_id = $1;

-- 3. Anonymize audit log (keep for security, remove user reference)
UPDATE audit_log SET user_id = NULL, metadata = metadata - 'email'
WHERE user_id = $1;

-- 4. Anonymize payments (keep for tax/legal, remove user reference)
UPDATE payments SET user_id = NULL
WHERE user_id = $1;
-- Note: Stripe retains its own records per their DPA. We can't delete from Stripe.

-- 5. Delete Supabase auth user
-- Via Supabase Admin API: supabase.auth.admin.deleteUser(userId)
```

**Response time:** Within 30 days per GDPR (we target <24 hours via automated pipeline).

**Implementation:** `DELETE /api/account` endpoint → triggers the above SQL → sends confirmation email via Resend → logs to audit_log (anonymized).

### Privacy Policy Requirements

Our privacy policy (at `/privacy`) must disclose:

1. **Data controller:** MarketingAlphaScan, with contact email
2. **Data we collect:** email, name, IP, submitted URLs, scan results, payment info, usage analytics
3. **Data processors:** Supabase (US), DigitalOcean (US/EU), Stripe (US), Resend (US), Google Gemini API (US), DataForSEO (US), PostHog (US), Cloudflare (US)
4. **Retention periods:** as defined above
5. **User rights:** access, rectification, erasure, data portability, restrict processing, object to processing
6. **Legal bases:** contract (account), legitimate interest (security, analytics), legal obligation (payments)
7. **International transfers:** Standard Contractual Clauses with each processor
8. **Cookie usage:** PostHog analytics cookie (with consent), Supabase auth session cookie (functional, no consent needed)
9. **Contact for DSAR:** dedicated email address

### Important Note on Scanned Websites

We scan **publicly accessible websites** and extract **technical infrastructure data** (what CMS they use, what tracking pixels are present, etc.). This is analogous to what any browser does when visiting a URL. The data we extract is:
- Publicly accessible (anyone visiting the URL sees the same data)
- Technical in nature (not personal data of the website's visitors)
- Ephemeral in our system (purged after 90 days)

This does NOT constitute processing personal data of the scanned website's users. We never intercept real user sessions, cookies, or PII from the scanned site's visitors.

---

## OP-4. Admin & Monitoring (Zero-Cost Stack)

### Principle: Use What We Already Have

Building a custom admin dashboard is a Phase 13+ luxury. At launch, we combine existing tools for full operational visibility:

| Need | Tool | Cost |
|------|------|------|
| Database inspection | Supabase Dashboard (Table Editor, SQL Editor) | $0 |
| Business metrics | PostHog Dashboards (funnels, events, trends) | $0 |
| Server monitoring | DigitalOcean Metrics (CPU, RAM, disk, bandwidth) | $0 |
| Uptime monitoring | BetterUptime or UptimeRobot (free tier) | $0 |
| Log inspection | DigitalOcean Log Management or `docker logs` | $0 |
| Queue monitoring | BullMQ Dashboard (bull-board, built-in) | $0 |
| Error tracking | PostHog Error Tracking (or Sentry free tier) | $0 |

### Lightweight Admin API

A minimal set of authenticated endpoints for operational tasks. Protected by a static admin token in environment variables (upgrade to proper RBAC later):

```
GET  /admin/stats
  → { scans_today, scans_this_week, scans_queued, scans_failed_24h,
      error_rate_24h, revenue_today, revenue_this_week,
      active_users_24h, cache_hit_rate_24h }

GET  /admin/scans?status=failed&limit=20&offset=0
  → Paginated scan list with filters (status, tier, domain, date range)

GET  /admin/scans/:id/detail
  → Full scan with all module_results, errors, timings

GET  /admin/queue
  → { depth, waiting, active, completed_24h, failed_24h,
      avg_duration_ms, stalled_count, priority_breakdown }

GET  /admin/health
  → { engine: 'ok', redis: 'ok', browser: 'ok', supabase: 'ok',
      memory_rss_mb, memory_heap_mb, uptime_seconds, version }

POST /admin/scans/:id/retry
  → Re-enqueue a failed scan for retry

POST /admin/scans/:id/cancel
  → Cancel a queued or running scan

GET  /admin/modules/error-rates
  → Per-module error rate over last 7 days (identify problematic modules)
```

**Authentication:** `Authorization: Bearer ${ADMIN_TOKEN}` header. Token stored in `.env`. Not Supabase Auth — this is engine-internal.

### PostHog Business Dashboard

Track these events from the engine (server-side PostHog capture):

| Event | Properties | Purpose |
|-------|-----------|---------|
| `scan_started` | domain, tier, ip_country, source (fresh/cached) | Volume tracking |
| `scan_completed` | domain, tier, duration_ms, marketing_iq, health | Success rate |
| `scan_failed` | domain, tier, failure_reason, phase_at_failure | Error analysis |
| `module_completed` | module_id, status, duration_ms, score | Module-level monitoring |
| `module_error` | module_id, error_type, error_message | Error patterns |
| `payment_completed` | product, amount_cents, user_tier | Revenue |
| `chat_message` | scan_id, credits_remaining | Chat engagement |
| `cache_hit` | domain, cache_age_hours | Cache effectiveness |

**Dashboard panels:**
1. **Scan funnel:** queued → complete → paid (conversion rates)
2. **Daily scan volume:** by tier, trend line
3. **Module error heatmap:** which modules fail most and why
4. **Revenue:** daily/weekly, by product
5. **Queue health:** avg wait time, avg processing time, queue depth
6. **Cache performance:** hit rate, most-scanned domains

### BullMQ Dashboard (bull-board)

Install `@bull-board/fastify` on the engine. Serves a web UI at `/admin/queues` (protected by admin token) showing:
- Queue depth and job states
- Individual job details (data, logs, errors)
- Job retry/remove/promote actions
- Processing time charts

### Alerting (Free Tier)

| Alert | Trigger | Channel |
|-------|---------|---------|
| Engine down | Health endpoint fails 2 consecutive checks (2min) | BetterUptime → email + SMS |
| High error rate | >20% of scans fail in 1 hour window | PostHog action → webhook → email |
| Queue backup | >50 jobs waiting for >10 minutes | Engine health endpoint flag → BetterUptime |
| Memory pressure | RSS > 700MB on 768MB container | DigitalOcean alert → email |
| Disk > 80% | Disk usage exceeds 80% | DigitalOcean alert → email |
| Redis memory > 100MB | Redis exceeds 100MB of 128MB limit | Engine health endpoint flag |

---

## OP-5. Network Collector Architecture

### Problem

During browser phases (Phase 2 + Phase 3), multiple modules need network request data:
- **M03** needs ALL requests for performance waterfall and resource breakdown
- **M05** needs requests to analytics domains (google-analytics.com, etc.)
- **M06** needs requests to ad domains (facebook.com/tr, doubleclick.net, etc.)
- **M07** needs requests to MarTech domains (hubspot.com, intercom.io, etc.)
- **M08** needs requests to tag manager domains (googletagmanager.com, etc.)
- **M11** needs failed requests (4xx, 5xx, DNS failures)
- **M13** needs third-party request totals for bloat analysis

If each module attaches its own Playwright `page.on('request')` handler, we get:
- Duplicated processing (same request classified N times)
- Handler ordering issues (Playwright fires handlers in registration order)
- Memory overhead (N copies of the same request data)
- Testing complexity (each module's tests must mock network interception)

### Solution: Single Shared NetworkCollector

```typescript
// apps/engine/src/utils/network.ts

interface CapturedRequest {
  id: string;                    // unique request ID
  url: string;
  method: string;
  resourceType: string;          // script, stylesheet, image, font, xhr, fetch, etc.
  headers: Record<string, string>;
  postData: string | null;       // POST body (for pixel fires, form submissions)
  timestamp: number;             // ms since page navigation
  initiator: string | null;      // frame URL that initiated the request

  // Populated on response
  status?: number;
  responseHeaders?: Record<string, string>;
  contentType?: string;
  transferSize?: number;         // bytes transferred (compressed)
  resourceSize?: number;         // bytes uncompressed
  timing?: {                     // from Playwright response.timing()
    startTime: number;
    domainLookupStart: number;
    domainLookupEnd: number;
    connectStart: number;
    secureConnectionStart: number;
    connectEnd: number;
    requestStart: number;
    responseStart: number;       // TTFB for this resource
    responseEnd: number;
  };

  // Populated on failure
  failed?: boolean;
  failureReason?: string;

  // Classification (populated by classifier)
  classification?: {
    party: 'first' | 'third';
    category: 'analytics' | 'advertising' | 'martech' | 'tag_manager' |
              'cdn' | 'social' | 'media' | 'font' | 'unknown';
    tool?: string;               // e.g., 'Google Analytics 4', 'Meta Pixel'
  };
}

class NetworkCollector {
  private requests: Map<string, CapturedRequest> = new Map();
  private page: Page;
  private firstPartyDomain: string;
  private classifier: DomainClassifier;

  constructor(page: Page, firstPartyDomain: string) {
    this.page = page;
    this.firstPartyDomain = firstPartyDomain;
    this.classifier = new DomainClassifier();  // loads JSON domain databases
    this.attach();
  }

  private attach(): void {
    // Capture all requests
    this.page.on('request', (req) => { /* store request data */ });
    this.page.on('response', (resp) => { /* enrich with response data */ });
    this.page.on('requestfailed', (req) => { /* mark failures */ });
  }

  // === Module-specific filtered queries ===

  /** M03: All requests for performance waterfall */
  getAllRequests(): CapturedRequest[] { ... }

  /** M03: Resource breakdown by type */
  getResourceBreakdown(): {
    scripts: CapturedRequest[];
    stylesheets: CapturedRequest[];
    images: CapturedRequest[];
    fonts: CapturedRequest[];
    xhr: CapturedRequest[];
    other: CapturedRequest[];
  } { ... }

  /** M05: Requests to analytics domains */
  getAnalyticsRequests(): CapturedRequest[] { ... }

  /** M06: Requests to advertising/pixel domains */
  getAdRequests(): CapturedRequest[] { ... }

  /** M07: Requests to MarTech domains */
  getMarTechRequests(): CapturedRequest[] { ... }

  /** M08: Requests to tag manager domains */
  getTagRequests(): CapturedRequest[] { ... }

  /** M11: Failed requests (4xx, 5xx, DNS, timeout) */
  getFailedRequests(): CapturedRequest[] { ... }

  /** M13: Third-party requests (not first-party domain) */
  getThirdPartyRequests(): CapturedRequest[] { ... }

  /** M13: Total bytes by party */
  getBytesBreakdown(): { firstParty: number; thirdParty: number; total: number } { ... }

  /** General: Get requests by specific domain pattern */
  getRequestsByDomain(domainPattern: string): CapturedRequest[] { ... }

  /** General: Chronological timeline for waterfall */
  getTimeline(): CapturedRequest[] { ... }

  /** Snapshot the full collection (for serialization into module_results) */
  snapshot(): CapturedRequest[] { ... }

  /** Reset for next scan */
  reset(): void { this.requests.clear(); }
}
```

### Domain Classification Database

```
apps/engine/src/data/
├── domains/
│   ├── analytics.json       # ~200 entries
│   │   [
│   │     { "pattern": "google-analytics.com", "tool": "Google Analytics" },
│   │     { "pattern": "analytics.google.com", "tool": "Google Analytics" },
│   │     { "pattern": "mixpanel.com/track", "tool": "Mixpanel" },
│   │     { "pattern": "cdn.amplitude.com", "tool": "Amplitude" },
│   │     { "pattern": "heapanalytics.com", "tool": "Heap" },
│   │     { "pattern": "api.segment.io", "tool": "Segment" },
│   │     { "pattern": "api.posthog.com", "tool": "PostHog" },
│   │     ...
│   │   ]
│   │
│   ├── advertising.json     # ~150 entries
│   │   [
│   │     { "pattern": "facebook.com/tr", "tool": "Meta Pixel" },
│   │     { "pattern": "connect.facebook.net", "tool": "Meta SDK" },
│   │     { "pattern": "googleads.g.doubleclick.net", "tool": "Google Ads" },
│   │     { "pattern": "analytics.tiktok.com", "tool": "TikTok Pixel" },
│   │     { "pattern": "snap.licdn.com", "tool": "LinkedIn Insight" },
│   │     ...
│   │   ]
│   │
│   ├── martech.json         # ~100 entries
│   │   [
│   │     { "pattern": "js.hs-scripts.com", "tool": "HubSpot" },
│   │     { "pattern": "munchkin.marketo.net", "tool": "Marketo" },
│   │     { "pattern": "widget.intercom.io", "tool": "Intercom" },
│   │     { "pattern": "js.driftt.com", "tool": "Drift" },
│   │     ...
│   │   ]
│   │
│   ├── tag-managers.json    # ~20 entries
│   │   [
│   │     { "pattern": "googletagmanager.com", "tool": "Google Tag Manager" },
│   │     { "pattern": "tags.tiqcdn.com", "tool": "Tealium iQ" },
│   │     { "pattern": "assets.adobedtm.com", "tool": "Adobe Launch" },
│   │     ...
│   │   ]
│   │
│   └── cdn.json             # ~30 entries
│       [
│         { "pattern": "cloudflare.com", "tool": "Cloudflare" },
│         { "pattern": "cloudfront.net", "tool": "CloudFront" },
│         { "pattern": "akamaized.net", "tool": "Akamai" },
│         ...
│       ]
```

**DomainClassifier** loads these JSON files at startup, compiles patterns into a trie or regex set for O(1) lookup, and classifies each request URL as it's captured.

### Lifecycle in ModuleRunner

```
1. ModuleRunner creates BrowserContext
2. ModuleRunner creates Page
3. ModuleRunner creates NetworkCollector(page, targetDomain)
4. page.goto(targetUrl) — NetworkCollector captures ALL requests
5. Phase 2 modules run sequentially, each receiving NetworkCollector reference:
   - M03 calls collector.getAllRequests(), collector.getResourceBreakdown()
   - M05 calls collector.getAnalyticsRequests()
   - M06 calls collector.getAdRequests()
   - M06b creates its own mini-NetworkCollectors for PPC pages
   - M07 calls collector.getMarTechRequests()
   - M08 calls collector.getTagRequests()
6. Phase 3 (GhostScan) modules also use the same collector:
   - Active probing (scroll, click) generates NEW requests
   - M09 observes requests triggered by interactions
   - M11 calls collector.getFailedRequests()
   - M13 calls collector.getThirdPartyRequests(), collector.getBytesBreakdown()
7. After Phase 3, the full NetworkCollector.snapshot() is stored as part of
   scan metadata (useful for debugging, included in P2 report appendix)
8. Browser context closed, NetworkCollector destroyed
```

### Testing Strategy

For module unit tests, the NetworkCollector is mocked with pre-recorded request sets:

```typescript
// Example test for M05
const mockCollector = new MockNetworkCollector([
  { url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-12345', ... },
  { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123', ... },
  { url: 'https://cdn.segment.com/analytics.js/v1/abc123/analytics.min.js', ... },
]);

const result = await m05AnalyticsArchitecture.run({
  page: mockPage,
  networkCollector: mockCollector,
  ...
});

expect(result.signals).toContainEqual(
  expect.objectContaining({ name: 'Google Analytics 4', type: 'analytics_tool' })
);
```

This keeps module tests fast (no real browser) and deterministic (same inputs → same outputs).

---

## OP-6. Rate Limiting Architecture

### Multi-Layer Rate Limiting

```
Layer 1: Cloudflare (network edge)
  └── Rate limiting rules: 100 requests/min per IP across all endpoints
  └── Turnstile challenge on scan form submission

Layer 2: Next.js API Routes (application edge)
  └── IP-based rate limit: 2 Peek scans/day per IP (anonymous)
  └── User-based rate limit: 4 Full scans/day per user (registered)
  └── No limit for paid users

Layer 3: Engine API (backend)
  └── Queue depth limit: reject if queue > 100 jobs
  └── Per-IP queue limit: max 3 concurrent jobs per IP
  └── HMAC auth (only Vercel can reach engine)
```

### Implementation (Next.js API Route)

```typescript
// Rate limit check in POST /api/scans

// 1. Check Supabase for recent scans from this IP/user
const recentScans = await supabase
  .from('scans')
  .select('id')
  .eq(userId ? 'user_id' : 'ip_address', userId || ip)
  .gte('created_at', dayStart)
  .neq('cache_source', null)  // exclude cache hits from count
  .count();

const limit = userId ? 4 : 2;  // registered: 4/day, anonymous: 2/day
if (recentScans.count >= limit) {
  return Response.json(
    { error: 'Daily scan limit reached', limit, used: recentScans.count },
    { status: 429 }
  );
}
```

### Auto-Cleanup

Rate limiting uses the scans table itself (no separate rate_limit table needed). The `created_at` timestamp and daily count query handle expiry naturally. IP anonymization after 90 days (OP-3) doesn't affect rate limiting since we only check the current day.

---

## OP-7. Environment Variables Inventory

Complete list of all environment variables needed across the system:

```env
# === SHARED ===
NODE_ENV=production

# === FRONTEND (apps/web/.env.local) ===

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Engine communication
ENGINE_URL=https://engine.yourdomain.com
ENGINE_HMAC_SECRET=64-char-hex-random-secret

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_ALPHA_BRIEF_PRICE_ID=price_...
STRIPE_CHAT_CREDITS_PRICE_ID=price_...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=/ingest  # reverse proxy

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@marketingalphascan.com

# === ENGINE (apps/engine/.env) ===

# Server
PORT=3001
ENGINE_HMAC_SECRET=64-char-hex-random-secret  # same as frontend

# Supabase (service role — bypasses RLS)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis
REDIS_URL=redis://localhost:6379

# Google Gemini AI
GEMINI_API_KEY=AI...

# DataForSEO
DATAFORSEO_LOGIN=your-login
DATAFORSEO_PASSWORD=your-password

# PostHog (server-side capture)
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://us.i.posthog.com

# Admin
ADMIN_TOKEN=64-char-hex-random-secret

# === DIGITALOCEAN DROPLET ===
# These are set on the droplet, not in the app
DOCKER_COMPOSE_FILE=/opt/engine/docker-compose.yml
```

**Security rules:**
- `.env` files in `.gitignore` (never committed)
- `.env.example` committed with placeholder values
- Secrets rotated: HMAC secret quarterly, admin token quarterly, API keys annually
- Vercel environment variables set via Vercel Dashboard (not CLI)
- DigitalOcean secrets set via `docker-compose.yml` environment section (not Dockerfile)

---
---

# APPENDIX B: Complete Module Scoring Checkpoint Rubrics

Every scored module's checkpoints are defined below. These are the deterministic rules that produce module scores — no ambiguity, no subjectivity. Each checkpoint has a weight (1-10) and four health levels with explicit criteria.

**Reminder of health multipliers:** excellent=1.0, good=0.75, warning=0.35, critical=0.0, info=excluded

**M01: DNS & Security Baseline** — See SC-3 above (already defined with 15 checkpoints)

---

### M02: CMS & Infrastructure (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| CMS identified | 3 | CMS detected with version | CMS detected, no version | Multiple conflicting CMS signals | Info only (no score impact) |
| CMS version currency | 5 | Latest major version | Within 1 major version | 2+ major versions behind | Known vulnerable version |
| CDN detected | 6 | Enterprise CDN (Cloudflare, CloudFront, Akamai, Fastly) | Any CDN detected | — | No CDN detected |
| HTTPS enforced | 8 | HTTP→HTTPS with ≤1 redirect | HTTP→HTTPS with 2 redirects | HTTP→HTTPS with 3+ redirects | No HTTPS or mixed |
| HTTP/2 or HTTP/3 | 5 | HTTP/3 (QUIC) | HTTP/2 | HTTP/1.1 with pipelining | HTTP/1.0 or 1.1 no pipelining |
| Compression | 6 | Brotli on all compressible resources | Gzip on all compressible | Partial compression | No compression |
| Server header exposure | 4 | Server header hidden or generic | Server header present, no version | Server + version exposed | Server + version + OS exposed |
| Framework detected | 2 | Info only | Info only | Info only | Info only |
| Hosting identified | 2 | Info only | Info only | Info only | Info only |

---

### M03: Page Load & Performance (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| LCP | 10 | < 1.2s | < 2.5s | 2.5-4.0s | > 4.0s |
| INP | 8 | < 100ms | < 200ms | 200-500ms | > 500ms |
| CLS | 8 | < 0.05 | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP | 6 | < 1.0s | < 1.8s | 1.8-3.0s | > 3.0s |
| TTFB | 7 | < 200ms | < 500ms | 500-800ms | > 800ms |
| Total page weight | 6 | < 1MB | 1-2MB | 2-5MB | > 5MB |
| Total requests | 4 | < 30 | 30-60 | 60-100 | > 100 |
| Render-blocking resources | 7 | 0 render-blocking | 1-2 render-blocking | 3-5 render-blocking | > 5 render-blocking |
| Image optimization | 5 | All images: modern format + srcset + lazy | >80% optimized | 50-80% optimized | <50% optimized |
| Font optimization | 4 | font-display: swap on all, woff2 only | font-display on most, woff2 | Mixed formats, FOIT risk | No font-display, large fonts |
| Cache headers | 5 | All static assets: immutable, long TTL | >80% cached properly | 50-80% cached | <50% cached |
| Third-party impact | 6 | 3rd party < 10% of page weight | 10-25% | 25-50% | > 50% |
| Unused JS/CSS | 4 | < 10% unused | 10-25% unused | 25-50% unused | > 50% unused |

---

### M04: Page Metadata (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Title tag | 7 | Present, 30-60 chars, unique, descriptive | Present, slightly over/under length | Present but very short/long (>70) | Missing |
| Meta description | 6 | Present, 120-160 chars, compelling | Present, slightly over/under | Present but <70 or >170 chars | Missing |
| Canonical URL | 7 | Present, self-referencing, consistent | Present, points to correct page | Present but inconsistent | Missing |
| Open Graph tags | 6 | All 6 core OG tags present (title, desc, image, url, type, site_name) | 4-5 OG tags | 1-3 OG tags | No OG tags |
| OG image | 5 | Present, 1200x630, <300KB, descriptive | Present, correct dimensions | Present, wrong dimensions | Missing |
| Twitter Card | 4 | summary_large_image with all fields | summary card with basic fields | Card type only | No Twitter Card |
| Schema.org / JSON-LD | 8 | Organization + WebSite + content type, valid | Organization + 1 type | Present but invalid/minimal | No structured data |
| robots.txt | 5 | Present, well-structured, sitemap ref | Present, basic | Present but blocking important paths | Missing |
| Sitemap.xml | 6 | Present, all pages, lastmod, auto-updated | Present, most pages | Present but outdated/incomplete | Missing |
| Favicon | 3 | SVG + multiple sizes + apple-touch-icon | Multiple sizes | Single favicon.ico | Missing |
| Language (html lang) | 4 | Correct lang + content-language header | Correct lang attribute | Lang present but incorrect | Missing lang attribute |
| Hreflang (if multi-lang) | 4 | Correct hreflang with x-default, reciprocal | Hreflang present, mostly correct | Hreflang present with errors | Multi-language site with no hreflang |
| Preconnect hints | 3 | Key 3rd-party origins preconnected | Some preconnect hints | — | No preconnect on heavy 3rd-party site |
| llms.txt | 2 | Present with clear directives | Present, basic | — | Info only (no penalty) |
| manifest.json (PWA) | 3 | Valid manifest, all fields, installable | Valid manifest, basic fields | Present but invalid | Info only |

---

### M05: Analytics Architecture (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Primary analytics tool | 10 | GA4 or enterprise tool properly configured | Any analytics tool present and firing | Analytics script loads but misconfigured | No analytics detected |
| Measurement ID accuracy | 8 | Single correct measurement ID, no duplicates | Correct ID present | Multiple/conflicting IDs | ID present but not firing |
| Event tracking depth | 7 | Enhanced measurement + custom events firing | Enhanced measurement enabled | Pageview only | No events firing |
| Cross-domain tracking | 5 | Linker configured for known subdomains | Not needed (single domain) | Subdomains exist but no linker | Subdomains with separate analytics |
| Consent mode integration | 8 | Google Consent Mode v2, all 5 types, default deny | Consent Mode v1 or partial | Consent banner exists but no Consent Mode | Tracking fires without consent |
| Server-side tracking | 6 | GTM Server Container or CAPI active | Server-side indicators detected | — | Client-side only (not a penalty, info) |
| User ID implementation | 4 | user_id set on login, consistent across tools | user_id set in primary tool | — | Info only |
| Debug mode disabled | 5 | No debug mode in production | — | — | Debug mode active in production |
| Data layer present | 6 | Structured dataLayer with ecommerce + user data | dataLayer present, basic | dataLayer present, empty/minimal | No dataLayer on site using GTM |
| Cookie compliance | 6 | All analytics cookies: Secure, SameSite, reasonable expiry | Most cookies compliant | Some cookies non-compliant | Analytics cookies set before consent |
| Multiple analytics tools | 3 | Info only (detected tools listed) | Info only | Info only | Info only |

---

### M06: Paid Media Infrastructure (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Ad pixel presence (if running ads) | 9 | All expected pixels present and firing | Primary pixel(s) present | Some pixels load but don't fire | Expected pixels missing entirely |
| Enhanced conversions | 7 | Enhanced conversions enabled (Google) or Advanced Matching (Meta) | Standard conversion tracking | Basic pixel only (no conversion events) | No conversion tracking |
| Conversion event coverage | 8 | Key events tracked: Lead/Purchase/AddToCart | Some conversion events | PageView only | No events |
| Click ID capture | 6 | All click IDs preserved (gclid, fbclid, etc.) | Primary click IDs present | Some click IDs stripped | Click IDs lost (redirects strip params) |
| Attribution cookies | 5 | _fbp, _fbc, _gcl_aw, _gcl_au all present | Primary attribution cookies set | Some missing | No attribution cookies |
| UTM parameter handling | 6 | UTMs in URL, persisted to form submissions | UTMs in URL | UTMs present but lost on navigation | No UTM tracking |
| CAPI / server-side pixels | 5 | Server-side conversion events detected | Indicators of server-side setup | — | Client-side only (info, not penalty) |
| Pixel consent compliance | 8 | Pixels respect consent state (fire after accept) | Most pixels respect consent | Some pixels fire before consent | All pixels fire regardless of consent |
| Ad script performance impact | 4 | Ad scripts < 100KB total, async loaded | < 200KB, mostly async | 200-500KB or render-blocking | > 500KB or blocking critical path |
| Retargeting setup | 3 | Custom audience pixels active | Basic remarketing | — | Info only |

---

### M06b: PPC Landing Page Audit (Browser | Full)

(Already defined in the module spec with 7 checkpoints — see M06b section above)

---

### M07: MarTech Orchestration (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Marketing automation present | 6 | Enterprise MA (HubSpot, Marketo, Pardot) active | Any MA tool detected | Script loads but inactive | Info only (not every site needs MA) |
| Email capture forms | 7 | Forms present with proper action URLs, validation, hidden fields | Forms present, basic | Forms present but broken action | No email capture on commercial site |
| CRM integration signals | 4 | CRM form fields (sfdc, hs) + cookies detected | CRM cookies detected | — | Info only |
| Live chat / support widget | 4 | Chat widget loaded, functional, consent-aware | Chat widget present | Widget loads but errors | Info only |
| Form builder quality | 5 | Professional form builder with validation | Standard form elements | Forms without validation | Forms with action="mailto:" or no action |
| Popup/modal tools | 3 | Popup tool present, triggers appropriately | Popup tool detected | Popup fires immediately on load (bad UX) | Info only |
| Cookie inventory coherence | 6 | All MarTech cookies attributed, categorized, reasonable expiry | >80% attributed | 50-80% attributed | Many unknown/unattributed cookies |
| Tool integration depth | 5 | Multiple tools integrated (MA+CRM+chat+analytics) | 2-3 tools integrated | Tools present but siloed | Many tools, no integration |
| Push notification setup | 2 | Service worker registered, permission prompt appropriate | Push notification script detected | Permission prompt on first load (bad UX) | Info only |
| Scheduling/booking tool | 2 | Calendly/similar embedded, functional | Booking link present | — | Info only |

---

### M08: Tag Governance (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| TMS present | 7 | Single TMS (GTM/Tealium) managing all tags | TMS present, most tags managed | TMS + many hard-coded tags | No TMS, all tags hard-coded |
| Multiple TMS conflict | 6 | Single TMS only | — | — | Multiple TMS detected (GTM + Tealium) |
| dataLayer structure | 7 | Rich dataLayer: ecommerce + user + page data | dataLayer with basic page data | dataLayer exists but empty/minimal | Using GTM with no dataLayer |
| Tag firing on page load | 5 | All tags fire correctly, no errors | >90% tags fire | 70-90% fire, some blocked | <70% fire, many errors |
| Consent-aware tag firing | 8 | Tags respect consent mode, no pre-consent fires | Most tags respect consent | Some tags fire before consent | Tags fire regardless of consent |
| Tag load performance | 5 | All tags async, total < 200ms blocking | Mostly async, < 500ms | Some synchronous tags | Synchronous tags blocking render |
| Server-side tagging | 4 | GTM Server Container detected | Server-side indicators | — | Info only |
| Custom HTML tag security | 5 | No custom HTML tags, or all reviewed/safe | Few custom HTML tags | Many custom HTML tags (security risk) | Custom HTML with inline credentials |
| Piggyback tag detection | 4 | No piggyback chains (tags loading other tags) | 1-2 piggyback chains | 3+ piggyback chains | Circular piggyback chains |
| Container ID count | 3 | 1 container | 2 containers (staging + prod) | 3+ containers | Orphaned/test containers in production |

---

### M09: Behavioral Intelligence (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| A/B testing tool | 4 | Testing tool active with experiments running | Testing tool detected | Tool script loads but no experiments | Info only |
| Session recording | 4 | Recording tool active, consent-aware | Recording tool detected | Recording without consent banner | Info only |
| Feature flags | 3 | Feature flag system active | FF tool detected | — | Info only |
| Scroll-triggered events | 5 | Scroll triggers fire at milestones (25/50/75/100%) | Some scroll events detected | — | Info only |
| Exit-intent detection | 3 | Exit-intent popup or event detected | — | Exit-intent fires immediately (bad UX) | Info only |
| Browser storage usage | 4 | localStorage < 2MB, organized keys, no PII | < 5MB, mostly organized | 5-10MB or PII in localStorage | > 10MB or auth tokens in localStorage |
| Service workers | 4 | Service worker registered, caching appropriate | SW present, basic | SW present but outdated/erroring | Info only |
| Behavioral data collection | 5 | Multiple behavioral signals (clicks, scrolls, time) feeding analytics | Basic event tracking | Pageview only | No behavioral data |

---

### M10: Accessibility Overlay Detection (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Accessibility overlay | 3 | No overlay (good — overlays are considered harmful) | — | Overlay detected (UserWay, AccessiBe, etc.) | Info (controversial, scored as warning) |
| Heading hierarchy | 7 | h1→h2→h3 in order, single h1, no skips | Minor skip (h2→h4) | Multiple skips or missing h1 | No heading structure |
| Alt text coverage | 7 | All content images have descriptive alt text | >90% have alt text | 50-90% have alt text | <50% have alt text |
| Form labels | 6 | All form inputs have associated labels | >90% labeled | 50-90% labeled | <50% labeled |
| Color contrast | 5 | All text passes WCAG AA (4.5:1 normal, 3:1 large) | >90% passes | 70-90% passes | <70% passes |
| Keyboard navigation | 6 | All interactive elements focusable, visible focus | Mostly navigable, visible focus | Focus visible but some trapped elements | No visible focus indicators |
| ARIA landmarks | 5 | main, nav, header, footer landmarks present | main + nav present | Some landmarks | No landmarks |
| Skip navigation | 4 | Skip link present, functional | Skip link present | — | Missing on content-heavy site |
| Focus management (modals) | 4 | Focus trapped in modals, returns on close | Focus enters modal | Focus not managed in modals | Modals not keyboard-dismissible |
| Touch targets (mobile) | 5 | All targets ≥ 44x44px at mobile viewport | >90% meet 44px | 70-90% meet 44px | <70% meet 44px |

---

### M11: Console & Error Logging (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| JavaScript errors on load | 9 | Zero JS errors | 1-2 minor errors | 3-5 errors | >5 errors or critical errors |
| Network errors (4xx/5xx) | 7 | Zero failed requests | 1-2 non-critical 404s | 3-5 failed requests | >5 or any 5xx errors |
| Console.log in production | 4 | Zero console.log statements | 1-3 log statements | 4-10 log statements | >10 (dev artifacts in production) |
| Error monitoring tool | 6 | Sentry/Bugsnag/Datadog active | Error monitoring detected | — | No error monitoring on production site |
| Mixed content | 7 | Zero HTTP resources on HTTPS page | — | 1-2 mixed content warnings | Active mixed content (scripts) |
| CSP violations | 5 | Zero CSP violations | — | 1-3 violations | >3 violations or critical violations |
| Unhandled promise rejections | 5 | Zero unhandled rejections | 1 rejection | 2-3 rejections | >3 rejections |
| Resource loading failures | 5 | All images, scripts, styles load | 1-2 non-critical failures | 3-5 failures | Critical resources fail (main JS/CSS) |
| Deprecation warnings | 3 | Zero deprecation notices | 1-2 deprecations | 3-5 deprecations | Using removed APIs |
| 404 error page quality | 4 | Custom 404 with navigation + search | Custom 404, basic | Default server 404 | 404 returns 200 status (soft 404) |

---

### M12: Legal, Security & Compliance (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Privacy policy | 9 | Present, updated within 1 year, comprehensive | Present, slightly outdated | Present but very outdated (>2yr) | Missing |
| Terms of service | 5 | Present and current | Present | Present but outdated | Missing on commercial site |
| Cookie consent banner | 9 | Present, granular categories, accept/reject, consent mode | Present, accept/reject | Accept only (no reject option) | Missing (with tracking active) |
| Consent → tracking gap | 10 | Zero pixels fire before consent interaction | — | 1-2 minor scripts before consent | Major tracking (GA4, Meta) before consent |
| Accept vs Reject delta | 7 | Accept: tracking fires. Reject: zero tracking cookies | Accept fires, reject blocks most | Accept fires, reject still sets some cookies | Reject has no effect (same as accept) |
| HSTS configuration | 6 | max-age >1yr + includeSubDomains + preload | max-age >6mo | max-age <6mo | Missing HSTS |
| CSP policy | 6 | Strict CSP, no unsafe-inline/eval, report-to | CSP present, minor issues | CSP present, unsafe-inline | No CSP |
| SRI on third-party scripts | 5 | >80% of 3rd-party scripts have integrity hash | 50-80% coverage | 10-50% coverage | <10% or zero SRI |
| Cookie security flags | 6 | All sensitive cookies: Secure + HttpOnly + SameSite | >80% compliant | 50-80% compliant | <50% compliant |
| security.txt | 3 | Present at /.well-known/security.txt | — | — | Missing (minor) |
| CCPA opt-out link | 4 | "Do Not Sell" link present and functional | Link present | — | Missing on site targeting US/CA |
| DSAR mechanism | 3 | Data access request form/email clearly available | Privacy email available | — | No way to request data deletion |
| PCI DSS script inventory (if payments) | 5 | All payment page scripts inventoried, SRI hashes | Most scripts with SRI | Some scripts without SRI | Inline scripts on payment pages |

---

### M13: Performance & Carbon (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Adblock CWV improvement | 6 | LCP improves <5% with adblock (minimal 3rd party impact) | 5-15% improvement | 15-30% improvement | >30% improvement (3rd parties dominate) |
| Carbon per pageview | 5 | < 0.2g CO2 | 0.2-0.5g | 0.5-1.0g | > 1.0g CO2 |
| Green hosting | 4 | IP in Green Web Foundation database | — | — | Not green hosted (info, minor penalty) |
| Third-party bloat ratio | 7 | 3rd party < 15% of total bytes | 15-30% | 30-50% | >50% |
| Resource optimization score | 6 | >80% modern images + full compression + caching | 60-80% | 40-60% | <40% |
| Adblock breakage | 5 | Site fully functional with adblock | Minor cosmetic issues | Significant layout/feature breakage | Site unusable with adblock |

---

### M14: Mobile & Responsive (GhostScan | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Viewport meta tag | 7 | width=device-width, initial-scale=1 | Present, correct | Present, user-scalable=no | Missing |
| Horizontal overflow (mobile) | 8 | No overflow at 375px width | — | Minor overflow (<10px) | Significant overflow (scrollbar visible) |
| Touch target size | 7 | All interactive elements ≥ 44×44px | >90% meet 44px | 70-90% meet 44px | <70% meet 44px |
| Mobile LCP | 6 | < 2.5s on mobile viewport + 4G | < 4.0s | 4-6s | > 6s |
| Responsive images | 5 | srcset + sizes on all content images | srcset on >70% | srcset on 30-70% | No srcset |
| Text readability (mobile) | 5 | All body text ≥ 14px at mobile | ≥ 12px | ≥ 10px | < 10px text at mobile |
| Mobile navigation | 5 | Hamburger/bottom nav, touch-friendly | Basic mobile nav | Desktop nav on mobile (tiny targets) | No mobile navigation |
| PWA readiness | 3 | Valid manifest + service worker + offline | Manifest + SW | Manifest only | Info only |
| Media queries | 4 | Mobile-first breakpoints, fluid layout | Standard breakpoints, adapts well | Desktop-first, adapts poorly | No responsive CSS |
| 3G load time | 4 | < 5s on simulated 3G | 5-10s | 10-15s | > 15s on 3G |

---

### M15: Social & Sharing (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Social profile links | 4 | 3+ social profiles linked, all valid URLs | 1-2 profiles | Links present but broken | Info only |
| OG image quality | 6 | 1200×630, <300KB, branded, high quality | Correct dimensions, basic | Wrong dimensions | No OG image |
| Twitter Card setup | 4 | summary_large_image, all fields, image valid | Basic card with image | Card type only | No Twitter Card tags |
| Social meta consistency | 5 | OG title = page title, OG desc = meta desc, OG URL = canonical | Mostly consistent | Some mismatches | Significant mismatches |
| Share buttons | 3 | Share buttons present and functional | At least 1 share mechanism | — | Info only |
| Social embeds | 2 | Embeds load efficiently (lite-youtube, facades) | Standard embeds | Heavy embeds (many iframes) | Info only |
| Social login | 2 | Info only (detected/not) | Info only | Info only | Info only |

---

### M16: PR & Media (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Press/newsroom page | 5 | Dedicated press page with recent releases | Press page found | Outdated (>1yr old content) | Info only (not every company needs one) |
| Media contact | 4 | Press email + phone + media kit download | Press email available | — | Info only |
| RSS feed | 3 | RSS feed auto-discovered, recent entries | RSS present | RSS present but empty/stale | Info only |
| "As seen in" / media logos | 3 | Media mention logos present | — | — | Info only |
| Press release recency | 4 | Content within last 3 months | Within 6 months | Within 1 year | >1 year old content |

---

### M17: Careers & HR (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Careers page | 4 | Dedicated careers page with open positions | Careers page found | Careers page, no listings | Info only |
| ATS provider | 3 | Professional ATS (Greenhouse, Lever, Ashby) | Any ATS detected | Manual job listings | Info only |
| Open positions count | 2 | Info only (count reported) | Info only | Info only | Info only |
| Team/culture page | 3 | Team page with photos/bios + culture page | Team page or culture page | — | Info only |
| Hiring velocity | 2 | Recent job postings (<30 days) | Postings within 90 days | Stale listings (>6 months) | Info only |

---

### M18: Investor Relations (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| IR portal | 4 | Dedicated IR page with filings + reports | IR page found | Basic investor info | Info only (private co) |
| Financial data | 3 | SEC filings linked, earnings reports | Annual report available | — | Info only |
| Ticker symbol | 2 | Info only (extracted) | Info only | Info only | Info only |
| ESG report | 2 | ESG/sustainability report linked | — | — | Info only |

---

### M19: Support & Success (Passive | Peek)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Help center | 5 | Professional help center (Zendesk, Intercom Articles) | Any help/FAQ page | Single FAQ page | No support documentation |
| Support channels | 5 | 3+ channels (chat, email, phone, ticket) | 2 channels | 1 channel | No contact information |
| System status page | 4 | StatusPage.io/Instatus/BetterUptime | Status page found | — | Info only |
| Business hours | 3 | Hours published on website | — | — | Info only |
| Community forum | 3 | Active community (Discourse, Circle) | Community link present | — | Info only |

---

### M20: Ecommerce/SaaS (Browser | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Ecommerce platform identified | 3 | Platform detected (Shopify, WooCommerce, etc.) | — | — | Info only |
| Product schema markup | 7 | Product JSON-LD with price, availability, reviews, images | Product JSON-LD, basic fields | Product schema, minimal | No product structured data |
| Pricing page (SaaS) | 5 | Clear pricing with tiers, CTAs, toggle | Pricing page found | Pricing requires "Contact Sales" only | No public pricing (info only) |
| Payment processor | 4 | Modern processor (Stripe, Adyen) detected | Any payment processor | — | Info only |
| Cart tracking events | 6 | AddToCart + ViewContent + Purchase events fire | AddToCart events detected | Basic page events only | No ecommerce events |
| Checkout flow | 4 | Single-page checkout OR clear multi-step | Multi-step with progress indicator | Unclear checkout flow | Broken checkout elements |
| Review system | 4 | Reviews with star ratings, recent (Yotpo, Judge.me, Trustpilot) | Reviews present | Outdated reviews (>6 months) | Info only |
| Currency/localization | 3 | Multi-currency or geo-detected pricing | Single currency, clear | — | Info only |

---

### M21: Ad Library Recon (External | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Active ads detected | 5 | Active ads found on Facebook + Google | Active on one platform | — | No active ads found (info only) |
| Ad creative variety | 4 | Multiple formats (image, video, carousel) | 2 formats | Single format | Info only |
| Ad count | 3 | Info only (count reported) | Info only | Info only | Info only |
| Landing page diversity | 4 | Ads point to multiple landing pages | Ads point to 2-3 pages | All ads → homepage | Info only |
| Geographic targeting | 2 | Info only (countries reported) | Info only | Info only | Info only |

---

### M22: News Sentiment (External | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Media coverage volume | 4 | 10+ articles in last 90 days | 3-9 articles | 1-2 articles | No coverage found (info only) |
| Sentiment distribution | 6 | >70% positive/neutral | 50-70% positive | 30-50% positive | <30% positive (crisis signal) |
| Recent coverage | 3 | Coverage within last 30 days | Within 90 days | Within 6 months | >6 months or none |
| Crisis detection | 5 | No negative spike patterns | — | Emerging negative trend | Active crisis (multiple negative in <7 days) |

---

### M23: Social Sentiment (External | Full)

| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| UGC mention volume | 4 | 20+ mentions across platforms | 5-19 mentions | 1-4 mentions | No mentions (info only) |
| Sentiment distribution | 6 | >65% positive/neutral | 50-65% positive | 35-50% positive | <35% positive |
| Complaint themes | 4 | No recurring complaints | Minor/isolated complaints | Recurring theme | Widespread complaint pattern |
| Brand advocacy | 3 | Active advocates/positive UGC | Some positive mentions | — | Info only |

---

### M24-M35: DataForSEO Market Intelligence

These modules score based on **benchmarks**, not implementation quality. The score reflects how the brand performs relative to industry averages.

**M24: Monthly Visits**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Monthly visits | 5 | >100K/mo | 10K-100K | 1K-10K | <1K |
| Visit trend (MoM) | 6 | Growing >5% MoM | Flat (±5%) | Declining 5-15% | Declining >15% |

**M25-M26: Traffic by Country & Rankings** — Info only (no scoring, context data)

**M27-M28: Paid Traffic & Keywords**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Paid traffic present | 4 | Active paid campaigns detected | — | — | No paid traffic detected (info only) |
| Keyword intent mix | 5 | Commercial + transactional intent keywords | Mostly commercial | Mostly informational | Info only |
| Ad spend efficiency | 4 | Low CPC relative to industry | Average CPC | Above average CPC | Info only |

**M29: Competitor Overlap** — Info only (competitive data, no scoring)

**M30: Traffic Sources**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Source diversity | 6 | No single source >50% | One source 50-65% | One source 65-80% | One source >80% (over-reliance) |
| Organic traffic share | 5 | Organic >30% of total | 15-30% | 5-15% | <5% organic |

**M31: Domain Trust**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Domain rank | 5 | Top 100K | Top 500K | Top 1M | >1M or unranked |
| Referring domains | 4 | >1000 | 100-1000 | 10-100 | <10 |
| Backlink quality | 4 | High trust/citation flow | Average | Below average | Spammy profile |

**M32-M35: Mobile vs Desktop, Brand Search, Losing Keywords, Bounce Rate**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Bounce rate | 5 | <35% | 35-50% | 50-65% | >65% |
| Pages per session | 3 | >3.0 | 2.0-3.0 | 1.5-2.0 | <1.5 |
| Brand search trend | 4 | Growing >10% YoY | Flat (±10%) | Declining 10-25% | Declining >25% |
| Losing keyword count | 4 | <5% of ranked keywords losing | 5-15% | 15-30% | >30% losing |

---

### M36-M39: Google Shopping, Reviews, Local Pack, Business Profile

**M36: Google Shopping** — Info only (presence/absence of product listings)

**M37: Review Velocity**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Average rating | 6 | ≥4.5 stars | 4.0-4.4 | 3.0-3.9 | <3.0 |
| Review count | 3 | >100 reviews | 20-100 | 5-20 | <5 |
| Recent reviews | 4 | Reviews within 30 days | Within 90 days | Within 6 months | >6 months old |
| Review velocity trend | 3 | Accelerating | Stable | Decelerating | No new reviews |

**M38: Local Pack** — Scored only if local business signals detected
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Local pack visibility | 5 | Appears in top 3 local results | Appears in local pack | — | Not visible in local pack |

**M39: Business Profile**
| Checkpoint | Wt | Excellent | Good | Warning | Critical |
|-----------|-----|-----------|------|---------|----------|
| Profile completeness | 6 | All fields: name, address, phone, hours, categories, photos, description | >80% complete | 50-80% | <50% or unclaimed |
| Photos | 3 | >10 quality photos | 5-10 photos | 1-4 photos | No photos |
| Business hours | 3 | Hours listed and current | Hours listed | — | Missing hours |
| Categories | 3 | Primary + secondary categories set | Primary category | — | No category |

---

### Scoring Notes for DataForSEO Modules

1. **Not every site has local presence** — M38/M39 checkpoints only score if the site has local business signals (physical address, Google My Business embed). If no local signals, these modules return `status: 'skipped'` and are excluded from category averages.

2. **Not every site runs paid traffic** — M27/M28/M21 checkpoints about paid presence are scored as `info` if no paid traffic is detected. A site with great organic traffic and no paid campaigns shouldn't be penalized.

3. **Benchmark thresholds** are conservative. A 50K visits/month site scoring "Good" is reasonable — we're not comparing everyone to Amazon.

---
---

# APPENDIX C: Fingerprint Database Schema

The technology fingerprint database is how M02 (CMS & Infrastructure) and other modules identify technologies from HTML, headers, scripts, cookies, and meta tags. This is a Wappalyzer-inspired approach using a JSON-based rule engine.

## Schema

```typescript
// apps/engine/src/data/fingerprints.ts

interface TechFingerprint {
  id: string;                      // unique key: 'wordpress', 'react', 'cloudflare'
  name: string;                    // display name: 'WordPress', 'React', 'Cloudflare'
  category: TechCategory;
  icon?: string;                   // path to icon file or URL (for dashboard display)
  website?: string;                // official website URL

  // Detection rules — ANY match = detected. Multiple rules increase confidence.
  rules: {
    headers?: HeaderRule[];        // HTTP response header patterns
    html?: HtmlRule[];             // HTML source patterns (regex on raw HTML)
    scripts?: ScriptRule[];        // Script src URL patterns
    meta?: MetaRule[];             // <meta> tag patterns
    cookies?: CookieRule[];        // Cookie name patterns
    globals?: GlobalRule[];        // JavaScript window.* globals (browser phase only)
    urls?: UrlRule[];              // Known URL paths that indicate the tech
    dns?: DnsRule[];               // DNS record patterns
  };

  // Version extraction (optional)
  version?: {
    source: 'header' | 'html' | 'script' | 'meta' | 'global';
    pattern: string;               // regex with capture group for version
  };

  // Implies other technologies
  implies?: string[];              // e.g., WordPress implies PHP, jQuery
  excludes?: string[];             // e.g., React excludes Angular (can't be both)
}

type TechCategory =
  | 'cms'           // WordPress, Shopify, Webflow, Wix
  | 'framework'     // React, Next.js, Vue, Angular
  | 'language'      // PHP, Node.js, Python, Ruby
  | 'server'        // nginx, Apache, IIS
  | 'cdn'           // Cloudflare, CloudFront, Fastly
  | 'hosting'       // AWS, GCP, Azure, Vercel, Netlify
  | 'analytics'     // GA4, Mixpanel, Amplitude
  | 'advertising'   // Meta Pixel, Google Ads
  | 'automation'    // HubSpot, Marketo, Klaviyo
  | 'chat'          // Intercom, Drift, Zendesk
  | 'ab_testing'    // Optimizely, VWO
  | 'monitoring'    // Sentry, Datadog, New Relic
  | 'payment'       // Stripe, PayPal
  | 'security'      // Cloudflare WAF, reCAPTCHA
  | 'font'          // Google Fonts, Adobe Fonts
  | 'build_tool'    // Webpack, Vite
  | 'database'      // hints only
  | 'other';

// Rule types
interface HeaderRule {
  name: string;                    // header name (case-insensitive)
  pattern?: string;                // regex to match header value (optional — presence alone may suffice)
  confidence: number;              // 0.0-1.0
}

interface HtmlRule {
  pattern: string;                 // regex to match in HTML source
  confidence: number;
}

interface ScriptRule {
  pattern: string;                 // regex to match script src URLs
  confidence: number;
}

interface MetaRule {
  name?: string;                   // meta tag name attribute
  property?: string;               // meta tag property attribute (for OG/etc)
  contentPattern?: string;         // regex to match content value
  confidence: number;
}

interface CookieRule {
  namePattern: string;             // regex to match cookie name
  confidence: number;
}

interface GlobalRule {
  name: string;                    // window.X property to check
  confidence: number;
}

interface UrlRule {
  path: string;                    // URL path to probe (e.g., '/wp-json')
  expectedStatus?: number;         // expected HTTP status (200, 301, etc.)
  responsePattern?: string;        // regex on response body
  confidence: number;
}

interface DnsRule {
  recordType: string;              // 'CNAME', 'TXT', 'A', etc.
  pattern: string;                 // regex on record value
  confidence: number;
}
```

## Example Entries

```json
[
  {
    "id": "wordpress",
    "name": "WordPress",
    "category": "cms",
    "rules": {
      "html": [
        { "pattern": "wp-content/", "confidence": 0.95 },
        { "pattern": "wp-includes/", "confidence": 0.9 }
      ],
      "meta": [
        { "name": "generator", "contentPattern": "WordPress\\s?([\\d.]+)?", "confidence": 1.0 }
      ],
      "urls": [
        { "path": "/wp-json/", "expectedStatus": 200, "confidence": 0.95 },
        { "path": "/wp-login.php", "expectedStatus": 200, "confidence": 0.9 }
      ],
      "headers": [
        { "name": "x-powered-by", "pattern": "WordPress", "confidence": 0.9 },
        { "name": "link", "pattern": "wp-json", "confidence": 0.85 }
      ]
    },
    "version": { "source": "meta", "pattern": "WordPress\\s?([\\d.]+)" },
    "implies": ["php", "mysql"]
  },
  {
    "id": "nextjs",
    "name": "Next.js",
    "category": "framework",
    "rules": {
      "html": [
        { "pattern": "__NEXT_DATA__", "confidence": 1.0 },
        { "pattern": "_next/static", "confidence": 0.95 }
      ],
      "headers": [
        { "name": "x-powered-by", "pattern": "Next\\.js", "confidence": 1.0 }
      ],
      "scripts": [
        { "pattern": "/_next/", "confidence": 0.9 }
      ]
    },
    "implies": ["react", "nodejs"]
  },
  {
    "id": "cloudflare",
    "name": "Cloudflare",
    "category": "cdn",
    "rules": {
      "headers": [
        { "name": "cf-ray", "confidence": 1.0 },
        { "name": "server", "pattern": "cloudflare", "confidence": 1.0 },
        { "name": "cf-cache-status", "confidence": 0.95 }
      ],
      "dns": [
        { "recordType": "NS", "pattern": "\\.ns\\.cloudflare\\.com$", "confidence": 1.0 }
      ]
    }
  },
  {
    "id": "ga4",
    "name": "Google Analytics 4",
    "category": "analytics",
    "rules": {
      "scripts": [
        { "pattern": "googletagmanager\\.com/gtag/js\\?id=G-", "confidence": 1.0 }
      ],
      "globals": [
        { "name": "gtag", "confidence": 0.8 },
        { "name": "dataLayer", "confidence": 0.5 }
      ],
      "html": [
        { "pattern": "G-[A-Z0-9]{7,10}", "confidence": 0.7 }
      ]
    },
    "version": { "source": "html", "pattern": "gtag\\.js\\?id=(G-[A-Z0-9]+)" }
  }
]
```

## Confidence Aggregation

When multiple rules match for the same technology, confidence is aggregated:
```
final_confidence = 1 - Π(1 - rule_confidence)
```
Example: HTML match (0.7) + script match (0.9) → 1 - (0.3 × 0.1) = **0.97**

A technology is reported as "detected" when `final_confidence ≥ 0.6`.

## Database Size Target

Launch with ~300 fingerprints covering:
- ~30 CMS platforms
- ~20 frontend frameworks
- ~15 server/languages
- ~15 CDNs
- ~20 hosting providers
- ~40 analytics tools
- ~30 advertising tools
- ~40 MarTech/automation tools
- ~20 chat/support tools
- ~15 A/B testing tools
- ~15 monitoring tools
- ~10 payment tools
- ~30 other (fonts, build tools, security, etc.)

Expand as we encounter new technologies in production scans.

---
---

# APPENDIX D: P2 Report Section Structure

The P2 "McKinsey-style" report is a paid deliverable ($9.99). It must feel like a $50K consulting engagement condensed into a digital document. The web view uses a presentation-like layout (one section per screen with scroll navigation). The PDF download uses print-optimized CSS.

## Design Principles
- **Data-dense but scannable** — heavy use of charts, tables, and traffic lights
- **Every claim has evidence** — citations to module data throughout
- **Action-oriented** — every section ends with specific recommendations
- **Visually authoritative** — Recharts for charts, consistent color palette, ample whitespace
- **Confidential feel** — watermarked, dated, branded header/footer

## Sections (15 total)

### Cover (1 page)
```
┌──────────────────────────────────────────┐
│                                          │
│  [MarketingAlphaScan Logo]               │
│                                          │
│  MARKETING TECHNOLOGY                    │
│  AUDIT REPORT                            │
│                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
│                                          │
│  {{domain}}                              │
│  Scan Date: {{date}}                     │
│  MarketingIQ: {{score}}/100              │
│                                          │
│  ──────────────────────────────          │
│  CONFIDENTIAL                            │
│  Prepared exclusively for {{user_email}} │
│  Report ID: {{scan_id}}                  │
│                                          │
└──────────────────────────────────────────┘
```

### Table of Contents (1 page)
Anchor-linked sections with page numbers for PDF. Category traffic light dots next to each section name.

### Section 1: Executive Summary (1 page)
- MarketingIQ score gauge (large, centered)
- 3-paragraph executive brief from M42
- 8 category traffic lights in a horizontal bar
- "Top 3 Critical Findings" callout box (red border)
- "Top 3 Opportunities" callout box (green border)
- Data sources: M42

### Section 2: Technology Stack Overview (1-2 pages)
- Visual "stack diagram" — grouped icons for detected tools by category
- Table: Tool | Category | Status | Detected Via | Confidence
- "Stack Health" summary: total tools, active, inactive/abandoned, redundant pairs
- Comparison badge: "Your stack uses {{count}} tools — the average for {{industry}} is {{avg}}"
- Data sources: M02, M05, M06, M07, M08, M09, M20

### Section 3: Analytics & Data Integrity (1-2 pages)
- Category score gauge: {{score}}/100 (traffic light)
- Analytics architecture diagram: which tools feed where (GA4 → BigQuery? Segment → destinations?)
- dataLayer health check: completeness, ecommerce data, custom dimensions
- Consent mode status: visual showing consent → tracking flow
- Key finding cards (2-3) with severity badges
- Recommendations table (from M41 for M05, M08, M09)
- Data sources: M05, M08, M09

### Section 4: Paid Media & Attribution (1-2 pages)
- Category score gauge
- Pixel inventory table: Platform | Pixel ID | Events Firing | Enhanced Conversions | CAPI
- Click ID preservation audit: gclid/fbclid/etc. → status badges
- **PPC Landing Page Audit (from M06b)**: parity matrix showing main page vs. each PPC page tracking
- Attribution gap visualization: what's tracked vs. what's missing (Sankey-style diagram)
- "Dark conversions" estimate from M44 (how much revenue is invisible)
- Data sources: M06, M06b, M21, M28, M29, M44

### Section 5: Performance & User Experience (1-2 pages)
- Core Web Vitals dashboard: LCP/INP/CLS with pass/fail badges
- Performance waterfall chart (top 20 resources by load time)
- Third-party impact: pie chart of bytes by party + bar chart of 3rd party domains
- Mobile vs. desktop performance comparison
- Adblock simulation results: "Without third-party scripts, your LCP improves by {{delta}}ms ({{pct}}%)"
- Carbon footprint: grams CO2 per pageview + annual estimate
- Data sources: M03, M13, M14

### Section 6: Compliance & Security (1-2 pages)
- Category score gauge
- Consent audit: visual timeline showing "Before Consent → After Accept → After Reject" with cookie/request counts
- Security headers checklist: green check / red X for each header
- CSP policy breakdown: directive-by-directive analysis
- Cookie audit table: Name | Domain | Category | Secure | HttpOnly | SameSite | Expiry | Compliant?
- PCI DSS compliance status (if payment page detected)
- Privacy policy age and completeness
- Regulatory risk callout box: "Based on detected tracking and consent gaps, estimated regulatory exposure is {{range}} per year [Source: M44]"
- Data sources: M01, M10, M11, M12

### Section 7: MarTech Efficiency (1 page)
- Category score gauge
- Tool utilization matrix: rows = tools, columns = [Detected, Loading, Firing Events, Integrated]
- Redundancy pairs highlighted (e.g., "GA4 + Adobe Analytics = redundant analytics")
- Abandoned tool list with estimated waste
- Automation coverage: email capture, forms, chat, nurture — what's present, what's missing
- Data sources: M07, M20, M45

### Section 8: SEO & Content Foundation (1 page)
- Category score gauge
- Metadata completeness scorecard: title, description, canonical, OG, schema, robots, sitemap
- Structured data validation results
- Social sharing preview: rendered OG card + Twitter card mockup
- SEO quick wins list (from M41 recommendations for M04)
- Data sources: M04, M15, M16

### Section 9: Market Position (1-2 pages)
- Monthly visits trend chart (12 months if available)
- Traffic sources pie chart
- Rankings: global, country, category
- Competitor overlap table: shared keywords, unique keywords
- Brand search trend line (MoM)
- Domain trust score with backlink summary
- Bounce rate benchmarked against industry
- Data sources: M24-M35

### Section 10: Digital Presence Completeness (1 page)
- Checklist-style grid:
  - [✓/✗] Press/Newsroom page
  - [✓/✗] Careers page with ATS
  - [✓/✗] Investor Relations
  - [✓/✗] Help Center
  - [✓/✗] System Status Page
  - [✓/✗] Community Forum
  - [✓/✗] Contact Information
- Organizational maturity signal: "Based on digital presence signals, this organization presents as a [startup / growth-stage / enterprise] operation"
- Data sources: M02, M17, M18, M19

### Section 11: ROI Impact Analysis (1 page)
- Total monthly opportunity: large number, prominent
- Breakdown cards: Tracking Gaps ($X), Attribution Waste ($X), Performance Impact ($X), Compliance Risk ($X), Tool Redundancy ($X)
- Each card shows calculation steps (expandable in web, full in PDF)
- Confidence indicators per estimate
- "If you fix the P0 issues identified in this report, your MarketingIQ would improve from {{current}} to an estimated {{target}}"
- Data sources: M44, M45

### Section 12: Remediation Roadmap (2-3 pages)
- Priority matrix: 2×2 quadrant chart (Impact × Effort) with workstream dots
- Timeline: Gantt-style bars showing Week 1, Week 2, Week 3-4, Month 2, Month 3+
- Workstream cards: each workstream from M43 with task count, total effort, owner role
- Top 5 quick wins (effort=S, impact=high) highlighted
- Data sources: M43

### Section 13: Detailed Findings Appendix (variable length)
- Module-by-module detail: every module's full findings, all checkpoints, all signals
- Expandable sections (web) / full print (PDF)
- This is the "proof" — everything that supports the executive summary
- Data sources: All modules

### Section 14: Methodology & Scoring (1 page)
- How MarketingIQ is calculated (category weights, formula)
- Checkpoint system explained
- Penalty and bonus system
- Data collection methods overview (passive, browser, GhostScan, external APIs, AI synthesis)
- "This report was generated by the AlphaScan Method™"

### Section 15: Sources & Citations (1 page)
- List of all data sources used
- Module IDs with timestamps
- External data providers (DataForSEO, Google AI)
- Industry benchmarks cited with source URLs
- Disclaimer: "This analysis is based on a point-in-time scan of publicly available data..."

## PDF Generation Strategy

**Primary approach:** `window.print()` with `@media print` CSS
- Zero server cost
- Instant generation (no API call)
- Print stylesheet hides navigation, expands collapsed sections, adds page breaks
- Watermark on every page: "Confidential — {{domain}} — {{date}}"

**Fallback approach (if print quality insufficient):** Puppeteer on the engine
- Navigate to `/report/{{id}}?print=true` (render-optimized version)
- `page.pdf()` with A4 format
- Upload to Supabase Storage
- More resource-intensive but pixel-perfect

---
---

# APPENDIX E: Error & Empty State UX Patterns

Six reusable patterns that cover every failure mode in the frontend.

## Pattern 1: Loading State (Skeleton)
**Used by:** Scan progress, dashboard loading, report loading
```
┌─────────────────────────────────────┐
│  ░░░░░░░░░░░░░░  ← skeleton bar    │
│  ░░░░░░░░░░░░░░░░░░░░              │
│                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │░░░░░░│  │░░░░░░│  │░░░░░░│      │
│  │░░░░░░│  │░░░░░░│  │░░░░░░│      │
│  └──────┘  └──────┘  └──────┘      │
└─────────────────────────────────────┘
```
- Pulse animation (opacity 0.4→1→0.4)
- Matches final layout shape (skeleton of actual content)
- shadcn/ui `Skeleton` component

## Pattern 2: Scan Failed
**Used by:** Scan result page when scan status = 'failed'
```
┌─────────────────────────────────────┐
│                                      │
│         [Warning Icon]               │
│                                      │
│    Scan Could Not Complete           │
│                                      │
│    We couldn't reach {{domain}}.     │
│    This usually means the site is    │
│    blocking automated requests or    │
│    is temporarily unavailable.       │
│                                      │
│    [Try Again]  [Scan Different URL] │
│                                      │
│    ─────────────────────────────     │
│    Error: {{failure_reason}}         │
│    Scan ID: {{scan_id}}              │
└─────────────────────────────────────┘
```
- Failure reason displayed in muted text
- Two actionable CTAs
- Scan ID for support reference

## Pattern 3: Module Unavailable
**Used by:** Individual module cards in P1 dashboard when module status = 'error'
```
┌──────────────────────────────┐
│  [Module Name]        [!]    │
│                              │
│  This module couldn't        │
│  complete its analysis.      │
│                              │
│  Reason: {{error_summary}}   │
│                              │
│  Other modules are not       │
│  affected.                   │
└──────────────────────────────┘
```
- Yellow warning badge, not red (non-blocking)
- Reassurance that other modules are fine
- Card is visually dimmed (opacity 0.6)
- No score displayed (dash instead of number)

## Pattern 4: Rate Limited
**Used by:** Scan form submission when daily limit reached
```
┌─────────────────────────────────────┐
│                                      │
│   Daily Scan Limit Reached           │
│                                      │
│   You've used {{used}}/{{limit}}     │
│   scans today. Limits reset at       │
│   midnight UTC.                      │
│                                      │
│   [Register for more scans]          │
│   or                                 │
│   [Upgrade to unlimited →]           │
│                                      │
└─────────────────────────────────────┘
```
- Clear count of used/remaining
- Upsell to registration (if anonymous) or paid tier
- No scan form visible (replaced by this message)

## Pattern 5: Empty State (No Scans)
**Used by:** Dashboard history page when user has no scans
```
┌─────────────────────────────────────┐
│                                      │
│      [Illustration/Icon]             │
│                                      │
│   No scans yet                       │
│                                      │
│   Enter a URL to run your first      │
│   marketing technology audit.        │
│                                      │
│   ┌─────────────────────────────┐   │
│   │ https://                  [→]│   │
│   └─────────────────────────────┘   │
│                                      │
└─────────────────────────────────────┘
```
- Inline scan input (user doesn't need to navigate away)
- Encouraging copy, not empty/sad

## Pattern 6: Partial Results Banner
**Used by:** P1 dashboard when scan health = 'partial' or 'degraded'
```
┌─────────────────────────────────────┐
│ ⚠ This scan completed with partial  │
│ results. {{error_count}} modules    │
│ encountered issues. MarketingIQ is  │
│ based on available data.            │
│                           [Dismiss] │
└─────────────────────────────────────┘
```
- Yellow banner at top of dashboard
- Dismissible (but comes back if page refreshed)
- Links "modules" to anchor that highlights unavailable module cards

## Implementation

All 6 patterns are implemented as reusable components:

```
components/
├── states/
│   ├── loading-skeleton.tsx      # Pattern 1
│   ├── scan-failed.tsx           # Pattern 2
│   ├── module-unavailable.tsx    # Pattern 3
│   ├── rate-limited.tsx          # Pattern 4
│   ├── empty-state.tsx           # Pattern 5
│   └── partial-results.tsx       # Pattern 6
```

Each accepts props for customization (error message, counts, CTAs) but maintains consistent visual treatment across the app.

---
---

# APPENDIX F: Testing Strategy Specification

**Full specification:** `purring-hugging-globe-agent-ab239fc.md` (3,017 lines, 101KB)

## Summary

Comprehensive testing strategy covering all layers of the MarketingAlphaScan platform.

### Key Decisions
- **Test runner:** Vitest (not Jest) — native ESM, TypeScript, faster, same API
- **E2E:** Playwright Test (already a dependency for the scan engine)
- **Mocking:** MSW v2 for HTTP mocking, custom MockPage factory for Playwright
- **Property-based testing:** @fast-check/vitest for parser fuzz testing

### Coverage Targets
| Layer | Target | Rationale |
|-------|--------|-----------|
| Shared types & validators (Zod) | 95% | Critical correctness boundary |
| Module parsers (cheerio, regex) | 85% | Complex string parsing, high bug surface |
| Module executors (Playwright) | 70% | Browser interaction harder to test |
| API routes (Fastify + Next.js) | 80% | Integration-level testing |
| React components | 60% | Covered more by E2E than unit tests |
| E2E critical paths | 100% of 8 paths | Smoke test the full user journey |

### Testing Layers
1. **Unit tests** — Module parsers, signal extraction, scoring logic, Zod validators
2. **Integration tests** — Full module execution with MockPage/MockNetworkCollector
3. **API tests** — Fastify route testing with Supabase mocks, Next.js route handlers
4. **E2E tests** — 8 critical paths (anonymous peek, registered full, payment, chat, etc.)
5. **Golden dataset** — 10 real websites with recorded responses for deterministic regression
6. **Property-based** — Fuzz HTML parsers, URL normalizers, fingerprint matchers

### Golden Dataset (10 Sites)
stripe.com, nike.com, notion.so, nytimes.com, shopify.com (store), hubspot.com, gov.uk, wikipedia.org, producthunt.com, broken-site (synthetic)

### CI Pipeline
- GitHub Actions, ~538 minutes/month estimated
- Parallel jobs: lint+typecheck, unit tests, integration tests, E2E
- Coverage gates enforced per-PR

---
---

# APPENDIX G: Deployment Pipeline & Disaster Recovery Specification

**Full specification:** `purring-hugging-globe-agent-ae7d37b.md` (2,418 lines, 76KB)

## Summary

Complete deployment, CI/CD, backup, and disaster recovery strategy for all infrastructure components.

### Key Decisions
- **Git strategy:** Trunk-based development (main branch, short-lived feature branches)
- **Container registry:** GitHub Container Registry (GHCR) — free for public repos
- **Engine deployment:** Multi-stage Docker build, docker-compose on DigitalOcean
- **Frontend deployment:** Vercel Git integration (auto-deploy on push)
- **Total infrastructure cost:** $7.20/month at launch

### CI/CD Workflows (6 GitHub Actions)
1. **ci.yml** — Lint, typecheck, unit tests, integration tests (on every PR)
2. **e2e.yml** — Playwright E2E tests against staging (on PR to main)
3. **deploy-engine.yml** — Build Docker image → push to GHCR → SSH deploy to droplet (on merge to main)
4. **deploy-web.yml** — Vercel handles automatically (Git integration)
5. **backup.yml** — Weekly pg_dump via Supabase CLI → upload to DO Spaces
6. **health-check.yml** — Hourly cron: hit /engine/health, alert on failure

### Droplet Setup
- `droplet-init.sh` — Full provisioning script (Docker, firewall, SSH hardening, swap, monitoring agent)
- UFW firewall: only ports 22, 443 open; Vercel IP ranges whitelisted for engine access
- 1GB swap file for OOM protection on $6 droplet

### Backup Strategy
| Data | Method | Frequency | Retention | Recovery Time |
|------|--------|-----------|-----------|---------------|
| PostgreSQL (Supabase) | pg_dump via CLI + Supabase daily backups | Weekly (manual) + Daily (Supabase) | 30 days | < 1 hour |
| Redis (BullMQ) | Ephemeral — jobs are disposable | N/A | N/A | Restart Redis |
| Scan engine code | Git + GHCR images | Every deploy | All images retained | < 5 min redeploy |
| Environment secrets | 1Password / encrypted backup | On change | Indefinite | < 15 min |

### Disaster Recovery Scenarios (6)
1. **Droplet dies** — Spin new droplet, run init script, pull latest image, restore Redis (empty OK)
2. **Supabase outage** — Engine queues retry; frontend shows cached results; Supabase SLA: 99.9%
3. **Vercel outage** — DNS failover to maintenance page on Cloudflare; Vercel SLA: 99.99%
4. **Database corruption** — Restore from pg_dump backup; max data loss: 1 week of scans
5. **Secret leak** — Rotate all secrets, redeploy, audit log review, invalidate sessions
6. **DDoS** — Cloudflare absorbs L3/L4; rate limiting handles L7; queue depth limit protects engine

### Monitoring Stack ($0)
- UptimeRobot: 5-minute health checks on frontend + engine
- DigitalOcean Metrics: CPU, RAM, disk, bandwidth
- PostHog: business metrics dashboards
- bull-board: queue monitoring UI at /admin/queues

---
---

# APPENDIX H: Data Visualization Specification

**Full specification:** `purring-hugging-globe-agent-afc6dd5.md` (2,396 lines, 75KB)

## Summary

Complete specification for all charts, gauges, animations, and data visualization components across P1 Dashboard and P2 Report.

### Key Decisions
- **Chart library:** Recharts (React-native, composable, lightweight, good defaults)
- **Custom components:** SVG-based ScoreGauge, TrafficLight, TechStackMap (not Recharts)
- **Animation:** Framer Motion for scroll-triggered entrances + micro-interactions
- **Bundle budget:** ~95KB gzipped for all visualization code

### Chart Inventory (21 Types)

| # | Chart Type | Used In | Library |
|---|-----------|---------|---------|
| 1 | ScoreGauge (circular) | P1 header, P2 cover | Custom SVG |
| 2 | TrafficLight dots | P1 category bar, P2 sections | Custom SVG |
| 3 | Horizontal bar chart | P1 category scores | Recharts BarChart |
| 4 | Radar chart | P2 category comparison | Recharts RadarChart |
| 5 | Treemap | P2 tech stack | Recharts Treemap |
| 6 | Sankey diagram | P2 attribution flow | Custom SVG |
| 7 | Waterfall chart | P2 performance | Recharts BarChart (stacked) |
| 8 | Line chart | P2 traffic trends | Recharts LineChart |
| 9 | Pie/donut chart | P2 traffic sources | Recharts PieChart |
| 10 | Scatter plot | P2 impact×effort quadrant | Recharts ScatterChart |
| 11 | Stacked bar | P2 resource breakdown | Recharts BarChart |
| 12 | Timeline/Gantt | P2 remediation roadmap | Custom SVG |
| 13 | Comparison matrix | P2 PPC parity | Custom HTML table |
| 14 | Consent timeline | P2 compliance | Custom SVG |
| 15 | Checklist grid | P2 digital presence | Custom HTML |
| 16 | Cookie inventory table | P2 compliance | Custom HTML table |
| 17 | Signal badge grid | P1 module cards | Custom component |
| 18 | Progress bar | Scan progress | Custom SVG |
| 19 | Heatmap | P2 module error rates | Recharts (custom cells) |
| 20 | Sparkline | P1 inline trends | Recharts LineChart (mini) |
| 21 | Flow diagram | P2 analytics architecture | Custom SVG |

### Animation Strategy
- **Scroll-triggered:** IntersectionObserver + Framer Motion `whileInView`
- **Staggered cards:** 0.05s delay per card in bento grid
- **Score count-up:** 0→score over 2s with easeOut
- **Chart entrance:** Bars grow from 0, lines draw left-to-right, pie slices expand
- **Reduced motion:** `prefers-reduced-motion` respected — instant render, no animation

### 7 Custom Components
1. `ScoreGauge` — SVG circular gauge with animated stroke-dasharray
2. `TrafficLight` — Colored dot + label with pulse animation on red
3. `TechStackMap` — Grouped technology icons using simple-icons
4. `SankeyDiagram` — Custom SVG paths for attribution flow
5. `ConsentTimeline` — Before/after consent visual comparison
6. `GanttTimeline` — Horizontal bars for remediation schedule
7. `FlowDiagram` — Node-and-edge analytics architecture diagram

### Accessibility
- All charts have `role="img"` + `aria-label` with data summary
- Color-blind safe palette (tested with Coblis simulator)
- Minimum 3:1 contrast on all data elements
- Screen reader data tables as hidden alternatives to visual charts

---
---

# APPENDIX I: Email System & Lifecycle Specification

**Full specification:** `purring-hugging-globe-agent-a3df5ed.md` (1,560 lines, 60KB)

## Summary

Complete email infrastructure, template design, lifecycle automation, analytics, and compliance specification.

### Key Decisions
- **Provider:** Resend (3,000 emails/month free tier, React Email support)
- **Sending domain:** `send.marketingalphascan.com` subdomain (protects root domain reputation)
- **Auth integration:** Supabase Send Email Hook → POST to Next.js endpoint → Resend
- **Template engine:** React Email (JSX-based, type-safe, preview server)
- **Monorepo packages:** `packages/email-templates` + `packages/email-service`

### 10 Transactional Email Templates

| # | Template | Trigger | Category |
|---|----------|---------|----------|
| 1 | Email Verification | Supabase auth signup | Auth |
| 2 | Magic Link | Supabase magic link request | Auth |
| 3 | Welcome | First email verified | Onboarding |
| 4 | Password Reset | Supabase password reset | Auth |
| 5 | Scan Complete | Scan status → complete | Notification |
| 6 | Payment Receipt | Stripe webhook → payment_completed | Transaction |
| 7 | Alpha Brief Ready | M42-M46 synthesis complete | Notification |
| 8 | Chat Credits Purchased | Stripe webhook → chat_credits | Transaction |
| 9 | Account Deletion Confirmation | DELETE /api/account | Account |
| 10 | Re-engagement | 14 days inactive + has scans | Marketing |

### Email Design System
- 600px max-width, single-column layout
- Colors aligned with app palette (Deep Navy header, Off-White body)
- Plus Jakarta Sans headings, Inter body (web-safe fallbacks)
- VML buttons for Outlook compatibility
- Mobile-responsive with fluid widths

### Lifecycle & Timing
- Rate limiting: 10 emails/user/24h global cap, 3/hr for auth, 5/hr for scan notifications
- Deduplication: SHA-256 hash of `userId:templateId:scanId:hourBucket`
- Suppression: hard bounces auto-suppress, complaints auto-suppress, user preferences honored
- Warmup plan: 50/day → 200/day → 500/day → full volume over 4 weeks

### Database Tables
- `email_log` — All sent emails with Resend message ID, status, opened/clicked tracking
- `email_suppression_list` — Hard bounces and complaints (permanent suppression)
- `email_preferences` — Per-user opt-in/opt-out by category

### Compliance
- CAN-SPAM: 9 transactional (no unsubscribe required) + 1 marketing (unsubscribe required)
- GDPR: Legitimate interest for transactional, explicit consent for marketing
- RFC 8058: `List-Unsubscribe-Post` header on marketing emails
- One-click unsubscribe endpoint with HMAC-signed tokens

### Cost
- Launch through Growth: $0/month (within Resend free tier)
- Traction phase (5K scans/mo): ~$20/month

---
---

# APPENDIX J: P2 McKinsey Report Design Specification

**Full specification:** `purring-hugging-globe-agent-abe5e17.md` (1,866 lines, 75KB)

## Summary

Complete design specification for the P2 paid report — a McKinsey/Bain/BCG-style marketing technology audit document delivered as web view + PDF download.

### Key Decisions
- **Web-first:** React Server Components with lazy-loaded sections via IntersectionObserver
- **PDF strategy:** `window.print()` with `@media print` CSS (primary, $0) + Puppeteer fallback (pixel-perfect)
- **Charts:** Recharts for data charts, custom SVG for specialized visualizations
- **Access control:** Paid tier check on server, JWT-signed shareable links (7-day expiry)
- **Storage:** PDF cached in Supabase Storage, served with signed URLs

### 15 Report Sections

| # | Section | Pages | Key Visualizations |
|---|---------|-------|--------------------|
| 1 | Cover | 1 | ScoreGauge (xl), gradient background |
| 2 | Table of Contents | 1 | Anchor links, traffic light dots |
| 3 | Executive Summary | 1 | Score gauge, 8 traffic lights, findings/opportunities cards |
| 4 | Technology Stack | 1-2 | Treemap, stack diagram, detection table |
| 5 | Analytics & Data | 1-2 | Flow diagram, consent timeline, dataLayer health |
| 6 | Paid Media | 1-2 | Pixel inventory, PPC parity matrix, Sankey attribution |
| 7 | Performance & UX | 1-2 | CWV dashboard, waterfall, pie chart, carbon footprint |
| 8 | Compliance & Security | 1-2 | Consent audit, security headers checklist, cookie table |
| 9 | MarTech Efficiency | 1 | Utilization matrix, redundancy pairs, tool activity |
| 10 | SEO & Content | 1 | Metadata scorecard, OG/Twitter card mockups |
| 11 | Market Position | 1-2 | Line chart (traffic), pie chart (sources), competitor table |
| 12 | Digital Presence | 1 | Checklist grid, maturity assessment |
| 13 | ROI Impact | 1 | Hero number, 5 impact cards, stacked bar chart |
| 14 | Remediation Roadmap | 2-3 | Impact×Effort quadrant, Gantt timeline, quick wins |
| 15 | Methodology & Sources | 1 | Scoring formula, data sources, disclaimer |

Plus: Detailed Findings Appendix (variable length, per-module expandable sections)

### Component Architecture
- `ReportView` — top-level Server Component, fetches all data
- `ReportSection` — reusable wrapper with print page-break handling
- `CategorySection` — reusable deep-dive section for each of 8 categories
- `LazySection` — IntersectionObserver wrapper for progressive loading
- Per-section data transform pipeline: raw DB → `ReportData` interface → section props

### Print CSS Strategy
- `@media print` hides navigation, expands collapsed sections, adds page breaks
- Forced colors for charts (no gradients in print)
- Watermark on every page: "Confidential — {{domain}} — {{date}}"
- A4 format with 20mm margins

### Performance Budget
- Initial load: < 3s (Server Components + lazy sections)
- Total JS bundle: < 150KB gzipped
- Chart rendering: < 500ms per section
- PDF generation (Puppeteer): < 30s

### Accessibility
- Heading hierarchy: h1 (report title) → h2 (sections) → h3 (subsections)
- All charts have ARIA labels with data summaries
- Color-blind safe (patterns + labels, not color alone)
- Keyboard navigable TOC with scroll-to-section

---
---

# APPENDIX K: Sub-Specification File Index

All detailed specifications are stored as sub-files alongside this plan:

| Appendix | Subject | File | Lines | Size |
|----------|---------|------|-------|------|
| F | Testing Strategy | `purring-hugging-globe-agent-ab239fc.md` | 3,017 | 101KB |
| G | Deployment & DR | `purring-hugging-globe-agent-ae7d37b.md` | 2,418 | 76KB |
| H | Data Visualization | `purring-hugging-globe-agent-afc6dd5.md` | 2,396 | 75KB |
| I | Email System | `purring-hugging-globe-agent-a3df5ed.md` | 1,560 | 60KB |
| J | McKinsey Report | `purring-hugging-globe-agent-abe5e17.md` | 1,866 | 75KB |
| **Total** | | | **11,257** | **387KB** |

All files are located in `/Users/ianramirez/.claude/plans/`.
