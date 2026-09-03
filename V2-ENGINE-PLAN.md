# AlphaScan v2 — Engine Plan (2026-09-02)

Owner: AlphaScan session (`~/AI/MarketingAlphaAudit`). Companion business/funnel plan is owned by the GTM session (`~/AI/GTMCompany`).

Context: AlphaScan was sunset on 2026-05-30 (no revenue). Ian is reviving it as the audit at the top of his own **marketing engineering** services funnel. Two deliverables share one codebase:

1. **Hosted tool** on marketingalphascan.com: 60-second real quick scan (lead magnet) → paid deep audit → priced roadmap → services.
2. **Open-source skill** (SKILL.md + scripts, agent-skills spec for Claude Code / Codex / Cursor), BYOK, extracted from the same rubrics and scripts. Ships after the hosted quick scan works.

All figures below are derived from the code as of commit `9984c3c` and from the engine audit run on 2026-09-02. Cost figures are estimates and must be checked against the current DataForSEO and Gemini price sheets before they go in a plan.

---

## 1. Module cut list

Source of truth: `apps/engine/src/modules/registry.ts` (44 registered modules).

### Kill (delete from code and types)

| Module | Why |
|---|---|
| M44 Impact Scenarios / ROI | Dead code: commented out of the registry, still self-registers an executor, `M44Data` still exported. 333 LOC. |
| M32, M35 | Phantom modules: in `ModuleId` and `CATEGORY_MODULES` and have M41 rubrics, but no implementation. `market_intelligence` scores against modules that cannot exist. |
| M18 Investor Relations | Fires on under 5% of targets, heuristic scraping, hallucination source. |
| M23 Social Sentiment | Uses Google organic SERP, not social. Misleading name and wrong source. |

### Replace or merge

| Module | Action |
|---|---|
| M16 PR, M17 Careers, M19 Support | Collapse into one optional "company signals" module or drop. Heavy page-classification scraping via Cloudflare Browser Rendering, thin output. Not in the quick scan, not in the skill. |
| M13 Carbon | Merge the transfer-size line into M03. |
| M15 Social & Sharing | Merge OG/Twitter meta checks into M04. |
| M10 Accessibility | Replace DOM heuristics with axe-core in the browser phase. Do not ship the current check. |
| M21 Ad Library Recon | Stop scraping Meta Ad Library and Google Ads Transparency with Patchright (180s × 3 attempts, bot walls, screenshots to storage). Take the ad-library URL as optional user input, or use an Apify actor with a key. Not in the skill. |
| M36 Shopping, M37 Reviews | DataForSEO `task_post → tasks_ready → task_get` polled inside a 45s/30s module budget. Move to a proper async step with its own budget. Second wave. |

### Keep

Passive (HTTP only): M01 DNS & security, M02 CMS & infra, M04 metadata & schema, M39 sitemap, M40 attack surface (crt.sh).
Browser: M03 performance (PSI/CrUX), M05 analytics architecture, M07 martech, M08 tag governance, M14 mobile, M20 ecommerce/SaaS, M12 legal & consent, M11 console, M09 behavioral, M06/M06b paid landing.
External (DataForSEO): M22 news, M24–M31 traffic/rank/paid/backlinks, M33 brand search, M34 losing keywords, M38 local pack.
Synthesis: M41, M42, M43, M45, M46.

### Bugs to fix before anything ships

- **Name drift M24/M27/M28.** Registry names, file names, and `MODULE_NAMES` in `m41-module-synthesis.ts` disagree (registry says M27 "Paid Traffic Cost" but the code computes rank; M28 "Top Paid Keywords" computes paid traffic cost). The AI is told a different module name than the UI for at least three modules. Pick one mapping, rename files to match.
- **M06b has no M41 rubric.** Add one to `m41-module-prompts.ts`; today it falls back to the generic instruction.
- **Free tier was a mock.** `TIER_PHASES.full = ['passive', 'browser']` and `FREE_TIER_MODULES = {M02, M07, M20}`. The registry `minimumTier` field is decorative. Delete the mock and replace with the quick scan below.
- **Dead DataForSEO calls.** `getDomainCompetitors` and `getDomainIntersection` have no callers. Remove.
- **M42 persona.** `verdict_headline` is "the Scott Galloway Roast" with "You ARE Galloway" and M46 re-injects it. Rename to a neutral blunt one-liner style with the same rules before the prompts go public.

