
### 10.1 Programmatic /compare and /alternatives layer per door

Added 2026-09-03 from the make.design case (GTM session's reverse-engineering; founder's own words: "tbh its more about the domain"). Registered 2026-05-30, launched 06-23, #1 for its exact phrase by 07-23 with ~340 pages: ~300 `/compare/x-vs-y` across 25 tools, 25 `/alternatives/`, 2 `/tools/`, 10 blog. One ~850-word template, `Article` + `BreadcrumbList` + `FAQPage` on every programmatic page, `Organization` + `WebSite(SearchAction)` + `SoftwareApplication(offers)` on home, hub↔sibling internal links, no sitemap, no directories or press.

**Source of the vendor list: the engine already knows the vendors.** `apps/engine/src/data/fingerprints.json` has 44 CMS/infra fingerprints (id, name, category, rules) and `utils/third-party-profiler.ts` classifies ~70 third-party tools by category (advertising 17, martech 15, analytics 15, cdn 10, font 5, tag_manager 4, social 4). Add a `vendors.json` in `packages/skill/data/` that merges both with the fields the pages need: `id, name, category, vendor_url, pricing_model, best_for, replaces[], door` and generate from it.

| | gtmtechaudit.com | marketingtechaudit.com |
|---|---|---|
| Vendor set (door) | sales intelligence, enrichment, CRM, intent, outbound, RevOps: ZoomInfo, Apollo, Clay, Cognism, Lusha, Salesforce, HubSpot, Pipedrive, 6sense, Bombora, Warmly, RB2B, Lemlist, Outreach, Salesloft, Gong, Marketo, Pardot | analytics, tags, consent, SEO, CRO, paid: GA4, PostHog, Mixpanel, Amplitude, GTM, server-side GTM, Segment, OneTrust, Cookiebot, Usercentrics, Semrush, Ahrefs, Hotjar, Clarity, Optimizely, VWO, Meta CAPI, Klaviyo, Mailchimp |
| `/compare/<a>-vs-<b>` | every pair within the set, ~150–300 pages | every pair within the set, ~150–300 pages |
| `/alternatives/<a>` | one per vendor | one per vendor |
| `/tools/<a>` | one per vendor: what it is, what the audit detects about it, common misconfigurations (from the module rubrics) | same |
| Template | ~850 words: 40–60 word answer capsule, comparison table (Res: 88% of top-cited B2B pages), "which one the audit finds on sites like yours" section pulling **aggregate detection rates from the scan dataset** (original data, refreshed weekly), FAQ (5 Q/A), CTA into the scan | same |
| Schema | `Article` + `BreadcrumbList` + `FAQPage` per page; `Organization` + `WebSite(SearchAction)` + `SoftwareApplication(offers)` on home | same |
| Links | hub (`/tools/<a>`) ↔ every sibling compare/alternatives page for that vendor; each programmatic page links back to the door's H1 page with the exact-match anchor | same |
| Not shared across doors | a vendor appears on one door only; ZoomInfo pages live on gtmtechaudit.com, GA4 pages on marketingtechaudit.com; cross-links between doors only from `/tools/` pages where the vendor genuinely spans both (HubSpot, Salesforce) | |

**Engine hooks.** Detection rates per vendor come from the quick-scan dataset (`module_results` for M02/M05/M07/M08 grouped by detected tool), exposed as one aggregate endpoint the site builds from; this is the same data that feeds `/benchmarks`. The `evidence.raw` on every quick-scan finding means each "X% of sites we scanned run GA4 without consent mode" line has a count behind it. The listicle format is a negative for AI citation (§11.6), so `/alternatives/` pages are written as a comparison table + verdict, not a ranked list.

**Skill hook.** `vendors.json` ships in the skill so the OSS detection uses the same vendor names as the site; every vendor id in a finding links to `/tools/<id>` on the matching door. That is how GitHub traffic lands on the exact-match domains without a single marketing link.
