# URL Auditor - Product Requirements Document & Implementation Plan

> **Version**: 1.0  
> **Date**: February 2, 2026  
> **Author**: Principal Engineer  
> **Status**: Pending Approval

---

## Executive Summary

The **URL Auditor** is a forensic digital maturity assessment platform that exposes the "Digital Maturity Gap" in enterprise organizations. Unlike superficial SEO scanners, this tool audits the **Operational**, **Financial**, and **Compliance** integrity of a company's digital revenue engine through "active investigation"—behaving like a user to trigger silent failures, data leaks, and revenue blockers.

### Key Differentiators
- **21 comprehensive audit modules** across 3 layers (Stack, Revenue, Compliance)
- **Active poking**: Form fuzzing, consent banner testing, AdBlocker simulation
- **AI-powered insights**: Gemini 2.5 translates technical errors into VP-level business impact
- **McKinsey-quality deliverables**: Executive dashboard + printable PDF reports
- **Competitive leaderboard**: Time-series scoring with industry filtering

### Target Outcome
A portfolio piece demonstrating Principal Engineer-level system design to secure a Revenue Operations Manager position at a major Puerto Rico bank or healthcare organization.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Tech Stack Specification](#2-tech-stack-specification)
3. [Module Dependency Graph & Execution Strategy](#3-module-dependency-graph--execution-strategy)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Data Models](#6-data-models)
7. [API Contracts](#7-api-contracts)
8. [The 21 Audit Modules](#8-the-21-audit-modules)
9. [Report Generation System](#9-report-generation-system)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Implementation Phases](#11-implementation-phases)
12. [Verification Plan](#12-verification-plan)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  Next.js 14+ (App Router) │ shadcn/ui + Tremor │ TanStack Query             │
│  ────────────────────────────────────────────────────────────────────────── │
│  Pages: Landing │ Audit Dashboard │ Report Viewer │ Leaderboard │ Auth      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ REST API + WebSocket (scan progress)
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  FastAPI (Python 3.12+) │ Pydantic v2 │ Supabase Auth (JWT)                 │
│  ────────────────────────────────────────────────────────────────────────── │
│  Endpoints: /audit │ /report │ /leaderboard │ /auth │ /webhook              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────┐
│      ORCHESTRATION ENGINE     │     │           DATA LAYER                   │
│  Prefect 2.0 (Workflows)      │     │  PostgreSQL + TimescaleDB (Supabase)  │
│  ─────────────────────────────│     │  Redis (Upstash) - Status Cache       │
│  21 Module DAG                │     │  Cloudflare R2 - Screenshots/PDFs     │
│  Waterfall + Parallel Hybrid  │     │  Drizzle ORM (Type-safe queries)      │
└───────────────────────────────┘     └───────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCANNER ENGINE                                     │
│  Playwright (Headless Chromium) │ Flight Recorder Listeners                 │
│  ────────────────────────────────────────────────────────────────────────── │
│  Captures: Console │ Network │ Cookies │ LocalStorage │ A11y Tree           │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTELLIGENCE LAYER                                   │
│  Gemini 2.5 Flash (per-module) │ Gemini 2.5 Pro (vision + synthesis)        │
│  ────────────────────────────────────────────────────────────────────────── │
│  Structured JSON prompts │ Cumulative context │ VP-level translation        │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPORT GENERATOR                                     │
│  React-PDF │ McKinsey slide templates │ Traffic light system                │
│  ────────────────────────────────────────────────────────────────────────── │
│  Output: HTML Dashboard │ PDF (A4 Landscape) │ JSON Export                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack Specification

### 2.1 Frontend Stack

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Framework** | Next.js (App Router) | 14.x | SSG for SEO, RSC for performance |
| **Language** | TypeScript | 5.x | Type safety, IDE support |
| **UI Components** | shadcn/ui | Latest | Accessible, customizable |
| **Charts** | Tremor | 3.x | Financial-grade charts |
| **Styling** | Tailwind CSS | 3.x | Utility-first |
| **State** | TanStack Query | 5.x | Server state, polling |
| **Animations** | Framer Motion | 11.x | Premium micro-interactions |
| **PDF** | React-PDF | 3.x | Server-side PDF |

### 2.2 Backend Stack

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Framework** | FastAPI | 0.110+ | Async-native, auto-docs |
| **Language** | Python | 3.12+ | Modern typing |
| **Validation** | Pydantic | 2.x | Strict schemas |
| **Orchestration** | Prefect | 2.x | Visual DAG, retries |
| **Browser** | Playwright | 1.41+ | Console/network interception |
| **ORM** | Drizzle ORM | Latest | Type-safe PostgreSQL |

### 2.3 Data Layer

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Primary DB** | PostgreSQL (Supabase) | Relational data, RLS |
| **Time-Series** | TimescaleDB | Score history |
| **Cache** | Redis (Upstash) | Scan status |
| **Storage** | Cloudflare R2 | Screenshots, PDFs |

### 2.4 Intelligence Layer

| Component | Technology | Use Case |
|-----------|------------|----------|
| **Per-Module** | Gemini 2.5 Flash | Fast, cheap analysis |
| **Vision** | Gemini 2.5 Pro | Ad creative analysis |
| **Synthesis** | Gemini 2.5 Pro | Executive summary |

### 2.5 Infrastructure

| Component | Technology |
|-----------|------------|
| **Containers** | Docker |
| **Compute** | Google Cloud Run |
| **CI/CD** | GitHub Actions |
| **Auth** | Supabase Auth |
| **Secrets** | Google Cloud Secret Manager |
| **Errors** | Sentry |
| **Email** | Cloudflare Email Workers |

---

## 3. Module Dependency Graph & Execution Strategy

### 3.1 Consolidated 21 Module List

| # | Module Name | Category | Execution | Dependencies |
|---|-------------|----------|-----------|--------------|
| 1 | DNS & Security Baseline | Foundation | Parallel | None |
| 2 | CMS & Infrastructure ID | Foundation | Parallel | None |
| 3 | Analytics Architecture | Stack | Parallel | M1 |
| 4 | Paid Media Pixels | Stack | Parallel | M1 |
| 5 | MarTech Orchestration | Stack | Parallel | M1 |
| 6 | Tag Governance | Stack | Parallel | M1 |
| 7 | Behavioral Tools (CRO) | Stack | Parallel | M1 |
| 8 | Accessibility Overlay | Stack | Parallel | M1 |
| 9 | Flight Recorder | Active | Waterfall Start | M1-M8 |
| 10 | Cookie Consent Compliance | Active | Waterfall | M9 |
| 11 | PII & Data Leak Sniffer | Active | Waterfall | M9, M10 |
| 12 | Dependency Stress Test | Active | Waterfall | M9 |
| 13 | Form Fuzzer (Lead Capture) | Active | Waterfall | M9, M5 |
| 14 | Response Protocol (Email) | Active | Waterfall | M13 |
| 15 | Core Web Vitals | Performance | Parallel | M1 |
| 16 | SEO Technical Health | Performance | Parallel | M1 |
| 17 | Mobile Responsiveness | Performance | Parallel | M1 |
| 18 | Redirect Chain Analysis | Performance | Parallel | M1 |
| 19 | Ad Library & Creatives | External Intel | Parallel | M1 |
| 20 | Sentiment & Reputation | External Intel | Parallel | M1 |
| 21 | Market Intelligence | External Intel | Parallel | M1 |

### 3.2 Prefect DAG Flow

```python
@flow(name="url_audit")
async def audit_url(url: str, audit_id: str):
    # Phase 1: Foundation (Parallel)
    foundation_results = await asyncio.gather(
        dns_security_baseline(url),
        cms_infrastructure_id(url),
    )
    
    # Phase 2: Stack Inventory (Parallel)
    stack_results = await asyncio.gather(
        analytics_architecture(url, foundation_results),
        paid_media_pixels(url, foundation_results),
        martech_orchestration(url, foundation_results),
        tag_governance(url, foundation_results),
        behavioral_tools(url, foundation_results),
        accessibility_overlay(url, foundation_results),
    )
    
    # Phase 3: Active Investigation (Waterfall)
    flight_data = await flight_recorder(url, stack_results)
    consent_data = await cookie_consent(url, flight_data)
    pii_data = await pii_sniffer(url, flight_data, consent_data)
    stress_data = await dependency_stress(url, flight_data)
    form_data = await form_fuzzer(url, flight_data, stack_results)
    email_data = await response_protocol(url, form_data)
    
    # Phase 4: Performance (Parallel)
    perf_results = await asyncio.gather(
        core_web_vitals(url),
        seo_health(url),
        mobile_responsive(url),
        redirect_chains(url),
    )
    
    # Phase 5: External Intel (Parallel)
    intel_results = await asyncio.gather(
        ad_library_recon(url),
        sentiment_reputation(url),
        market_intelligence(url),
    )
    
    # Phase 6: Synthesis
    final_report = await ai_synthesis(all_findings)
    return final_report
```

---

## 4. Backend Architecture

### 4.1 Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app entry
│   ├── config.py                   # Settings via Pydantic
│   ├── api/v1/
│   │   ├── router.py
│   │   ├── audit.py
│   │   ├── report.py
│   │   ├── leaderboard.py
│   │   └── webhooks.py
│   ├── modules/                    # The 21 Audit Modules
│   │   ├── base.py                 # ModuleBase abstract class
│   │   ├── m01_dns_security.py
│   │   ├── m02_cms_infrastructure.py
│   │   └── ... (m03-m21)
│   ├── scanner/
│   │   ├── browser.py              # Playwright manager
│   │   └── flight_recorder.py      # Console/Network listeners
│   ├── ai/
│   │   ├── gemini_client.py
│   │   └── prompts/
│   └── flows/
│       └── audit_flow.py           # Prefect orchestration
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

### 4.2 Module Base Class

```python
class Severity(str, Enum):
    CRITICAL = "critical"  # 🔴 -5 points
    WARNING = "warning"    # 🟡 -1 point
    PASS = "pass"          # 🟢 0 points

class Finding(BaseModel):
    title: str
    severity: Severity
    technical_detail: str
    business_impact: str
    recommendation: str
    evidence: Optional[dict] = None
    score_impact: int

class ModuleResult(BaseModel):
    module_id: str
    module_name: str
    execution_time_ms: int
    success: bool
    findings: List[Finding]
    raw_data: dict
    ai_summary: str
    context_for_next: dict

class ModuleBase(ABC):
    @abstractmethod
    async def execute(self, url: str, browser_context, prior_context: dict) -> ModuleResult:
        pass
    
    @abstractmethod
    def get_ai_prompt(self, raw_data: dict) -> str:
        pass
```

---

## 5. Frontend Architecture

### 5.1 Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── dashboard/
│   │   │   ├── page.tsx            # New audit form
│   │   │   └── [auditId]/
│   │   │       ├── page.tsx        # Audit progress/results
│   │   │       └── report/page.tsx # Full report view
│   │   └── leaderboard/page.tsx    # Public leaderboard (SSG)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── audit/
│   │   ├── report/
│   │   └── leaderboard/
│   ├── hooks/
│   └── lib/
├── tailwind.config.ts
└── next.config.mjs
```

---

## 6. Data Models

### 6.1 PostgreSQL Tables (Drizzle ORM)

```typescript
// Users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  auditQuota: integer("audit_quota").default(1),
});

// Audits
export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  url: text("url").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  overallScore: integer("overall_score"),
  grade: varchar("grade", { length: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
});

// Module Results
export const moduleResults = pgTable("module_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id").references(() => audits.id).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  findings: jsonb("findings"),
  rawData: jsonb("raw_data"),
  contextForNext: jsonb("context_for_next"),
});

// Leaderboard (TimescaleDB Hypertable)
export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id").references(() => audits.id).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  score: integer("score").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});
```

### 6.2 Redis Keys

```
audit:{audit_id}:status  → Hash (status, currentModule, progress)
ratelimit:{user_id}:daily → Counter (TTL 24h)
email:{unique_id} → Hash (sent/received timestamps)
```

---

## 7. API Contracts

### POST /api/v1/audit
```typescript
// Request
{ url: string; industry?: string; }

// Response 201
{ id: string; status: "pending"; createdAt: string; expiresAt: string; }
```

### GET /api/v1/audit/{auditId}
```typescript
// Response 200 (Completed)
{
  id: string;
  url: string;
  status: "completed";
  score: { overall: 72; grade: "C"; criticalCount: 2; warningCount: 8; };
  executiveSummary: string;
  modules: ModuleResult[];
}
```

### GET /api/v1/leaderboard
```typescript
// Response 200
{
  entries: [{ rank: 1; domain: "oriental.com"; score: 92; grade: "A"; trend: "up"; }];
  total: number;
  industries: string[];
}
```

---

## 8. The 21 Audit Modules

### FOUNDATION (Phase 1 - Parallel)

**M01: DNS & Security Baseline** - SSL/TLS, SPF/DKIM/DMARC, security headers
**M02: CMS & Infrastructure ID** - CMS detection, version exposure, CDN

### STACK INVENTORY (Phase 2 - Parallel)

**M03: Analytics Architecture** - GA4, Adobe Analytics, multi-homing detection
**M04: Paid Media Pixels** - Meta, Google Ads, LinkedIn, TikTok pixels
**M05: MarTech Orchestration** - HubSpot, Salesforce, Marketo integrations
**M06: Tag Governance** - GTM health, tag count, render blocking
**M07: Behavioral Tools** - Hotjar, FullStory, redundancy check
**M08: Accessibility Overlay** - UserWay, AccessiBe detection

### ACTIVE INVESTIGATION (Phase 3 - Waterfall)

**M09: Flight Recorder** - Console logs, network requests, JS errors
**M10: Cookie Consent Compliance** - Pre-consent tracking detection
**M11: PII & Data Leak Sniffer** - Email/phone/SSN in requests
**M12: Dependency Stress Test** - AdBlocker simulation
**M13: Form Fuzzer** - Form submission testing
**M14: Response Protocol** - Auto-responder email tracking

### PERFORMANCE (Phase 4 - Parallel)

**M15: Core Web Vitals** - LCP, INP, CLS
**M16: SEO Technical Health** - Title, meta, robots, sitemap
**M17: Mobile Responsiveness** - Viewport, touch targets
**M18: Redirect Chain Analysis** - Hop count, UTM survival

### EXTERNAL INTELLIGENCE (Phase 5 - Parallel)

**M19: Ad Library & Creatives** - Facebook Ad Library screenshots
**M20: Sentiment & Reputation** - News/social sentiment
**M21: Market Intelligence** - DataForSEO traffic/keywords

---

## 9. Report Generation System

### 9.1 Scoring Algorithm

```python
def calculate_score(findings: List[Finding]) -> int:
    score = 100
    for finding in findings:
        if finding.severity == Severity.CRITICAL:
            score -= 5
        elif finding.severity == Severity.WARNING:
            score -= 1
    return max(0, score)

def get_grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"
```

### 9.2 PDF Structure

| Section | Pages |
|---------|-------|
| Cover | 1 |
| Executive Summary | 1-2 |
| Stack Modules (1-8) | 8-16 |
| Active Investigation (9-14) | 6-12 |
| Performance (15-18) | 4-8 |
| External Intel (19-21) | 3-6 |
| Appendix | 2-4 |
| **Total** | **25-50 pages** |

---

## 10. Infrastructure & Deployment

### 10.1 Local Development (docker-compose)

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    ports: ["5432:5432"]
  redis:
    image: redis:alpine
    ports: ["6379:6379"]
  prefect:
    image: prefecthq/prefect:2-python3.12
    ports: ["4200:4200"]
  backend:
    build: ./backend
    ports: ["8000:8000"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
```

### 10.2 Production (Cloud Run)

```
Cloudflare (Edge) → Cloud Run (Frontend + Backend + Prefect Worker)
                 → Supabase (PostgreSQL + TimescaleDB)
                 → Upstash (Redis)
                 → R2 (Storage)
```

---

## 11. Implementation Phases

| Phase | Days | Focus |
|-------|------|-------|
| 0: Foundation | Day 1 | Monorepo, Docker, FastAPI, Next.js skeleton |
| 1: Core Engine | Days 2-3 | Playwright, Flight Recorder, M01-M02 |
| 2: Stack Modules | Days 3-4 | M03-M08, tech signatures |
| 3: Active Investigation | Days 4-5 | M09-M14, email workers |
| 4: Performance & Intel | Days 5-6 | M15-M21, DataForSEO |
| 5: AI Integration | Day 6 | Gemini prompts, synthesis |
| 6: Report & Dashboard | Days 6-7 | McKinsey slides, React-PDF |
| 7: Leaderboard | Day 7 | TimescaleDB, filters |
| 8: Polish | Day 7+ | Testing, deployment |

---

## 12. Verification Plan

### Automated Tests
- **Unit (Python)**: pytest, 80%+ coverage
- **Unit (TypeScript)**: Vitest
- **Integration**: pytest + httpx
- **E2E**: Playwright

### Test Cases
1. Full audit flow on `https://firstbank.com`
2. Edge cases: no JS, Cloudflare protection, broken SSL, no forms
3. VP demo script with leaderboard

---

## Summary

This PRD defines a production-grade forensic auditing platform with:
- **21 specialized modules** across 5 execution phases
- **Hybrid parallel/waterfall orchestration** via Prefect
- **Enterprise-grade tech stack** (Next.js, FastAPI, PostgreSQL, TimescaleDB)
- **AI-powered insights** via Gemini 2.5 (Flash + Pro)
- **McKinsey-quality deliverables** (HTML dashboard + PDF reports)
- **Time-series leaderboard** for competitive benchmarking

**Estimated effort**: 7 days for functional MVP, with additional polish for production deployment.