---

## 2. Runner changes

Today (`modules/runner.ts`): no per-phase timeout, only per-module `Promise.race` + retries with backoff up to 15s. Passive and External run in parallel, Browser and GhostScan run sequentially on one page, then Synthesis runs M41 (39 Gemini Flash calls, concurrency 8) and M42 → M45 → M43 → M46 sequentially with a 3s cooldown. BullMQ: 3 attempts, 30s fixed backoff, worker concurrency 2, lock 10 min.

Changes:

1. **Run Browser ∥ External.** They do not depend on each other except M06 needing the ad URL, which becomes user input. Passive starts first because Browser retries failed passive modules with rendered HTML.
2. **Per-phase budgets** (hard deadline, modules still running are marked `partial`):

   | Phase | Quick scan | Deep audit |
   |---|---|---|
   | Passive | 10s | 20s |
   | Browser | 35s | 120s |
   | External | 15s | 90s |
   | GhostScan | skipped | 90s |
   | Synthesis | 0 (template only) | 120s |
3. **Retries: 1, not 3–5.** Retries are where the wall clock went. DataForSEO modules currently retry 5 times.
4. **Collapse M41.** One structured call per category (8) with raw values inline, instead of one per module (39). Quality-retry stays but capped at one.
5. **Deterministic scan ID + domain cache stays** (`scans.cache_source`), but the cache is an internal cost control, not a product tier.

---

## 3. Quick scan (lead magnet)

Gate: work email + Turnstile. No account. Every submit is a lead; identify in PostHog at submit.

| Module | Source | Cost per scan (est.) | Typical latency |
|---|---|---|---|
| M01 DNS & security | Node dns + curl | $0 | 2–4s |
| M02 CMS & infra | raw HTML | $0 | 1–3s |
| M04 metadata & schema | raw HTML + robots | $0 | 1–3s |
| M03 performance | Google PSI/CrUX (free key) | $0 | 15–30s (the floor) |
| M05 analytics + M08 tag governance | one Patchright page load | $0 | 10–20s |
| M24 rank overview | DataForSEO `domain_rank_overview/live` | ~$0.02–0.05 | 2–5s |
| M31 domain trust | DataForSEO `backlinks/summary/live` | ~$0.02–0.05 | 2–5s |

- **Cost: under $0.10 per scan** in API fees; the only non-zero lines are two DataForSEO live calls. Verify against the current DataForSEO price sheet.
- **Latency: 30–45s expected, 60s hard cap.** PSI sets the floor; everything else runs in parallel with it.
- **No Gemini in the quick scan.** Findings render from checkpoints + `Checkpoint.recommendation` strings (M01 has 47, M04 has 55, M02 has 10). Score = `calculateModuleScore` as today.
- Output: score, 5 headline findings with raw values, "get the deep audit" CTA. This is also the benchmark dataset for content.

---

## 4. Deep audit

All kept modules. Synthesis collapsed to 8 category Flash calls + 4 Pro calls (M42, M43, M45, M46).

| | Today | v2 target |
|---|---|---|
| Gemini calls | ~47 baseline, ~86 worst case | 12 baseline, 20 worst case |
| DataForSEO live calls | ~15 | ~12 (drop M23, M36/M37 async separately) |
| Other APIs | PSI, crt.sh, Cloudflare Browser Rendering | PSI, crt.sh |
| Wall clock | 8–15 min | 3–4 min |
| Cost per scan (est.) | low single-digit dollars, dominated by M41 tokens (16k max output × 39) | under $1: ~$0.30–0.60 DataForSEO + ~$0.20–0.40 Gemini |

Verify Gemini pricing against the current sheet; models today are `gemini-3-flash-preview` and `gemini-3.1-pro-preview` with `gemini-2.5-pro` fallback.

