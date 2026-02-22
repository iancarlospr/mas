# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | 15 |
| **React** | React + React DOM | 19 |
| **Backend** | Fastify | 5 |
| **Job Queue** | BullMQ (Redis-backed) | 5 |
| **Browser Automation** | Patchright (Playwright fork) | 1.57 |
| **Database** | Supabase (PostgreSQL) | — |
| **Auth** | Supabase Auth (@supabase/ssr) | — |
| **Payments** | Stripe (checkout sessions) | 2025-02-24.acacia |
| **AI** | Google Gemini (Flash + Pro) | 2.5 |
| **Email** | Resend | — |
| **Charts** | Recharts + custom SVG | — |
| **Animation** | Framer Motion | — |
| **CSS** | Tailwind CSS | 3.4 |
| **Validation** | Zod | — |
| **Monorepo** | Turborepo + npm workspaces | 2.3 |
| **TypeScript** | Strict mode, ES2022 target | 5.7 |
| **Runtime** | Node.js | >=20 |
| **Package Manager** | npm | 10.8.0 |
| **Logging (Engine)** | Pino (+ pino-pretty dev) | — |
| **Analytics** | PostHog (client + server) | — |
| **Bot Protection** | Cloudflare Turnstile | — |
| **Hosting (Web)** | Vercel | — |
| **Hosting (Engine)** | DigitalOcean (Docker + Caddy) | — |
| **CI/CD** | GitHub Actions (7 workflows) | — |

## Build & Dev Commands

```bash
# Monorepo (Turborepo + npm workspaces)
npm run dev              # Start all apps (web :3000, engine :3001)
npm run build            # Build all (types first via ^build dependency)
npm run typecheck        # TypeScript check all workspaces
npm run lint             # ESLint all workspaces

# Individual workspace typecheck
npx tsc --noEmit --project apps/web/tsconfig.json
npx tsc --noEmit --project apps/engine/tsconfig.json

# Tests
npm test                 # Vitest (all projects)
npm run test:unit        # Vitest run (no watch)
npm run test:e2e         # Playwright E2E (chromium + mobile-chrome)
npm run test:e2e:ui      # Playwright with UI
npm run test:visual      # Visual regression (screenshot diffs)
npm run test:coverage    # Vitest with coverage report

# Engine dev (standalone)
cd apps/engine && npm run dev   # tsx watch --env-file=.env (no dotenv)

# Types must build before engine typecheck
npm run build --workspace=packages/types
```

## Deployment Flow

### Web (Vercel) — automatic on push to main

```
git push origin main
  → Vercel GitHub App detects changes in apps/web/** or packages/types/**
  → Vercel builds: `turbo build` (types first, then Next.js)
  → Vercel deploys to production (standalone output mode)
  → GitHub Actions deploy-web.yml verifies health check (HTTP 200)
```

- Vercel project uses `turbo build` as build command so workspace deps build first
- Env vars configured in Vercel dashboard (all `NEXT_PUBLIC_*` + server secrets)
- `.env.local` needed locally with `NEXT_PUBLIC_*` stubs for static prerendering (gitignored)
- Next.js config: `output: 'standalone'`, PostHog reverse proxy via rewrites (`/ingest/*`)

### Engine (DigitalOcean) — automatic on push to main

```
git push origin main
  → GitHub Actions deploy-engine.yml triggers (path: apps/engine/**)
  → Builds Docker image → pushes to ghcr.io (tagged :latest + :sha)
  → SSH into DigitalOcean → docker compose pull → up -d engine
  → Health check loop (30 attempts, 2s interval = 60s max)
  → On failure: auto-rollback to previous image
```

- Production stack: Caddy (reverse proxy + TLS) → Engine (Fastify + Patchright) → Redis
- Redis: AOF persistence, auth, disabled FLUSHALL/FLUSHDB/CONFIG/DEBUG/KEYS
- Engine: 768MB memory limit, tmpfs /tmp (noexec, 256MB), no-new-privileges

### Database (Supabase) — automatic on push to main

```
git push origin main
  → GitHub Actions db-migrate.yml triggers (path: supabase/migrations/**)
  → supabase link → supabase db push → supabase db diff --linked
```

### CI Pipeline (every push/PR)

```
changes (path filter)
  → lint-typecheck (fast gate)
    → unit-tests (parallel: engine, web, types)
    → integration-tests (with Redis service container)
      → build-web + build-engine (parallel validation)
        → e2e-tests (main branch only, Playwright chromium)
```

