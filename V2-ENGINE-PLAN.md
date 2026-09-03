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