---

## 5. Cited-value finding schema

Root cause of the factuality problem: M41 synthesizes over thin modules (M16–M19, M23) and over data with no provenance, and is told wrong module names. Fix the schema, not the model.

Every finding carries its evidence:

```ts
interface Finding {
  id: string;                 // "M01.dmarc.policy"
  module: ModuleId;
  parameter: string;          // rubric parameter name
  health: 'excellent' | 'good' | 'warning' | 'critical' | 'info';
  claim: string;              // one sentence, plain English
  evidence: {
    raw: unknown;             // the actual value observed
    source: 'dns' | 'http' | 'browser' | 'psi' | 'crux' | 'dataforseo' | 'crt.sh';
    endpoint?: string;        // e.g. "/dataforseo_labs/google/domain_rank_overview/live"
    observedAt: string;       // ISO
  };
  benchmark?: { value: string; citation: string };  // rubric benchmark + URL
  recommendation?: Recommendation;
}
```

Rule for synthesis prompts: a finding without `evidence.raw` cannot be emitted. Rubric benchmarks that state dollar figures (ADA settlements, CPC ranges) get a `citation` or get removed.

---

## 6. Priced roadmap schema

Today the only prescriptive layer is in synthesis: M41 `recommendations[] {action, priority P0–P3, effort S–XL, expected_impact, implementation_steps[]}`, M43 markdown roadmap with p0–p3 counts and `estimatedTimelineWeeks`, M46 `initiatives[]`, `timeline_items[]`, `next_steps[]`. DataForSEO modules emit zero recommendations.

Extend the M41 recommendation shape; M43 and M46 render from it:

```ts
interface Recommendation {
  action: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: 'S' | 'M' | 'L' | 'XL';
  expected_impact: string;
  implementation_steps: string[];
  service_line: 'analytics_tracking' | 'seo_aeo' | 'cro' | 'paid_media' | 'crm_revops' | 'consent_privacy' | 'performance' | 'security';
  scope_size: 'fix' | 'project' | 'program';   // hours → fixed-scope package → retainer
  price_band?: string;                          // filled from pricing table, hosted only
  diy: boolean;                                 // true = skill user can do it alone
}
```

Pricing table keyed by `(service_line, scope_size)` lives in the web app, not the engine. The open-source skill prints the roadmap without `price_band`. Service lines and bands are defined in the GTM session's business plan.

---

## 7. Open-source skill extraction

Package: `packages/skill/` becomes the source of truth; `apps/engine` imports its scripts and rubrics and adds queueing, our keys, identify, report UI, priced roadmap.