Coverage thresholds: engine 70%, web 60%, types 90%.

## Architecture

**Monorepo layout**: `apps/web` (Next.js 15), `apps/engine` (Fastify 5 + BullMQ + Patchright), `packages/types` (shared TS types), `packages/email-service`, `packages/email-templates`.

### Scan Lifecycle

```
User submits URL on frontend
  → POST /api/scans (Turnstile verified, auth required)
  → scan-service.ts: rate limit check (4/day), 24h domain cache check
  → Insert scan record (status: queued)
  → engineFetch() with HMAC signing → POST /engine/scans
  → Engine enqueues BullMQ job (priority: paid=1 > full=2)
  → Worker picks up (concurrency: 1, lock: 10min, renew: 5min)
  → ModuleRunner.run() executes 5 phases
  → After EACH module: immediate upsert to Supabase (no batching)
  → Calculate MarketingIQ → update scan status to 'complete'
  → Frontend polls via SSE (/api/scans/{id}/stream, 2s interval)
```

### Module Execution Phases (sequential)

1. **Passive** — HTTP-only (M01, M02, M04, M16-M19), `Promise.allSettled` parallel
2. **Browser** — Patchright page (M03, M05-M08, M13-M15, M20), sequential on shared page
   - Stealth profile + patches applied before navigation
   - Google referrer on all navigations (required to avoid bot blocking)
   - Bot wall detection + auto-resolution after navigation
   - 7 parallel data layer snapshots (storage, frames, DOM, cookies, forms, images, links)
   - Failed passive modules retried with browser-rendered HTML
   - Mobile pass: separate context (Pixel 8 viewport, Android-consistent profile)
3. **GhostScan** — Deep interaction (M09-M12), sequential on same page from Phase 2
4. **External** — 3rd-party APIs (M21-M40), `Promise.allSettled` parallel
5. **Synthesis** — AI analysis: M41 parallel, then M42-M45 sequential (dependency chain)

**Synthesis-only mode**: After paid upgrade, `runSynthesisOnly()` loads existing M01-M41 results and runs M42-M45 only.

### Module System

- **Registration**: `registerModuleExecutor(moduleId, executeFn)` — side-effect imports in `server.ts`
- **Execute function**: `(ctx: ModuleContext) => Promise<ModuleResult>`
- **ModuleContext**: url, scanId, tier, html, headers, page, networkCollector, consoleCollector, storageSnapshot, frameSnapshot, domForensics, inlineConfigs, cookieAnalysis, formSnapshot, imageAudit, linkAnalysis, navigatorSnapshot, redirectChain, mobileMetrics, previousResults, spaDetected
- **Signal helpers**: `createSignal()`, `createCheckpoint()`, `infoCheckpoint()`, `booleanHealth()`, `thresholdHealth()`, `detectionCheckpoint()` from `utils/signals.js`
- **Scoring**: `calculateModuleScore(checkpoints)` — weighted sum of health multipliers (excellent=1.0, good=0.85, warning=0.5, critical=0.0, info excluded)

### Error Isolation & Retry Strategy

Module failures **never cascade**. Each module wrapped in `safeExecute()`:

```
for each module:
  for attempt 0..retries:
    if retry: sleep(min(1000 * 2^(attempt-1), 15000))
    result = Promise.race([execute(module), timeout(mod.timeout)])
    if success/partial: break
  if all failed: store error result, continue to next module
```

**Service retries**: Gemini (3x, 2s backoff, retryable: 429/503/rate-limit/Zod errors), DataForSEO (30 concurrent slots, semaphore queue), HTTP fetch (3x, 1s backoff, skip 4xx except 429).

**BullMQ**: 3 attempts at queue level, 30s fixed backoff, stalled detection at 60s.

## Web ↔ Engine Communication

HMAC auth on all engine routes (except `/engine/health`):
- Headers: `x-engine-signature`, `x-engine-timestamp` (milliseconds, NOT seconds)
- Signature: `HMAC-SHA256(${timestamp}.${method}.${url}.${bodyHash})`
- Body hash: `createHmac('sha256', '').update(body).digest('hex')` — HMAC with **empty string** key, NOT `createHash`
- Validation: timing-safe comparison, 30s request age window

## Database

Supabase (PostgreSQL). 8 migrations in `supabase/migrations/`.

**Tables**: scans, module_results, payments, chat_messages, chat_credits, audit_log, email_log, email_suppression_list, email_preferences.

