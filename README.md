<div align="center">

# MarketingAlphaScan

**Forensic marketing intelligence delivered in 90 seconds.**

[![CI](https://github.com/iancarlospr/mas/actions/workflows/ci.yml/badge.svg)](https://github.com/iancarlospr/mas/actions)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)

[marketingalphascan.com](https://marketingalphascan.com)

</div>

---

## What is MarketingAlphaScan?

MarketingAlphaScan runs a full-spectrum marketing technology audit against any website. Enter a URL, and 90 seconds later you get a forensic analysis across **46 specialized modules** spanning analytics integrity, paid media attribution, performance, compliance, MarTech efficiency, SEO, competitive intelligence, and digital presence.

This is not a Lighthouse wrapper. Each module is a self-contained analysis engine with its own scoring logic, typed data contracts, and failure isolation. A timeout in one module never affects another. The scan always completes with the maximum intelligence it could gather.

## What It Covers

| Category | What It Examines |
|----------|-----------------|
| **Analytics Integrity** | Measurement ID validation, data layer quality, tag governance, behavioral tracking |
| **Paid Media Attribution** | Pixel health across platforms, click ID persistence, landing page alignment, CAPI detection |
| **Performance and UX** | Core Web Vitals, resource analysis, carbon footprint, mobile parity |
| **Compliance and Security** | DNS security (DMARC/SPF/DKIM), WCAG 2.1 AA checks, consent management, legal pages |
| **MarTech Efficiency** | Tool inventory, redundancy detection, form analytics, SaaS/ecommerce signals |
| **SEO and Content** | Page metadata, social sharing, PR coverage, keyword gaps, sitemap health |
| **Market Position** | Traffic estimates, competitor analysis, domain authority, paid spend, local SEO |
| **Digital Presence** | CMS detection, careers pages, investor relations, support infrastructure, brand sentiment |

These 8 categories are weighted into a composite **MarketingIQ** score (0-100) with traffic-light grading per module.

## How Results Are Presented

Results render as a McKinsey-style **slide deck**, not a wall of data tables. Each module is a 16:9 slide card with a header bar, scored checkpoints, and detailed evidence. An Asana-style sidebar provides navigation with scroll sync. Print mode renders each card as one landscape page.

The free tier shows module scores, checkpoint health levels, and detected tools. Upgrading unlocks full evidence, actionable recommendations, an AI-generated executive brief, ROI projections, a prioritized remediation roadmap, and a cost-cutter analysis.

## Repository Structure

This is a monorepo with two applications and shared packages:

```
apps/web/       Web application (dashboard, auth, checkout, reports)
apps/engine/    Scan engine (module execution, browser automation, AI synthesis)
packages/       Shared TypeScript types, email service, email templates
supabase/       Database migrations
e2e/            End-to-end tests
```

## Development

### Prerequisites

- Node.js >= 20
- npm >= 10.8.0
- Docker (Redis)
- Supabase CLI

### Setup

```bash
npm install
npm run dev          # web on :3000, engine on :3001
```

### Commands

```bash
npm run build        # Build all workspaces
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint all workspaces
npm test             # Unit tests
npm run test:e2e     # End-to-end tests
```

Refer to `CLAUDE.md` for detailed architecture documentation, environment configuration, and deployment procedures.

## Contributing

This is a private repository. See `CLAUDE.md` for architectural context and development conventions.

---

<div align="center">

[marketingalphascan.com](https://marketingalphascan.com)

</div>