| Layer | Contents | Modules |
|---|---|---|
| `SKILL.md` + `reference/rubrics/*.md` | The 41 M41 rubrics (purpose, assessment instructions, 159 parameter criteria, scoring anchors) as markdown. The agent applies them itself; no Gemini. M42/M43/M45/M46 schemas as output templates. | all kept modules |
| `scripts/` no API | dns/headers/TLS, CMS fingerprint (ship `src/data/domains` JSON), metadata/schema/robots, sitemap, crt.sh | M01, M02, M04, M39, M40 |
| `scripts/` browser (Playwright or the agent's browser tool) | network + globals + storage capture, tag governance, martech, ecommerce, mobile viewport, console, consent banner probe, axe-core | M05, M07, M08, M20, M14, M11, M12, M09, M10, M06/M06b (ad URL as input) |
| `scripts/` BYOK API | thin CLI wrappers, one endpoint each: PSI (`GOOGLE_PSI_API_KEY`), DataForSEO (`DATAFORSEO_LOGIN`/`PASSWORD`) | M03, M22, M24–M31, M33, M34, M38; M36/M37 second wave |
| Not in the skill | M16–M19, M23, M21 scraper, M13, M15, M44, M32/M35, Chloé/retro-OS UI | |

Prompt audit for GitHub (done 2026-09-02): the M41 rubrics contain no secrets, customer data, competitor names, or pricing. Only change: the Scott Galloway persona in M42/M46. Chloé's tone lives in the web UI, not the engine.

---

## 8. Revival checklist

1. Restore DB from `~/AlphaScan-Sunset-Backup/alphascan-full-20260530.sql` (58MB, full schema + data) into a fresh Supabase project. Apply the 8 migrations in `supabase/migrations/` only if the dump predates them (it does not; the dump is post-migration).
2. Revert `9984c3c` on `apps/web/middleware.ts` (black page) and restore `deploy-engine.yml`; leave `db-migrate.yml`, `backup-db.yml`, `golden-dataset.yml`, `security.yml` deleted until needed.
3. Re-key: `GOOGLE_AI_API_KEY`, `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`, `RESEND_API_KEY`, `POSTHOG_API_KEY`, `GOOGLE_PSI_API_KEY`. Pull existing Vercel env with `vercel env pull` (project `marketing-alpha-web`) before asking for anything.
4. Engine hosting: the engine needs a persistent Chrome (Patchright, system Chrome channel for real TLS fingerprint) and Redis. Cloudflare Workers cannot run that. Options: a small DigitalOcean or Hetzner box with the existing `docker-compose` (Caddy + engine + Redis), or Cloudflare Browser Rendering for the browser phase with the passive/external phases on Workers. Decide after the quick scan is proven on the existing compose stack; do not re-platform first.
5. Point `marketingalphascan.com` at Vercel (already resolves 200), make it the canonical host, 301 `alphascan.io` to it.
6. Remove the mock free tier, Stripe chat-credit products, and the 4/day rate limit; quick scan is gated by email + Turnstile + per-domain cache.

---

## 9. Order of work

1. Fix bugs in §1 (name drift, M06b rubric, delete M44/M32/M35, persona rename).
2. Runner: parallel Browser ∥ External, per-phase budgets, retries to 1.
3. Quick scan module set + `Finding` schema + rendering from checkpoints.
4. Revival checklist §8 against the existing compose stack; prove a 60s quick scan end to end.
5. Deep audit with collapsed synthesis + `Recommendation` extension.
6. Extract `packages/skill/`; publish once the hosted quick scan is live so the skill points at it.

---

## 10. Exact-match audit domains (gtmtechaudit.com, marketingtechaudit.com)

Goal: win the exact phrases "gtm tech audit", "marketing tech audit", "martech audit" without the two domains cannibalizing each other. One pipeline, one canonical results host, two exact-match front doors.

**Canonical host for results: `marketingalphascan.com`.** Both audit domains are front doors that run the same quick scan and hand the user to a result page on the canonical host. No result page is ever served from an audit domain, so there is one copy of each result in the index.

### Front-door architecture (same template, different keyword, different visual skin)

| | gtmtechaudit.com | marketingtechaudit.com |
|---|---|---|
| H1 | "GTM Tech Audit: see what your go-to-market stack is actually doing" | "Marketing Tech Audit: see what your martech stack is actually doing" |
| Title tag | GTM Tech Audit — free 60-second go-to-market stack audit | Marketing Tech Audit — free 60-second martech audit |
| Primary intent | RevOps / sales-led: CRM, enrichment, routing, intent, attribution | Marketing-led: analytics, tags, consent, SEO/AEO, paid pixels |
| `/` | Scan input + 3 example results + "what a GTM tech audit checks" | Scan input + 3 example results + "what a marketing tech audit checks" |
| `/what-is-a-gtm-tech-audit` / `/what-is-a-marketing-tech-audit` | Definition page, AEO-first: 40-word definition in the first paragraph, FAQ schema, checklist | same |
| `/checklist` | The rubric parameters for that domain's module subset, as a printable checklist | same |
| `/benchmarks` | Aggregate stats from the scan dataset for that domain's module subset (original data) | same |
| `/skill` | Install command for the open-source skill + GitHub link, framed for that keyword | same |
| `/audit/<domain>` | **301 → `marketingalphascan.com/audit/<domain>`** | same |

Visual family: shared type system and components, different accent color and hero illustration per domain, so they read as siblings, not clones. Copy blocks are not duplicated verbatim across the two sites; each definition page is written for its own audience.

### Result pages (programmatic SEO from the dataset)

- URL: `marketingalphascan.com/audit/<domain>` (e.g. `/audit/nike.com`). One page per scanned domain, latest scan, no scan IDs in public URLs. Scan-ID URLs stay private under `/scan/<id>`.
- Indexing policy: `index` only when the scan is complete, the domain has real traffic (DataForSEO rank overview above a threshold), and the page has at least N findings with evidence. Everything else `noindex`. Result pages for domains the owner asks to remove get `noindex` + a 410 after 30 days.
- Public result page shows the quick-scan layer only (score, headline findings with raw values, stack detected). Deep-audit output is never public.
- Canonical: self. Both audit domains 301 into it, so link equity from either front door lands on the same result page.
- Schema on result pages: `WebPage` + `Dataset` (the scan as a dataset with `dateModified`) + `BreadcrumbList`. On the front doors: `WebSite` with `SearchAction` (the scan input), `FAQPage` on the definition pages, `HowTo` on the checklist pages, `SoftwareApplication` on `/skill`.
- Result pages link back to the front door that matches their strongest category (GTM-heavy findings → gtmtechaudit.com, martech-heavy → marketingtechaudit.com) with exact-match anchor text.

### Skill README links

The GitHub README links, in this order, with exact-match anchors: "run a marketing tech audit" → marketingtechaudit.com, "run a GTM tech audit" → gtmtechaudit.com, "hosted version" → marketingalphascan.com. The brand site (themarketingengineeringcompany.com) is linked once in the footer of every property, not from the README, so the audit domains collect the GitHub equity.

### Sitemaps and robots

Each host has its own sitemap: front doors list their 5 static pages; the canonical host lists `/audit/<domain>` pages that pass the index policy, regenerated daily. `robots.txt` on the audit domains disallows `/audit/` (they only redirect) so crawlers do not waste budget on redirects.

---

## 11. AI-SEO (AEO/GEO) audit module set

Added 2026-09-02 after Ian's ask for an AI-search audit sold from its own site. Comps he named: tryres.ai (advisory $10k/mo, done-for-you $100k, "service not software", proof = 75% citation rate in 6 weeks over 76 pages) and usereach.ai (platform + managed service, B2B SaaS $1M+ ARR, 3-month minimum). Same rule as the rest of v2: assemble, don't build. Every figure below is from vendor pages read on 2026-09-02 and must be re-checked against price sheets before it goes in a proposal.

### 11.1 Components

| Component | Role | What we verified | Cost basis |
|---|---|---|---|
| **Elmo** (github.com/elmohq/elmo, MIT) | Tracker backend and the monthly-retainer artifact. TypeScript, TanStack Start, PostgreSQL, pg-boss worker, Docker Compose, `@elmohq/cli`. Tracks ChatGPT, Google AI Mode, AI Overviews, Gemini, Perplexity, Copilot, Claude, Grok, Mistral. | REST API at `/api/v1`, Bearer auth: Brands, Prompts, Competitors, Snapshots, Reports, Analytics (visibility, share of voice, citations, per-model, query fan-out), Runs (retrieve). Also an MCP server. **A background worker runs prompts on a schedule "several times a day"; the docs do not show an on-demand run endpoint.** Since we self-host, the per-scan trigger is either the CLI, a direct pg-boss job insert, or a short schedule on a brand created for the scan. Verify in `apps/` before committing to it. | Self-hosted free. Cloud from $29/mo. Engine costs are pass-through to the provider you configure (below). |
| **Provider layer inside Elmo** | Who actually answers the prompt. | Elmo's providers guide lists per-prompt scraper costs for real consumer surfaces: Oxylabs ~$0.15, BrightData ~$0.45, Cloro ~$0.65, DataForSEO ~$1.20, Olostep ~$2.25. Direct model APIs (OpenAI, Anthropic, OpenRouter) with web search cost pennies per prompt. | Two modes below. |
| **DataForSEO AI Optimization** | Cheapest structured source for engine answers and AI Overview presence. | LLM Responses (ChatGPT, Claude, Gemini, Perplexity): $0.0006 base + the model's token cost, `web_search` billed extra, Perplexity Sonar always searches. LLM Scraper (ChatGPT, Gemini real UI): $0.004/page live, $0.0012 standard queue. LLM Mentions: $0.001/row. AI Keyword Data: $0.0001/keyword. AI Overview presence: SERP endpoint with `load_async_ai_overview`. | Roughly $0.01–0.05 per prompt-engine with web search on model APIs. |
| **Olostep** | Crawl the client site as an AI fetcher would; `/answers` for "what does the web say about X" with sources. | Scrape 1 credit, LLM extraction 20 credits, Answers 20 credits (~$0.05 pay-per-use, billed only on success, 3–30s). Plans: free 500 credits, $9/5k, $99/200k, $399/1M. JS rendering + residential IPs on every request; no documented toggle to fetch *without* JS, so the "non-JS fetcher" check stays on our own curl script. | A 200-page crawl ≈ 200 credits ≈ $0.10–0.40. |

**Engine modes.** *Model-API mode* (default for the audit and the quick-scan hook): DataForSEO LLM Responses or direct OpenAI/Anthropic/OpenRouter with web search, plus DataForSEO SERP for AI Overviews. Cheap, fast, auditable, but it is the model's API answer, not the consumer app's answer. *Consumer-surface mode* (deep audit upgrade and the retainer baseline): Elmo with Oxylabs scraping the real ChatGPT/AI Mode/Perplexity/Copilot UIs at ~$0.15/prompt. Report which mode produced each finding in `evidence.source`.

### 11.2 Modules

All emit the §5 `Finding` schema (raw value + source per finding) and §6 `Recommendation` objects. Add `ai_search` as its own `service_line`; it is the product being sold here and mixing it into `seo_aeo` hides it in the roadmap.

| ID | Name | Source | What it checks | Raw values kept |
|---|---|---|---|---|
| M50 | AI-bot crawlability | Our curl scripts + robots parser (no vendor) | robots.txt allow/deny for GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Bingbot, Applebot-Extended, CCBot, Bytespider; `llms.txt` and `llms-full.txt` presence and validity; HTTP response for a non-JS fetch of the top 20 URLs (status, bytes of visible text vs rendered, `noindex`, `nosnippet`, `max-snippet`); CDN/WAF challenges served to bot UAs. | per-UA robots verdict, text-bytes no-JS vs rendered, status per URL |
| M51 | Citation-readiness of pages | Olostep crawl (markdown) of the 20–50 highest-value pages (from M26 rank data + sitemap) + our parser | Answer-first paragraph (a 40–60 word direct answer in the first 150 words), question-form H2/H3, FAQPage/HowTo/Article/Organization/Person schema, author + byline + entity links (sameAs), `dateModified` freshness, table/list density, internal definitions, word count, duplicate title/H1. | per-page boolean/score per criterion |
| M52 | Buyer prompt set | Gemini/Claude over ICP inputs (industry, product, competitors, M04 metadata, M26 keywords) + DataForSEO AI Keyword Data for volume | Generates 30 prompts (quick scan: 3) in the shapes buyers use: "best X for Y", "X vs Y", "how do I…", "is X worth it", "alternatives to X". Stored as the **prompt-set artifact** the retainer keeps tracking in Elmo. | prompt, intent class, AI search volume |
| M53 | Brand presence per engine | Model-API mode by default; consumer-surface mode as upgrade | For each prompt × engine: brand mentioned (y/n, position), brand URL cited (y/n, which URL), answer excerpt about the brand. | full answer text, mentions, citations, engine, mode, timestamp |
| M54 | Share of voice vs competitors | Same runs as M53, 3 competitors from M29 or user input | Mention rate and citation rate per competitor per engine; leaderboard. | counts per competitor per engine |
| M55 | Category source map | Same runs as M53; aggregate all cited URLs | Which third-party domains engines cite in this category (review sites, directories, publications, Reddit, YouTube), ranked by frequency. This is the "get listed there" list, and the most sellable deliverable. | domain, citation count, engines, example prompts |
| M56 | Brand description accuracy and sentiment | Same runs as M53 + one Flash call per engine | What engines say the company does, pricing, location, positioning; diff against M04/M02 facts; sentiment. Flags hallucinated facts about the client. | quoted claims, mismatch list, sentiment score |
| M57 | AI Overview presence on ranking keywords | DataForSEO SERP with `load_async_ai_overview` on the top 30 keywords from M26 | Does an AI Overview appear, is the client cited in it, who is. | per keyword: overview present, cited domains, client cited |

Cut from scope on purpose: building our own scraper for any consumer surface (that is what the providers are for), and tracking over time inside our engine (that is Elmo's job; the audit writes the prompt set into an Elmo brand and the retainer reads Elmo snapshots).

### 11.3 Cost and latency

**Deep AI-SEO audit, 30 prompts × 5 engines (ChatGPT, Perplexity, Gemini, Claude, AI Overviews):**

| Line | Model-API mode | Consumer-surface mode (Oxylabs via Elmo) |
|---|---|---|
| M53–M56 answers, 150 prompt-engine pairs | ~$2–7 (token + web-search fees; Perplexity and OpenAI web search are the expensive ones) | ~$22 (150 × ~$0.15) + AI Overviews via SERP ~$0.10 |
| M57 AI Overviews, 30 SERPs | ~$0.10 | same |
| M51 Olostep crawl, 50 pages | ~$0.05–0.10 | same |
| M52 prompt generation + AI keyword volume | ~$0.05 | same |
| M50 crawlability | $0 | $0 |
| **Total** | **~$3–8** | **~$25** |
| Wall clock | 3–5 min (LLM Responses live up to 120s each, run 8–10 in parallel) | 10–30 min (scraper queues); run async, notify when done |

Compare to tryres.ai's $10k/mo advisory: API cost is noise. Price on the deliverable (source map + prompt set + roadmap), not on cost.

**Quick-scan hook (M52 + M53, 3 prompts × 1 engine):** direct OpenAI Responses API with web search, or DataForSEO LLM Responses ChatGPT with `web_search: true`. Cost ~$0.05–0.15, latency 5–20s in parallel with PSI, so it fits inside the 60s cap. Output: "ChatGPT was asked 3 buyer questions about your category; you were mentioned in N and cited in M; here is who was." That single line is the hook for the AI-SEO site.

### 11.4 Where it lives

- Engine: `modules/ai-search/` M50–M57, one external phase alongside DataForSEO modules. M53–M56 share one run so answers are fetched once.
- Elmo: self-hosted on the same box as the engine (Docker Compose, its own Postgres). The audit creates a brand + prompts + competitors through `/api/v1`; the retainer reads Snapshots and Reports monthly. Provider keys are ours in hosted mode, the user's in the skill (BYOK: `OPENAI_API_KEY` / `OPENROUTER_API_KEY`, `DATAFORSEO_LOGIN`/`PASSWORD`, `OLOSTEP_API_KEY`, optional `OXYLABS_*`).
- Skill: M50 and M51 ship as scripts with no key; M52–M57 as BYOK wrappers. The prompt-set artifact is a plain JSON file the user can load into their own Elmo.
- Open question to verify in the Elmo code before building: on-demand run trigger, and whether `Runs` exposes raw answer text per engine (needed for M56) or only aggregates.

### 11.5 Schema corrections from the competitor read (2026-09-03)

Source: the GTM session read tryres.ai (Resonance AI Technology, LLC), wearepiro.com, and usereach.ai in Ian's browser. Their deliverables are all keyed by **channel** and end in an **actions table**. The schemas below are what the report UI will render against.

**Channel enum** (used by M52, M55, M56, and `Recommendation`):

```ts
type Channel =
  | 'reddit' | 'youtube' | 'review_sites'   // G2, Capterra, Trustpilot, Google reviews
  | 'publishers' | 'comparison_pages'       // listicles, "best X" roundups, alternatives pages
  | 'linkedin' | 'owned_web' | 'docs_help'  // the brand's own site and help center
  | 'forums_qa' | 'wikipedia_reference' | 'other';
```

**M55 Category source map** now emits one row per `(domain, channel)`:

```ts
interface SourceRow {
  domain: string;                 // e.g. "reddit.com", "g2.com", "politico.com"
  channel: Channel;
  citation_count: number;         // across all prompt × engine runs
  engines: EngineId[];            // which engines cited it
  example_prompts: string[];      // up to 3
  urls: string[];                 // top cited URLs on that domain
  volume_proxy?: number;          // DataForSEO backlinks/summary rank or referring domains for the cited domain; Reddit/YouTube: thread/video view count when available via Olostep scrape
  client_present: boolean;        // does the client already appear on this domain
  competitors_present: string[];  // which of the 3 competitors appear
}
```

**M56 Description accuracy and sentiment** becomes per-topic, not a flag:

```ts
interface TopicSentiment {
  topic: string;                  // e.g. "alert noise", "pricing", "support responsiveness"
  positive_count: number;         // mentions across runs
  negative_count: number;
  neutral_count: number;
  channels: Channel[];            // where the topic surfaces in cited sources
  example_quotes: { text: string; engine: EngineId; source_url?: string }[];
  factual_mismatch?: string;      // when the claim contradicts M04/M02 facts
}
interface M56Data {
  brand_sentiment_pct: number;                       // positive / (positive + negative)
  competitor_sentiment_pct: Record<string, number>;  // same for the 3 competitors
  topics: TopicSentiment[];                          // the "sentiment drivers" list
  description_claims: { claim: string; verdict: 'accurate' | 'outdated' | 'wrong'; evidence: string }[];
}
```

**M52 Buyer prompt set** accepts optional research inputs and records provenance:

```ts
interface M52Inputs {
  icp: string;                    // required
  competitors: string[];          // up to 3
  reddit_urls?: string[];         // threads to mine questions from (Olostep scrape)
  review_urls?: string[];         // G2/Capterra/Trustpilot pages
  transcripts?: string[];         // sales-call or support transcripts, pasted text
  seed_keywords?: string[];       // from M26 rank data by default
}
interface PromptRow {
  prompt: string;
  intent: 'best_for' | 'comparison' | 'how_to' | 'is_it_worth' | 'alternatives' | 'problem' | 'emerging';
  origin: 'icp' | 'reddit' | 'reviews' | 'transcript' | 'keywords' | 'generated';   // "emerging" + "generated" = questions nobody is asking yet
  source_url?: string;
  ai_search_volume?: number;      // DataForSEO AI Keyword Data
}
```

**`Recommendation` extension** (adds to §6; `service_line` stays):

```ts
interface Recommendation {
  // …§6 fields…
  channel: Channel;
  action_type: 'answer_thread' | 'publish_page' | 'earn_mention' | 'sponsor' | 'fix_technical' | 'update_listing' | 'correct_claim';
  target_url?: string;            // the thread, listing, or page to act on
  volume_proxy?: number;          // carried from the SourceRow that motivated it
  sentiment_context?: 'positive' | 'negative' | 'mixed';
  evidence_ids: string[];         // Finding ids that justify the action
}
```

Report rendering contract: the actions table is `DESCRIPTION / CHANNEL / VOL / SENTIMENT / ACTION` straight from `Recommendation`; the executive summary table is `VERDICT / CHANNEL / VOL / SENTIMENT` grouped from `SourceRow` + `TopicSentiment`; the "sentiment vs competitors over time" chart comes from Elmo snapshots after the first run and from a single M56 point on the first audit.

Engine implications: M55 needs a domain→channel classifier (rule table for the top 200 domains, fallback to a Flash call), M56 needs one Flash call per engine over the full answer set to extract topics, and M52 needs Olostep scrapes for any Reddit/review URLs supplied. Cost delta on the deep audit: under $0.50.