**RLS strategy**:
- `scans`: Users see own + anonymous scans. Anyone can insert (gated by Turnstile). Service role updates.
- `module_results`: Transitive access via scan ownership. CASCADE delete.
- `payments`, `chat_*`: User-only access (auth.uid() = user_id).
- `audit_log`, `email_suppression_list`: Service role only (no RLS).

**Cache pattern**: `scans.cache_source` (self-referential FK) — cached scans point to source scan for module_results. Module results fetched via `scan.cache_source ?? scan.id`.

**Ownership hiding**: Scan not found OR not owned → 404 (never 403, prevents enumeration).

## Auth & Middleware

**Middleware chain** (`apps/web/middleware.ts`):
1. Geo-blocking: IN, PK, CN, RU, PH, NG, BD, VN, KP, IR, MM, KH, LA → HTTP 451
2. Staging gate: `__alphascan_access` cookie, granted via `?access=alphascan2026`
3. Supabase session refresh via `updateSession()`
4. Protected routes (`/report/*`, `/chat/*`, `/history/*`, `/scan/*`) → redirect to `/login?redirect=...`

**Supabase client patterns**:
- `createBrowserClient()` — client components
- `createServerClient()` — API routes/server components (wraps `next/headers cookies()`, silently ignores `setAll` errors in Server Components)
- `createServiceClient()` — webhooks only (bypasses RLS, `persistSession: false`)
- Middleware client — sets cookies on BOTH request AND response (critical for persistence)

## Payment Flow

```
User clicks "Unlock $9.99"
  → POST /api/checkout { product: 'alpha_brief', scanId }
  → Validates ownership, tier, scan status
  → Creates Stripe checkout session (metadata: product, scanId, userId)
  → Redirects to Stripe
  → User pays → Stripe webhook fires
  → POST /api/webhooks/stripe (signature verified)
  → Dedup check (idempotent if already completed)
  → Updates scan tier='paid' (no chat credits — chat sold separately)
  → Triggers synthesis: engineFetch('/engine/scans', { synthesisOnly: true })
  → Sends payment receipt email (fire-and-forget)

Chat activation ($1.00 → 15 credits):
  → POST /api/checkout { product: 'chat_activation', scanId }
  → Validates: paid scan, no existing credits (one-time activation)
  → Stripe checkout → webhook → upserts chat_credits(15)

Chat top-up ($4.99 → 100 credits):
  → POST /api/checkout { product: 'chat_credits', scanId }
  → Validates: paid scan
  → Stripe checkout → webhook → adds 100 to existing credits
```

## Browser Stealth Infrastructure (Engine)

**Stealth profiles** (`stealth-profile.ts`): Internally-consistent fingerprints — UA (Chrome 130-134), viewport (±10px jitter), timezone (geo-aware), WebGL GPU (platform-specific), hardware concurrency/memory. All properties cross-validated.

**Stealth patches** (`stealth-patches.ts`): Applied via `context.addInitScript()`:
- navigator.webdriver removal, realistic PDF plugins, chrome object spoofing
- WebGL renderer/vendor spoofing, canvas fingerprint noise (1-bit flips)
- Error stack trace filtering (removes CDP/DevTools frames)
- Permissions API realistic states, navigator.connection spoofing

**Bot wall detection** (`bot-wall-detector.ts`):
- **Sparse body guard**: `MAX_BODY_FOR_BLOCK=2000` — only flag pages with <2KB visible text (prevents false positives on rich pages with embedded protection)
- Detects: Cloudflare Turnstile/WAF, Akamai, PerimeterX/HUMAN, DataDome, generic WAF
- Auto-resolution: wait (5-15s per provider), then retry with Google referrer, then cookie-clear + re-navigate

**Browser pool** (`browser-pool.ts`):
- Single persistent browser, fresh context per scan
- System Chrome auto-detect via `detectChromeChannel()` (real JA3/JA4 TLS fingerprint)
- `--disable-blink-features=AutomationControlled` (critical)
- Auto-restart on crash (up to 3 attempts)
- Mobile context: Android-consistent profile (NOT desktop transplanted — would be detectable)

## Tier System

- **`full`** (free): Runs all 5 scan phases, shows limited data per module with frosted unlock overlay (bottom 38% of slide card)
- **`paid`**: Same scan data unlocked, synthesis slides (M42-M45), PDF report. Chat sold separately ($1 activation, $4.99 top-up).
- Paid modules: M42 (Executive Brief), M43 (Roadmap), M44 (ROI), M45 (Cost Cutter)
- Internal-only modules (no slide card): M41 (Module Synthesis)
- Chat context assembled lazily from raw module_results per question (no pre-computed knowledge base)

## Web App Structure

- **Route groups**: `(marketing)` (landing/pricing/blog), `(auth)` (login/register/verify), `(dashboard)` (scan/report/chat/history)
- **Scan dashboard**: `components/scan/bento-dashboard.tsx` — Asana-style sidebar (240px fixed) + scrollable 16:9 slide cards
- **Charts**: 26 components in `components/charts/`, config in `lib/chart-config.ts`
- **Fonts**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (data/numbers)
- **Print mode**: `@media print` — landscape, each `.slide-card` = one page, sidebar/topbar hidden
- **PostHog**: Reverse proxy via `/ingest/*` rewrites, client + server SDKs

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/scans` | POST | User + Turnstile | Create scan (rate limited 4/day) |
| `/api/scans/[id]` | GET | User + ownership | Fetch scan with results |
| `/api/scans/[id]/stream` | GET | None (scan ID) | SSE progress polling (2s) |
| `/api/checkout` | POST | User + ownership | Create Stripe checkout session |
| `/api/webhooks/stripe` | POST | Stripe signature | Handle payment completion |
| `/api/webhooks/resend` | POST | Svix signature | Email delivery events |
| `/api/chat/[scanId]` | GET/POST | User + credits | AI chat (Gemini Pro, 10 msg/min, 402 if no activation/credits) |
| `/api/reports/[id]/pdf` | GET | Owner or share token | Generate/fetch PDF report |
| `/api/reports/[id]/share` | POST | Owner + paid | Generate JWT share token (30-day) |
| `/api/auth/send-email` | POST | Internal secret | Supabase email hook (Standard Webhooks) |
| `/api/health` | GET | None | Health check + engine status |

## Key TypeScript Gotchas

- **`noUncheckedIndexedAccess: true`**: `Record<string, X>[key]` returns `X | undefined` — use `!` or `?? fallback`
- **ESM imports**: Engine uses `.js` extensions in imports (compiled to ESM)
- **Recharts**: `ResponsiveContainer` expects `children: ReactElement` not `ReactNode`
- **`unknown && (JSX)`**: Causes TS error — use `!= null &&` instead
- **Double cast**: `as ModuleDataMap[K]` needs `as unknown as ModuleDataMap[K]`
- **Framer Motion**: `useInView` margin expects `MarginType` — cast with `` as `${number}px` ``
- **Build order**: Always build `packages/types` before typechecking engine after adding new types
- **Lazy SDK init**: `getStripe()` / `getResend()` — eager `new Client(key)` crashes Next.js build when env vars missing
- **Route groups**: Cannot have two `page.tsx` at same URL path in different route groups

## Environment Variables

**Web (`apps/web/.env.local`)** — needed locally with `NEXT_PUBLIC_*` stubs for static prerendering:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Engine: `ENGINE_URL`, `ENGINE_HMAC_SECRET`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_ALPHA_BRIEF_PRICE_ID`, `STRIPE_CHAT_ACTIVATION_PRICE_ID`, `STRIPE_CHAT_CREDITS_PRICE_ID`
- PostHog: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=/ingest`
- Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- Gemini: `GOOGLE_AI_API_KEY`
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`
- Internal: `INTERNAL_API_SECRET`, `UNSUBSCRIBE_JWT_SECRET`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`

**Engine (`apps/engine/.env`)** — uses `tsx --env-file=.env` (no dotenv):
- Server: `PORT=3001`, `ENGINE_HMAC_SECRET`
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- Redis: `REDIS_URL`
- APIs: `GOOGLE_AI_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GOOGLE_PSI_API_KEY`
- PostHog: `POSTHOG_API_KEY`, `POSTHOG_HOST`
- Admin: `ADMIN_TOKEN`

## Automated Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to main | Lint → test → build → E2E (5 stages) |
| `deploy-web.yml` | Push to main (web/types changes) | Verify Vercel deployment health |
| `deploy-engine.yml` | Push to main (engine changes) | Docker build → GHCR → DigitalOcean SSH deploy |
| `db-migrate.yml` | Push to main (migrations changes) | `supabase db push` |
| `security.yml` | Weekly + Dockerfile changes | Trivy container scan + npm audit |
| `backup-db.yml` | Weekly Sunday 4AM UTC | `pg_dump` → artifact (30-day retention) |
| `golden-dataset.yml` | Weekly Monday 6AM UTC | AI synthesis regression tests (M41-M45) |
