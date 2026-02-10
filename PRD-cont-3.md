# MarketingAlphaScan -- Comprehensive Testing Specification

> **Version**: 1.0
> **Author**: Principal Engineering Review
> **Stack**: Next.js 15 App Router + Node.js/Fastify + Playwright + BullMQ + Supabase + Stripe
> **Context**: Solo developer, near-$0 budget, monorepo architecture

---

## Table of Contents

1. [Test Framework Selection](#1-test-framework-selection)
2. [Engine Module Unit Testing](#2-engine-module-unit-testing)
3. [Integration Testing](#3-integration-testing)
4. [Frontend Testing](#4-frontend-testing)
5. [AI Prompt Testing (Golden Dataset)](#5-ai-prompt-testing-golden-dataset)
6. [E2E Testing](#6-e2e-testing)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Test Data Management](#8-test-data-management)
9. [Coverage Targets](#9-coverage-targets)

---

## 1. Test Framework Selection

### Decision: Vitest for All Unit + Integration Tests

**Vitest** is the correct choice for this monorepo. Not Jest.

**Rationale specific to this project:**

| Factor | Vitest | Jest |
|--------|--------|------|
| ESM native support | First-class. Vite handles ESM/TS/JSX natively via esbuild. No `ts-jest` transform configuration. | Requires `ts-jest` or `@swc/jest` transformer. ESM support is experimental and brittle with `--experimental-vm-modules`. |
| Speed (watch mode) | 10-20x faster. Hot Module Replacement reuses Vite's transform cache. Only re-runs affected tests. | Full re-transform on each run. No HMR. |
| Monorepo support | `projects` config (Vitest 3.2+) allows per-app/package configs sharing a single process. | `--projects` exists but requires separate Jest configs that don't share process memory. |
| Next.js 15 official support | Next.js docs provide first-party Vitest setup guide (`@vitejs/plugin-react` + `next/jest` alternative). | Also officially supported, but requires more config boilerplate. |
| TypeScript | Zero-config. Vite resolves `tsconfig.json` paths natively. | Needs `moduleNameMapper` or `pathsToModuleNameMapper` from `ts-jest`. |
| Compatibility | 95% Jest-compatible API. `vi.fn()` = `jest.fn()`, `vi.mock()` = `jest.mock()`. Migration trivial. | N/A (baseline). |
| Fast-check integration | `@fast-check/vitest` provides first-class property-based testing with `.prop()` syntax. | Requires manual `fc.assert(fc.property(...))` wrapping. |

**Why not Jest:** The engine is a pure Node.js/TypeScript project using ESM imports extensively. Jest's ESM story is still experimental and fragile. The `cheerio`, `playwright`, and `@google/generative-ai` packages all ship ESM. You would spend more time fighting Jest's transform pipeline than writing tests.

**Async Server Components caveat:** Vitest does not support rendering async Server Components (RSC). This is fine -- those are tested via E2E with Playwright Test, not unit tests. Unit tests for the frontend cover Client Components, hooks, and utilities only.

### Decision: Playwright Test for E2E

**Playwright Test** (not Cypress, not Playwright via Vitest) for end-to-end testing.

**Rationale:**

- The engine already uses Playwright for browser automation (GhostScan modules M03, M05-M15, M20). Team already has Playwright expertise and the dependency is already in the lockfile.
- Built-in visual regression (`toHaveScreenshot()`), network interception (`page.route()`), and multi-browser support (Chromium, Firefox, WebKit).
- Native parallelization with worker isolation -- critical for a solo dev who needs fast CI.
- Built-in HTML reporter with trace viewer for debugging failures.
- Free. No SaaS dependency. No per-run pricing.

**Why not Cypress:** Cypress charges for cloud dashboard (parallelization, screenshots). Cypress lacks WebKit support. Cypress re-invents its own browser runtime which adds complexity. Since Playwright is already a project dependency, adding Cypress doubles the browser automation surface area for zero benefit.

### Configuration Files

#### `vitest.config.ts` (Root -- Monorepo Orchestrator)

```typescript
// /vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/web/vitest.config.ts',
      'apps/engine/vitest.config.ts',
      'packages/types/vitest.config.ts',
    ],
  },
});
```

#### `apps/engine/vitest.config.ts`

```typescript
// apps/engine/vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'engine',
    root: './apps/engine',
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/workers/**', 'src/lib/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.fixture.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    // Timeouts: external API mocks should resolve instantly,
    // but Playwright page mocks may need more time
    testTimeout: 10_000,
    hookTimeout: 15_000,
    // Pool configuration for engine tests
    pool: 'forks',        // 'forks' isolates module state between test files
    poolOptions: {
      forks: { singleFork: false },
    },
  },
});
```

#### `apps/web/vitest.config.ts`

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    name: 'web',
    root: './apps/web',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
    css: false, // Don't process CSS in unit tests
    coverage: {
      provider: 'v8',
      include: ['src/components/**', 'src/hooks/**', 'src/lib/**'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

#### `playwright.config.ts` (Root -- E2E)

```typescript
// /playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,   // Limit CI workers to save resources
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project: authenticate test users, store state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile viewport -- critical for this product
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start Next.js dev server for local E2E runs
  webServer: process.env.CI ? undefined : {
    command: 'pnpm --filter web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
```

### Package Dependencies

```jsonc
// Root package.json devDependencies
{
  "vitest": "^3.2.0",
  "@vitejs/plugin-react": "^4.0.0",
  "vite-tsconfig-paths": "^5.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "@testing-library/user-event": "^14.0.0",
  "jsdom": "^25.0.0",
  "msw": "^2.7.0",
  "@fast-check/vitest": "^0.2.0",
  "@playwright/test": "^1.50.0",
  "@testcontainers/redis": "^10.0.0",
  "testcontainers": "^10.0.0"
}
```

Estimated total devDependency addition: **~45 MB node_modules**. Zero runtime cost.

---

## 2. Engine Module Unit Testing

### Architecture Principle: Every Module is a Pure Function

Each scan module should follow this contract:

```typescript
// packages/types/src/module.ts
export interface ModuleContext {
  url: string;
  domain: string;
  page?: Page;                    // Playwright Page (Phase 2-3 only)
  networkCollector?: NetworkCollector; // Phase 2-3 only
  httpResponse?: HttpResponse;    // Phase 1 cached HTTP response
  htmlBody?: string;              // Phase 1 cached HTML
  dnsRecords?: DnsRecords;        // Phase 1 cached DNS
  abortSignal?: AbortSignal;      // For cancellation
}

export interface ModuleResult<T = unknown> {
  moduleId: string;
  status: 'success' | 'partial' | 'error';
  data: T;
  duration: number;
  errors?: string[];
}

export type ModuleExecutor<T> = (ctx: ModuleContext) => Promise<ModuleResult<T>>;
```

This means: **every module is testable by constructing a `ModuleContext` with mocked dependencies and asserting on the returned `ModuleResult`.**

### 2.1 Mocking HTTP Responses for Passive Modules (Phase 1)

Phase 1 modules (M01, M02, M04, M16-M19) consume DNS records, HTTP headers, and HTML bodies. These are pure data transformations.

**Strategy: MSW for HTTP-level mocking + direct data injection**

```typescript
// apps/engine/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// apps/engine/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // DataForSEO mock
  http.post('https://api.dataforseo.com/v3/*', () => {
    return HttpResponse.json({ status_code: 20000, tasks: [] });
  }),

  // Google Gemini mock
  http.post('https://generativelanguage.googleapis.com/v1beta/*', () => {
    return HttpResponse.json({
      candidates: [{ content: { parts: [{ text: '{}' }] } }],
    });
  }),
];
```

**For DNS mocking, don't mock the network -- mock the `dns` module:**

```typescript
// apps/engine/src/modules/m01-dns-security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeM01 } from './m01-dns-security';
import type { ModuleContext } from '@mas/types';

// Mock Node's dns/promises module
vi.mock('node:dns/promises', () => ({
  resolveTxt: vi.fn(),
  resolveMx: vi.fn(),
  resolveCname: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
  resolveNs: vi.fn(),
}));

import * as dns from 'node:dns/promises';

describe('M01: DNS & Security Baseline', () => {
  const baseCtx: ModuleContext = {
    url: 'https://example.com',
    domain: 'example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SPF Record Detection', () => {
    it('should detect valid SPF record', async () => {
      vi.mocked(dns.resolveTxt).mockResolvedValue([
        ['v=spf1 include:_spf.google.com ~all'],
      ]);
      vi.mocked(dns.resolveMx).mockResolvedValue([
        { exchange: 'mx.example.com', priority: 10 },
      ]);
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      vi.mocked(dns.resolveNs).mockResolvedValue(['ns1.example.com']);
      vi.mocked(dns.resolveCname).mockRejectedValue(
        new Error('ENOTFOUND')  // No CNAME = direct A record
      );

      const result = await executeM01(baseCtx);

      expect(result.status).toBe('success');
      expect(result.data.spf).toMatchObject({
        exists: true,
        record: 'v=spf1 include:_spf.google.com ~all',
        mechanism: 'softfail',
        includes: ['_spf.google.com'],
      });
    });

    it('should flag missing SPF as security gap', async () => {
      vi.mocked(dns.resolveTxt).mockResolvedValue([]);
      vi.mocked(dns.resolveMx).mockResolvedValue([]);
      vi.mocked(dns.resolve4).mockResolvedValue(['93.184.216.34']);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      vi.mocked(dns.resolveNs).mockResolvedValue(['ns1.example.com']);
      vi.mocked(dns.resolveCname).mockRejectedValue(new Error('ENOTFOUND'));

      const result = await executeM01(baseCtx);

      expect(result.data.spf.exists).toBe(false);
      expect(result.data.securityGaps).toContainEqual(
        expect.objectContaining({ type: 'missing_spf' })
      );
    });

    it('should handle DNS timeout gracefully', async () => {
      vi.mocked(dns.resolveTxt).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );
      vi.mocked(dns.resolveMx).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );
      vi.mocked(dns.resolve4).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );
      vi.mocked(dns.resolve6).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );
      vi.mocked(dns.resolveNs).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );
      vi.mocked(dns.resolveCname).mockRejectedValue(
        Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' })
      );

      const result = await executeM01(baseCtx);

      expect(result.status).toBe('error');
      expect(result.errors).toContain('DNS resolution timed out');
    });
  });

  describe('DMARC Detection', () => {
    it('should parse DMARC policy from _dmarc subdomain TXT', async () => {
      vi.mocked(dns.resolveTxt).mockImplementation(async (hostname: string) => {
        if (hostname === '_dmarc.example.com') {
          return [['v=DMARC1; p=reject; rua=mailto:dmarc@example.com']];
        }
        return [['v=spf1 -all']];
      });
      // ... other DNS mocks

      const result = await executeM01(baseCtx);

      expect(result.data.dmarc).toMatchObject({
        exists: true,
        policy: 'reject',
        reportingUri: 'mailto:dmarc@example.com',
      });
    });
  });

  describe('HTTP Security Headers', () => {
    it('should detect all security headers from pre-fetched response', async () => {
      const ctx: ModuleContext = {
        ...baseCtx,
        httpResponse: {
          status: 200,
          headers: {
            'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
            'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'strict-origin-when-cross-origin',
            'permissions-policy': 'camera=(), microphone=()',
          },
        },
      };

      // Mock DNS calls to return empty (we're testing headers here)
      vi.mocked(dns.resolveTxt).mockResolvedValue([]);
      vi.mocked(dns.resolveMx).mockResolvedValue([]);
      vi.mocked(dns.resolve4).mockResolvedValue(['1.2.3.4']);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      vi.mocked(dns.resolveNs).mockResolvedValue([]);
      vi.mocked(dns.resolveCname).mockRejectedValue(new Error('ENOTFOUND'));

      const result = await executeM01(ctx);

      expect(result.data.securityHeaders).toMatchObject({
        hsts: { present: true, maxAge: 31536000, includeSubDomains: true, preload: true },
        csp: { present: true, hasUnsafeInline: true },
        xFrameOptions: { present: true, value: 'DENY' },
        xContentTypeOptions: { present: true },
        referrerPolicy: { present: true, value: 'strict-origin-when-cross-origin' },
        permissionsPolicy: { present: true },
      });
    });
  });

  describe('Output Schema Validation', () => {
    it('should match the M01 output Zod schema', async () => {
      // ... setup mocks
      vi.mocked(dns.resolveTxt).mockResolvedValue([['v=spf1 -all']]);
      vi.mocked(dns.resolveMx).mockResolvedValue([]);
      vi.mocked(dns.resolve4).mockResolvedValue(['1.2.3.4']);
      vi.mocked(dns.resolve6).mockResolvedValue([]);
      vi.mocked(dns.resolveNs).mockResolvedValue([]);
      vi.mocked(dns.resolveCname).mockRejectedValue(new Error('ENOTFOUND'));

      const result = await executeM01(baseCtx);

      // Validate against the shared Zod schema
      const parsed = M01OutputSchema.safeParse(result.data);
      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        console.error('Schema validation errors:', parsed.error.issues);
      }
    });
  });
});
```

### 2.2 Mocking Playwright Page/BrowserContext for Browser Modules (Phase 2-3)

Phase 2-3 modules receive a Playwright `Page` object. **Do not start a real browser in unit tests.** Create a mock Page that returns pre-recorded data.

**Strategy: Build a `MockPage` factory that implements the subset of the Playwright `Page` API each module actually uses.**

```typescript
// apps/engine/test/mocks/mock-page.ts
import { vi } from 'vitest';
import type { Page, BrowserContext, Response } from 'playwright';

export interface MockPageOptions {
  url?: string;
  content?: string;
  cookies?: Array<{ name: string; value: string; domain: string; path: string }>;
  performanceTiming?: Record<string, number>;
  consoleMessages?: Array<{ type: string; text: string }>;
  globals?: Record<string, unknown>;
}

export function createMockPage(options: MockPageOptions = {}): Page {
  const {
    url = 'https://example.com',
    content = '<html><body></body></html>',
    cookies = [],
    performanceTiming = {},
    consoleMessages = [],
    globals = {},
  } = options;

  const consoleCallbacks: Array<(msg: any) => void> = [];

  const mockContext = {
    cookies: vi.fn().mockResolvedValue(cookies),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    addCookies: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;

  const mockPage = {
    url: vi.fn().mockReturnValue(url),
    goto: vi.fn().mockResolvedValue({
      status: vi.fn().mockReturnValue(200),
      headers: vi.fn().mockReturnValue({}),
    } as unknown as Response),
    content: vi.fn().mockResolvedValue(content),
    title: vi.fn().mockResolvedValue('Example Page'),

    // Evaluation -- the core of how modules extract data
    evaluate: vi.fn().mockImplementation(async (fn: Function, ...args: unknown[]) => {
      // For performance timing requests
      if (fn.toString().includes('performance.timing')) {
        return performanceTiming;
      }
      // For global detection (window.ga, window.dataLayer, etc.)
      if (fn.toString().includes('window')) {
        return globals;
      }
      return undefined;
    }),

    evaluateHandle: vi.fn().mockResolvedValue({
      jsonValue: vi.fn().mockResolvedValue({}),
      dispose: vi.fn(),
    }),

    // Event handling
    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (event === 'console') {
        consoleCallbacks.push(callback as any);
      }
      return mockPage;
    }),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),

    // Navigation and interaction (Phase 3 GhostScan)
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    scroll: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({
      isVisible: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue(''),
      getAttribute: vi.fn().mockResolvedValue(null),
      click: vi.fn().mockResolvedValue(undefined),
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
    }),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      status: vi.fn().mockReturnValue(200),
    }),

    // Selectors
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    locator: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(0),
      first: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue([]),
      isVisible: vi.fn().mockResolvedValue(false),
      textContent: vi.fn().mockResolvedValue(''),
      getAttribute: vi.fn().mockResolvedValue(null),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    }),

    // Network interception
    route: vi.fn().mockResolvedValue(undefined),
    unroute: vi.fn().mockResolvedValue(undefined),

    // Context
    context: vi.fn().mockReturnValue(mockContext),

    // Screenshots (for debugging, not core logic)
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),

    // Viewport
    viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    setViewportSize: vi.fn().mockResolvedValue(undefined),

    // Cleanup
    close: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
  } as unknown as Page;

  // Simulate console messages after a tick
  if (consoleMessages.length > 0) {
    setTimeout(() => {
      consoleMessages.forEach(msg => {
        consoleCallbacks.forEach(cb => cb({
          type: () => msg.type,
          text: () => msg.text,
          location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
          args: () => [],
        }));
      });
    }, 0);
  }

  return mockPage;
}
```

### 2.3 Mocking NetworkCollector

The `NetworkCollector` is a custom class that intercepts Playwright network events and categorizes them (analytics, ads, trackers, etc.). Modules in Phase 2-3 read from it.

```typescript
// apps/engine/test/mocks/mock-network-collector.ts
import type { NetworkCollector, NetworkEntry } from '@mas/types';

export function createMockNetworkCollector(
  entries: NetworkEntry[] = []
): NetworkCollector {
  return {
    entries,
    getByCategory: (category: string) =>
      entries.filter(e => e.category === category),
    getByDomain: (domain: string) =>
      entries.filter(e => new URL(e.url).hostname.includes(domain)),
    getByPattern: (pattern: RegExp) =>
      entries.filter(e => pattern.test(e.url)),
    getByMimeType: (mime: string) =>
      entries.filter(e => e.mimeType?.includes(mime)),
    getTotalSize: () =>
      entries.reduce((sum, e) => sum + (e.responseSize || 0), 0),
    getTimeline: () =>
      [...entries].sort((a, b) => a.startTime - b.startTime),
  };
}

// Pre-built fixture: a site running Google Analytics + Facebook Pixel
export const GA_FB_NETWORK_FIXTURE: NetworkEntry[] = [
  {
    url: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX',
    method: 'GET',
    resourceType: 'script',
    category: 'analytics',
    mimeType: 'application/javascript',
    responseSize: 84_230,
    startTime: 150,
    duration: 45,
    status: 200,
  },
  {
    url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXXXXXX',
    method: 'POST',
    resourceType: 'xhr',
    category: 'analytics',
    mimeType: 'text/plain',
    responseSize: 0,
    startTime: 320,
    duration: 12,
    status: 204,
  },
  {
    url: 'https://connect.facebook.net/en_US/fbevents.js',
    method: 'GET',
    resourceType: 'script',
    category: 'advertising',
    mimeType: 'application/javascript',
    responseSize: 62_100,
    startTime: 180,
    duration: 38,
    status: 200,
  },
  {
    url: 'https://www.facebook.com/tr/?id=123456789&ev=PageView',
    method: 'GET',
    resourceType: 'image',
    category: 'advertising',
    mimeType: 'image/gif',
    responseSize: 44,
    startTime: 350,
    duration: 22,
    status: 200,
  },
];
```

### 2.4 Mocking External APIs (DataForSEO, Gemini)

**Strategy: MSW handlers with fixture-based responses per module.**

```typescript
// apps/engine/test/mocks/dataforseo-handlers.ts
import { http, HttpResponse } from 'msw';
import { readFixture } from '../fixtures/loader';

export const dataForSeoHandlers = [
  // M25: Monthly Visits
  http.post(
    'https://api.dataforseo.com/v3/domain_analytics/technologies/domain_technologies/live',
    async ({ request }) => {
      const body = await request.json() as any[];
      const target = body[0]?.target;
      const fixture = await readFixture('dataforseo', 'domain-technologies', target);
      return HttpResponse.json(fixture);
    }
  ),

  // M27: Rankings
  http.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank/live',
    async ({ request }) => {
      const body = await request.json() as any[];
      const target = body[0]?.target;
      const fixture = await readFixture('dataforseo', 'domain-rank', target);
      return HttpResponse.json(fixture);
    }
  ),

  // Catch-all for unhandled DataForSEO endpoints
  http.post('https://api.dataforseo.com/v3/*', () => {
    return HttpResponse.json({
      version: '0.1.20241223',
      status_code: 20000,
      status_message: 'Ok.',
      tasks: [],
    });
  }),
];

// apps/engine/test/mocks/gemini-handlers.ts
import { http, HttpResponse } from 'msw';
import { readFixture } from '../fixtures/loader';

export const geminiHandlers = [
  http.post(
    'https://generativelanguage.googleapis.com/v1beta/models/:model:generateContent',
    async ({ params, request }) => {
      const model = params.model as string;
      const body = await request.json() as any;

      // Extract a hint from the prompt to determine which fixture to return
      const promptText = body.contents?.[0]?.parts?.[0]?.text || '';
      const fixtureKey = extractFixtureKey(promptText); // e.g., 'm41_analytics', 'm42_final'

      const fixture = await readFixture('gemini', model, fixtureKey);
      return HttpResponse.json({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(fixture) }],
            role: 'model',
          },
          finishReason: 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: 1500,
          candidatesTokenCount: 800,
          totalTokenCount: 2300,
        },
      });
    }
  ),
];

function extractFixtureKey(prompt: string): string {
  // Map prompt content to fixture files
  if (prompt.includes('analytics')) return 'm41_analytics';
  if (prompt.includes('paid media')) return 'm41_paid_media';
  if (prompt.includes('final synthesis')) return 'm42_final';
  if (prompt.includes('PRD')) return 'm43_prd';
  if (prompt.includes('ROI')) return 'm44_roi';
  if (prompt.includes('cost cutter')) return 'm45_cost_cutter';
  return 'generic';
}
```

### 2.5 Test Fixture Design

```
apps/engine/test/fixtures/
├── loader.ts                          # Fixture loader utility
├── dns/
│   ├── example.com.json               # Full DNS record set
│   ├── shopify-store.json             # Shopify-hosted site DNS
│   ├── cloudflare-protected.json      # Behind Cloudflare proxy
│   └── no-email.json                  # No MX/SPF/DMARC
├── http/
│   ├── headers/
│   │   ├── security-hardened.json     # All security headers present
│   │   ├── wordpress-default.json     # Typical WP headers
│   │   └── minimal.json              # Bare minimum headers
│   └── bodies/
│       ├── ecommerce-shopify.html     # Full Shopify store HTML
│       ├── saas-landing.html          # Typical B2B SaaS landing page
│       ├── wordpress-blog.html        # WordPress blog with plugins
│       ├── spa-react.html             # React SPA (minimal HTML, JS-heavy)
│       └── static-hugo.html           # Static site generator
├── network/
│   ├── ga4-only.json                  # Only Google Analytics 4
│   ├── full-martech-stack.json        # GA + FB + Hotjar + HubSpot + GTM
│   ├── ecommerce-heavy.json          # Shopify + Facebook + TikTok + Klaviyo
│   └── minimal-tracking.json         # No third-party tracking
├── dataforseo/
│   ├── domain-technologies/
│   │   ├── example.com.json
│   │   └── shopify-store.com.json
│   ├── domain-rank/
│   │   └── example.com.json
│   └── ...                            # One subdir per API endpoint
├── gemini/
│   ├── gemini-2.5-flash/
│   │   ├── m41_analytics.json
│   │   ├── m41_paid_media.json
│   │   └── m44_roi.json
│   └── gemini-2.5-pro/
│       ├── m42_final.json
│       └── m43_prd.json
└── golden/                            # Golden dataset (see Section 5)
    ├── manifest.json
    ├── hubspot.com/
    ├── shopify.com/
    └── ...
```

**Fixture Loader:**

```typescript
// apps/engine/test/fixtures/loader.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '.');

export async function readFixture(
  ...segments: string[]
): Promise<unknown> {
  const path = join(FIXTURES_DIR, ...segments) + '.json';
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

export async function readHtmlFixture(
  ...segments: string[]
): Promise<string> {
  const path = join(FIXTURES_DIR, ...segments) + '.html';
  return readFile(path, 'utf-8');
}
```

### 2.6 Snapshot Testing for Module Output Schemas

Use Vitest inline snapshots for **structural** validation (not exact values, which are brittle):

```typescript
// In any module test:
it('should produce the expected output structure', async () => {
  const result = await executeM05(ctx);

  // Snapshot the KEYS only, not values (values change per fixture)
  const structureKeys = extractDeepKeys(result.data);
  expect(structureKeys).toMatchInlineSnapshot(`
    [
      "providers",
      "providers[].name",
      "providers[].category",
      "providers[].confidence",
      "providers[].signals",
      "providers[].signals[].type",
      "providers[].signals[].source",
      "providers[].signals[].evidence",
      "identifiers",
      "identifiers.clientIds",
      "identifiers.measurementIds",
      "identifiers.containerIds",
      "dataLayer",
      "dataLayer.present",
      "dataLayer.entries",
    ]
  `);
});
```

Complement with **Zod schema validation** which is more maintainable:

```typescript
it('should validate against M05 Zod schema', async () => {
  const result = await executeM05(ctx);
  const parsed = M05AnalyticsSchema.safeParse(result.data);
  expect(parsed.success).toBe(true);
});
```

### 2.7 Property-Based Testing Opportunities

Property-based testing shines where modules perform **parsing or transformation** of arbitrary input. Target these specific areas:

```typescript
// apps/engine/src/modules/m01-dns-security.prop.test.ts
import { describe } from 'vitest';
import { test, fc } from '@fast-check/vitest';

describe('M01 Property-Based Tests', () => {
  // Property: SPF parser should never throw, regardless of input
  test.prop(
    [fc.string({ minLength: 0, maxLength: 500 })],
    { numRuns: 200 }
  )('SPF parser should never throw on arbitrary input', (rawTxt) => {
    const result = parseSPFRecord(rawTxt);
    // Should always return a valid SPFResult, even if "invalid"
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('mechanism');
  });

  // Property: URL normalizer should always produce a valid URL
  test.prop(
    [fc.webUrl()],
    { numRuns: 100 }
  )('URL normalizer should produce valid URL for any web URL', (url) => {
    const normalized = normalizeUrl(url);
    expect(() => new URL(normalized)).not.toThrow();
  });

  // Property: Security header parser should handle arbitrary header values
  test.prop(
    [fc.dictionary(
      fc.constantFrom(
        'strict-transport-security',
        'content-security-policy',
        'x-frame-options',
        'x-content-type-options',
        'referrer-policy',
        'permissions-policy'
      ),
      fc.string({ minLength: 0, maxLength: 1000 })
    )],
    { numRuns: 150 }
  )('security header parser should not throw on any header values', (headers) => {
    const result = parseSecurityHeaders(headers);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// apps/engine/src/lib/cookie-parser.prop.test.ts
describe('Cookie Parser Property Tests', () => {
  test.prop(
    [fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.string({ minLength: 0, maxLength: 200 }),
        domain: fc.domain(),
        path: fc.constantFrom('/', '/app', '/api'),
        httpOnly: fc.boolean(),
        secure: fc.boolean(),
        sameSite: fc.constantFrom('Strict', 'Lax', 'None'),
      }),
      { minLength: 0, maxLength: 50 }
    )],
    { numRuns: 100 }
  )('cookie classifier should handle any cookie array', (cookies) => {
    const classified = classifyCookies(cookies);

    // Properties that must always hold:
    // 1. Total classified cookies <= input cookies
    expect(classified.analytics.length + classified.advertising.length +
           classified.functional.length + classified.unknown.length)
      .toBeLessThanOrEqual(cookies.length);

    // 2. No cookie appears in two categories
    const allClassified = [
      ...classified.analytics,
      ...classified.advertising,
      ...classified.functional,
      ...classified.unknown,
    ];
    const uniqueNames = new Set(allClassified.map(c => c.name));
    expect(uniqueNames.size).toBe(allClassified.length);
  });
});
```

**Where property-based testing is NOT worth it:** External API response parsing (use fixture-based tests), Playwright interaction sequences (too complex to generate meaningfully), AI prompt construction (test with golden dataset instead).

### 2.8 Full M01 Test File Structure

```
apps/engine/src/modules/m01-dns-security/
├── index.ts                    # Module executor
├── parsers.ts                  # SPF, DMARC, DKIM, header parsers
├── schema.ts                   # Zod output schema
├── __tests__/
│   ├── m01.test.ts             # Primary unit tests (shown above)
│   ├── m01.prop.test.ts        # Property-based tests for parsers
│   ├── parsers.test.ts         # Focused parser unit tests
│   └── schema.test.ts          # Schema validation edge cases
```

---

## 3. Integration Testing

### 3.1 BullMQ Queue + Worker Lifecycle Testing

**Strategy:** Use Testcontainers to spin up a real Redis instance. Do not mock Redis -- BullMQ's Lua scripts behave differently from naive mocks.

```typescript
// apps/engine/test/integration/queue-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

describe('BullMQ Scan Queue Lifecycle', () => {
  let container: StartedTestContainer;
  let redis: IORedis;
  let queue: Queue;
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    // Start Redis container -- takes ~2s first run, cached after
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    const port = container.getMappedPort(6379);
    const host = container.getHost();

    redis = new IORedis({ host, port, maxRetriesPerRequest: null });
    queue = new Queue('scan', { connection: { host, port } });
    queueEvents = new QueueEvents('scan', { connection: { host, port } });
  }, 30_000); // 30s timeout for container startup

  afterAll(async () => {
    await queueEvents.close();
    await queue.close();
    await redis.quit();
    await container.stop();
  });

  beforeEach(async () => {
    await queue.drain(); // Clean queue between tests
  });

  it('should enqueue a scan job and process it through all phases', async () => {
    const worker = new Worker(
      'scan',
      async (job) => {
        expect(job.data).toMatchObject({ url: 'https://example.com' });

        // Simulate phase progression
        await job.updateProgress({ phase: 1, module: 'M01', status: 'running' });
        await job.updateProgress({ phase: 1, module: 'M01', status: 'complete' });

        return { scanId: 'test-123', status: 'complete' };
      },
      { connection: { host: container.getHost(), port: container.getMappedPort(6379) } }
    );

    const job = await queue.add('scan', {
      url: 'https://example.com',
      userId: 'user-123',
      scanId: 'test-123',
    });

    // Wait for completion with timeout
    const result = await job.waitUntilFinished(queueEvents, 10_000);

    expect(result).toMatchObject({
      scanId: 'test-123',
      status: 'complete',
    });

    await worker.close();
  });

  it('should handle job failure and retry', async () => {
    let attempts = 0;

    const worker = new Worker(
      'scan',
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return { status: 'complete' };
      },
      {
        connection: { host: container.getHost(), port: container.getMappedPort(6379) },
      }
    );

    const job = await queue.add(
      'scan',
      { url: 'https://example.com' },
      { attempts: 3, backoff: { type: 'fixed', delay: 100 } }
    );

    const result = await job.waitUntilFinished(queueEvents, 15_000);
    expect(result).toMatchObject({ status: 'complete' });
    expect(attempts).toBe(3);

    await worker.close();
  });

  it('should emit progress events for SSE streaming', async () => {
    const progressUpdates: any[] = [];

    const worker = new Worker(
      'scan',
      async (job) => {
        for (const phase of [1, 2, 3, 4, 5]) {
          await job.updateProgress({ phase, status: 'running' });
          await new Promise(r => setTimeout(r, 10));
          await job.updateProgress({ phase, status: 'complete' });
        }
        return { status: 'complete' };
      },
      { connection: { host: container.getHost(), port: container.getMappedPort(6379) } }
    );

    const job = await queue.add('scan', { url: 'https://example.com' });

    // Listen to progress events (simulates SSE consumer)
    queueEvents.on('progress', ({ jobId, data }) => {
      if (jobId === job.id) {
        progressUpdates.push(data);
      }
    });

    await job.waitUntilFinished(queueEvents, 10_000);

    expect(progressUpdates.length).toBeGreaterThanOrEqual(10); // 5 phases x 2 events
    expect(progressUpdates[0]).toMatchObject({ phase: 1, status: 'running' });

    await worker.close();
  });
});
```

### 3.2 Full Scan Pipeline Integration Test

This is the most valuable integration test. It validates: URL input -> queue -> module execution -> database write.

```typescript
// apps/engine/test/integration/full-pipeline.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { server as mswServer } from '../mocks/server';

describe('Full Scan Pipeline', () => {
  let redisContainer: StartedTestContainer;
  let redis: IORedis;
  let supabase: ReturnType<typeof createClient>;

  beforeAll(async () => {
    // Start Redis
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    redis = new IORedis({
      host: redisContainer.getHost(),
      port: redisContainer.getMappedPort(6379),
      maxRetriesPerRequest: null,
    });

    // Use Supabase local CLI instance or test project
    supabase = createClient(
      process.env.SUPABASE_TEST_URL || 'http://localhost:54321',
      process.env.SUPABASE_TEST_ANON_KEY || 'your-test-anon-key',
    );

    // Enable MSW to intercept external API calls
    mswServer.listen({ onUnhandledRequest: 'error' });
  }, 60_000);

  afterAll(async () => {
    mswServer.close();
    await redis.quit();
    await redisContainer.stop();
  });

  it('should execute a scan from URL to database', async () => {
    // 1. Insert a scan record
    const { data: scan, error } = await supabase
      .from('scans')
      .insert({
        url: 'https://example.com',
        status: 'queued',
        user_id: null, // anonymous scan
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(scan).toBeTruthy();

    // 2. Enqueue the scan job
    const queue = new Queue('scan', {
      connection: {
        host: redisContainer.getHost(),
        port: redisContainer.getMappedPort(6379),
      },
    });

    await queue.add('scan', {
      scanId: scan!.id,
      url: 'https://example.com',
    });

    // 3. Start the worker (imports the real scan orchestrator)
    // In a real test, this imports your actual worker processor
    // but with MSW intercepting all external calls

    // 4. Wait for completion and verify database state
    // ... (abbreviated for specification purposes)

    await queue.close();
  });
});
```

### 3.3 Supabase Test Strategy

**Recommended approach: Supabase CLI local development stack.**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Supabase CLI (`supabase start`)** | Real PostgreSQL, RLS policies tested, migrations validated, free, Mailpit for email testing | Requires Docker (~1GB RAM), slow startup (~15s) | **Use for integration tests** |
| **Separate test project (cloud)** | No local Docker needed | Costs money, network latency, shared state issues | Avoid |
| **Mocked client** | Fastest, no dependencies | Doesn't test RLS, SQL, or real behavior | **Use for unit tests only** |

**Local Supabase for integration tests:**

```bash
# Start local Supabase stack (run once before integration tests)
supabase start

# Output:
# API URL: http://localhost:54321
# GraphQL URL: http://localhost:54321/graphql/v1
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Inbucket URL: http://localhost:54324  (email testing)
# anon key: eyJhbGciOiJIUzI1NiIs...
# service_role key: eyJhbGciOiJIUzI1NiIs...
```

**Mocked Supabase client for unit tests:**

```typescript
// apps/engine/test/mocks/mock-supabase.ts
import { vi } from 'vitest';

export function createMockSupabase() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockUpsert = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockEq = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();

  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
    single: mockSingle,
    eq: mockEq,
    order: mockOrder,
  });

  return {
    client: { from } as any,
    mocks: { from, mockSelect, mockInsert, mockUpdate, mockSingle, mockEq },
  };
}
```

### 3.4 Redis Test Strategy

**Decision: Testcontainers for integration tests (see 3.1), vi.mock for unit tests.**

Do **not** install a system-level Redis for development. Testcontainers handles this automatically and ensures clean state.

For unit tests that reference Redis-dependent code (rate limiter, cache), mock the IORedis instance:

```typescript
vi.mock('ioredis', () => {
  const Redis = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    quit: vi.fn().mockResolvedValue('OK'),
  }));
  return { default: Redis, Redis };
});
```

### 3.5 HMAC Auth Middleware Testing

The engine uses HMAC signatures to authenticate requests from the frontend. Test this at the HTTP level:

```typescript
// apps/engine/test/integration/hmac-auth.test.ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildApp } from '../../src/app'; // Fastify app factory

describe('HMAC Authentication Middleware', () => {
  const app = buildApp({ logger: false });
  const SECRET = 'test-hmac-secret';

  function signRequest(body: string, timestamp: string): string {
    return createHmac('sha256', SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }

  it('should accept valid HMAC signature', async () => {
    const body = JSON.stringify({ url: 'https://example.com' });
    const timestamp = Date.now().toString();
    const signature = signRequest(body, timestamp);

    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': timestamp,
      },
      payload: body,
    });

    expect(response.statusCode).not.toBe(401);
  });

  it('should reject invalid HMAC signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-signature': 'invalid-signature',
        'x-timestamp': Date.now().toString(),
      },
      payload: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject expired timestamps (>5 min old)', async () => {
    const body = JSON.stringify({ url: 'https://example.com' });
    const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago
    const signature = signRequest(body, oldTimestamp);

    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-signature': signature,
        'x-timestamp': oldTimestamp,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: expect.stringContaining('expired') });
  });

  it('should reject requests with missing signature header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(response.statusCode).toBe(401);
  });
});
```

---

## 4. Frontend Testing

### 4.1 React Component Testing with Testing Library

**Setup file for the web app:**

```typescript
// apps/web/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

**Example: Testing a ScanResult card component:**

```typescript
// apps/web/src/components/scan-result-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanResultCard } from './scan-result-card';

const mockModuleResult = {
  moduleId: 'M05',
  moduleName: 'Analytics Architecture',
  status: 'success' as const,
  data: {
    providers: [
      { name: 'Google Analytics 4', category: 'analytics', confidence: 0.98 },
      { name: 'Facebook Pixel', category: 'advertising', confidence: 0.95 },
    ],
  },
};

describe('ScanResultCard', () => {
  it('should render module name and detected providers', () => {
    render(<ScanResultCard result={mockModuleResult} />);

    expect(screen.getByText('Analytics Architecture')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics 4')).toBeInTheDocument();
    expect(screen.getByText('Facebook Pixel')).toBeInTheDocument();
  });

  it('should show confidence scores as percentages', () => {
    render(<ScanResultCard result={mockModuleResult} />);

    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('should expand details on click', async () => {
    const user = userEvent.setup();
    render(<ScanResultCard result={mockModuleResult} />);

    // Details should be hidden initially
    expect(screen.queryByTestId('module-details')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByRole('button', { name: /view details/i }));

    expect(screen.getByTestId('module-details')).toBeInTheDocument();
  });

  it('should render error state for failed modules', () => {
    render(
      <ScanResultCard
        result={{ ...mockModuleResult, status: 'error', errors: ['DNS timeout'] }}
      />
    );

    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText('DNS timeout')).toBeInTheDocument();
  });
});
```

### 4.2 SSE Stream Consumer Testing

The frontend consumes Server-Sent Events from the engine during a scan. Testing this requires simulating the SSE stream.

```typescript
// apps/web/src/hooks/use-scan-stream.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useScanStream } from './use-scan-stream';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 0; // CONNECTING

  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate connection after microtask
    queueMicrotask(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helper: simulate server sending an event
  _emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });

    if (type === 'message') {
      this.onmessage?.(event);
    }

    this.listeners.get(type)?.forEach(listener => listener(event));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

describe('useScanStream', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should connect to SSE endpoint and receive progress updates', async () => {
    const { result } = renderHook(() =>
      useScanStream({ scanId: 'scan-123', enabled: true })
    );

    // Initially connecting
    expect(result.current.status).toBe('connecting');

    // Wait for connection
    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    // Simulate progress events
    const sse = MockEventSource.instances[0];

    act(() => {
      sse._emit('progress', {
        phase: 1,
        module: 'M01',
        status: 'running',
        progress: 5,
      });
    });

    expect(result.current.progress).toBe(5);
    expect(result.current.currentModule).toBe('M01');

    act(() => {
      sse._emit('progress', {
        phase: 1,
        module: 'M01',
        status: 'complete',
        progress: 10,
      });
    });

    expect(result.current.progress).toBe(10);
    expect(result.current.completedModules).toContain('M01');
  });

  it('should handle scan completion', async () => {
    const { result } = renderHook(() =>
      useScanStream({ scanId: 'scan-123', enabled: true })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    const sse = MockEventSource.instances[0];

    act(() => {
      sse._emit('complete', { scanId: 'scan-123', marketingIQ: 72 });
    });

    expect(result.current.status).toBe('complete');
    expect(result.current.marketingIQ).toBe(72);
    expect(sse.readyState).toBe(2); // Should auto-close
  });

  it('should handle SSE errors with reconnection', async () => {
    const { result } = renderHook(() =>
      useScanStream({ scanId: 'scan-123', enabled: true })
    );

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    const sse = MockEventSource.instances[0];

    act(() => {
      sse.onerror?.(new Event('error'));
    });

    expect(result.current.status).toBe('reconnecting');
  });

  it('should not connect when disabled', () => {
    renderHook(() =>
      useScanStream({ scanId: 'scan-123', enabled: false })
    );

    expect(MockEventSource.instances).toHaveLength(0);
  });
});
```

### 4.3 Supabase Auth Mocking

```typescript
// apps/web/test/mocks/supabase-auth.ts
import { vi } from 'vitest';

export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
  app_metadata: { provider: 'email' },
  created_at: '2025-01-01T00:00:00Z',
};

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  user: mockUser,
};

export function createMockSupabaseAuth() {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: { session: mockSession },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { session: mockSession, user: mockUser },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { session: null, user: { ...mockUser, email_confirmed_at: null } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    }),
  };
}

// Usage in test: mock the Supabase module
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: vi.fn().mockReturnValue({
    auth: createMockSupabaseAuth(),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));
```

### 4.4 Stripe Checkout Flow Testing

**Unit test: the checkout trigger logic, not Stripe's UI.**

```typescript
// apps/web/src/hooks/use-checkout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckout } from './use-checkout';

// Mock the fetch call to your API route
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Stripe.js
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({
    redirectToCheckout: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create checkout session and redirect', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'cs_test_123' }),
    });

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.checkout({
        scanId: 'scan-123',
        priceId: 'price_alphareport_299',
      });
    });

    // Verify API was called correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId: 'scan-123',
        priceId: 'price_alphareport_299',
      }),
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle checkout API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid scan ID' }),
    });

    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.checkout({
        scanId: 'invalid',
        priceId: 'price_alphareport_299',
      });
    });

    expect(result.current.error).toBe('Invalid scan ID');
  });
});
```

### 4.5 PostHog Event Capture Verification

```typescript
// apps/web/test/mocks/posthog.ts
import { vi } from 'vitest';

export const mockPostHog = {
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  onFeatureFlags: vi.fn(),
  isFeatureEnabled: vi.fn().mockReturnValue(false),
  getFeatureFlag: vi.fn().mockReturnValue(null),
};

vi.mock('posthog-js', () => ({
  default: mockPostHog,
  posthog: mockPostHog,
}));

// In test files:
import { mockPostHog } from '../mocks/posthog';

it('should capture scan_started event when scan begins', async () => {
  const user = userEvent.setup();
  render(<ScanForm />);

  await user.type(screen.getByPlaceholderText(/enter url/i), 'https://example.com');
  await user.click(screen.getByRole('button', { name: /scan/i }));

  expect(mockPostHog.capture).toHaveBeenCalledWith('scan_started', {
    url: 'https://example.com',
    source: 'homepage',
  });
});

it('should capture report_purchased event after checkout', async () => {
  // ... trigger checkout flow

  expect(mockPostHog.capture).toHaveBeenCalledWith('report_purchased', {
    scanId: 'scan-123',
    price: 2.99,
    product: 'alpha_brief',
  });
});
```

---

## 5. AI Prompt Testing (Golden Dataset)

### 5.1 Golden Dataset Structure

Maintain a set of **10 known websites** with manually verified scan results. These serve as the ground truth for prompt regression testing.

```
apps/engine/test/fixtures/golden/
├── manifest.json                # Dataset metadata and versioning
├── hubspot.com/
│   ├── input.json              # Complete ModuleContext data for all 40 modules
│   ├── m01-m40-outputs.json    # Expected module outputs (non-AI)
│   ├── m41-expected.json       # Human-verified AI synthesis output
│   ├── m42-expected.json       # Human-verified final scoring
│   └── scoring-rubric.json     # Per-field quality scores
├── shopify.com/
│   └── ...
├── stripe.com/
│   └── ...
├── notion.so/
│   └── ...
├── hubspot.com/
│   └── ...
├── mailchimp.com/
│   └── ...
├── webflow.com/
│   └── ...
├── squarespace.com/
│   └── ...
├── nike.com/
│   └── ...
└── localsmallbiz.com/          # Small business site (edge case)
    └── ...
```

**Why these 10:** They represent the product's target user spectrum -- B2B SaaS (HubSpot, Stripe, Notion), e-commerce platform (Shopify), email marketing (Mailchimp), website builders (Webflow, Squarespace), consumer brand (Nike), and a small local business. Each has a different martech stack, different levels of sophistication, and different detection challenges.

**Manifest file:**

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-06-15",
  "updateFrequency": "quarterly",
  "sites": [
    {
      "domain": "hubspot.com",
      "capturedAt": "2025-06-10T14:30:00Z",
      "notes": "Full martech stack. GTM + GA4 + HubSpot Analytics + Hotjar + 6sense.",
      "expectedMarketingIQ": { "min": 78, "max": 92 },
      "knownTechnologies": ["HubSpot CMS", "Google Analytics 4", "Google Tag Manager", "Hotjar", "6sense", "Cloudflare"],
      "knownGaps": ["No DKIM published on root domain"]
    }
  ]
}
```

### 5.2 Prompt Regression Testing Approach

```typescript
// apps/engine/test/golden/ai-regression.test.ts
import { describe, it, expect } from 'vitest';
import { readFixture } from '../fixtures/loader';
import { executeM41 } from '../../src/modules/m41-ai-synthesis';
import { executeM42 } from '../../src/modules/m42-final-synthesis';
import { M41OutputSchema, M42OutputSchema } from '@mas/types';

// Only run golden dataset tests explicitly (expensive, slow)
// Triggered via: vitest run --project engine --testPathPattern golden
describe.skipIf(!process.env.RUN_GOLDEN)('AI Golden Dataset Regression', () => {
  const SITES = [
    'hubspot.com',
    'shopify.com',
    'stripe.com',
    'notion.so',
    'mailchimp.com',
    'webflow.com',
    'squarespace.com',
    'nike.com',
    'localsmallbiz.com',
  ];

  describe.each(SITES)('Site: %s', (domain) => {
    it('M41 output should pass Zod schema validation', async () => {
      const input = await readFixture('golden', domain, 'input');
      const result = await executeM41(input as any);

      const parsed = M41OutputSchema.safeParse(result.data);
      expect(parsed.success).toBe(true);
    });

    it('M41 output should identify all known technologies', async () => {
      const input = await readFixture('golden', domain, 'input');
      const manifest = await readFixture('golden', 'manifest') as any;
      const siteManifest = manifest.sites.find((s: any) => s.domain === domain);

      const result = await executeM41(input as any);

      // Every known technology should appear somewhere in the AI output
      for (const tech of siteManifest.knownTechnologies) {
        const outputString = JSON.stringify(result.data).toLowerCase();
        expect(outputString).toContain(tech.toLowerCase());
      }
    });

    it('M42 MarketingIQ score should be within expected range', async () => {
      const input = await readFixture('golden', domain, 'input');
      const manifest = await readFixture('golden', 'manifest') as any;
      const siteManifest = manifest.sites.find((s: any) => s.domain === domain);

      const result = await executeM42(input as any);

      expect(result.data.marketingIQ).toBeGreaterThanOrEqual(
        siteManifest.expectedMarketingIQ.min
      );
      expect(result.data.marketingIQ).toBeLessThanOrEqual(
        siteManifest.expectedMarketingIQ.max
      );
    });

    it('M42 should not hallucinate technologies not in scan data', async () => {
      const input = await readFixture('golden', domain, 'input');
      const moduleOutputs = await readFixture('golden', domain, 'm01-m40-outputs');

      const result = await executeM42(input as any);

      // Extract all technology names mentioned in AI output
      const aiMentionedTechs = extractTechnologyMentions(result.data);

      // Cross-reference against what modules actually detected
      const detectedTechs = extractDetectedTechnologies(moduleOutputs as any);

      // Allow AI to mention well-known inferences (e.g., "they likely use X")
      // but flag anything presented as a detection that wasn't found
      const hallucinations = aiMentionedTechs
        .filter(t => t.presentedAsDetected)
        .filter(t => !detectedTechs.some(d =>
          d.toLowerCase().includes(t.name.toLowerCase())
        ));

      expect(hallucinations).toHaveLength(0);
    });
  });
});
```

### 5.3 Output Quality Scoring Criteria

Each AI output field is scored on four dimensions:

| Dimension | Weight | Measurement Method |
|-----------|--------|--------------------|
| **Accuracy** | 40% | Does the output correctly reflect what modules detected? Cross-reference against raw module data. |
| **Specificity** | 25% | Does it cite specific evidence (URLs, cookie names, pixel IDs) rather than generic statements? Check for presence of concrete identifiers. |
| **Actionability** | 25% | Does it provide clear, implementable recommendations? Check for imperative language + specific steps. |
| **Hallucination Rate** | 10% | Does it claim detections that don't exist in the scan data? Inverse score -- 0 hallucinations = full marks. |

```typescript
// apps/engine/test/golden/scoring.ts
export interface QualityScore {
  accuracy: number;      // 0-100
  specificity: number;   // 0-100
  actionability: number; // 0-100
  hallucination: number; // 0-100 (100 = no hallucinations)
  overall: number;       // Weighted average
}

export function scoreOutput(
  aiOutput: any,
  groundTruth: any,
  moduleOutputs: any,
): QualityScore {
  const accuracy = scoreAccuracy(aiOutput, groundTruth);
  const specificity = scoreSpecificity(aiOutput);
  const actionability = scoreActionability(aiOutput);
  const hallucination = scoreHallucination(aiOutput, moduleOutputs);

  return {
    accuracy,
    specificity,
    actionability,
    hallucination,
    overall: accuracy * 0.4 + specificity * 0.25 + actionability * 0.25 + hallucination * 0.1,
  };
}

function scoreAccuracy(aiOutput: any, groundTruth: any): number {
  // Compare detected technologies against ground truth
  const expected = new Set(groundTruth.knownTechnologies.map((t: string) => t.toLowerCase()));
  const mentioned = new Set(
    extractTechnologyMentions(aiOutput).map(t => t.name.toLowerCase())
  );

  const hits = [...expected].filter(e => mentioned.has(e)).length;
  return Math.round((hits / expected.size) * 100);
}

function scoreSpecificity(aiOutput: any): number {
  const text = JSON.stringify(aiOutput);

  // Count specific evidence markers
  const markers = [
    /G-[A-Z0-9]{7,10}/g,          // GA4 measurement IDs
    /GTM-[A-Z0-9]{6,8}/g,          // GTM container IDs
    /UA-\d{6,10}-\d/g,             // Universal Analytics IDs
    /\d+\.\d+\.\d+/g,              // Version numbers
    /https?:\/\/[^\s"]+/g,          // URLs
    /_ga|_gid|_fbp|_fbc|hubspotutk/g, // Cookie names
  ];

  let evidenceCount = 0;
  for (const pattern of markers) {
    const matches = text.match(pattern);
    evidenceCount += matches?.length || 0;
  }

  // Scale: 0 evidence = 0, 20+ evidence items = 100
  return Math.min(100, Math.round((evidenceCount / 20) * 100));
}

function scoreActionability(aiOutput: any): number {
  const text = JSON.stringify(aiOutput);

  // Look for recommendation patterns
  const actionPatterns = [
    /implement/gi,
    /configure/gi,
    /migrate/gi,
    /add\s/gi,
    /remove\s/gi,
    /upgrade/gi,
    /enable/gi,
    /set up/gi,
    /switch to/gi,
    /consider\s(using|adding|implementing)/gi,
  ];

  let actionCount = 0;
  for (const pattern of actionPatterns) {
    const matches = text.match(pattern);
    actionCount += matches?.length || 0;
  }

  return Math.min(100, Math.round((actionCount / 15) * 100));
}
```

### 5.4 Zod Schema Validation for All AI Responses

Every AI module (M41-M46) must have a corresponding Zod schema. The schema acts as a contract between the engine and frontend.

```typescript
// packages/types/src/schemas/m42-final-synthesis.ts
import { z } from 'zod';

export const TrafficLightSchema = z.enum(['red', 'yellow', 'green']);

export const CategoryScoreSchema = z.object({
  category: z.string(),
  score: z.number().min(0).max(100),
  trafficLight: TrafficLightSchema,
  summary: z.string().min(20).max(500),
  topFindings: z.array(z.string()).min(1).max(5),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    effort: z.enum(['quick-win', 'moderate', 'major']),
    impact: z.string(),
  })).min(1).max(10),
});

export const M42OutputSchema = z.object({
  marketingIQ: z.number().min(0).max(100),
  overallTrafficLight: TrafficLightSchema,
  executiveSummary: z.string().min(100).max(2000),
  categories: z.array(CategoryScoreSchema).min(5).max(15),
  topStrengths: z.array(z.string()).min(1).max(5),
  topWeaknesses: z.array(z.string()).min(1).max(5),
  competitivePosition: z.string().min(50).max(500),
  generatedAt: z.string().datetime(),
});

export type M42Output = z.infer<typeof M42OutputSchema>;
```

**Schema validation test pattern:**

```typescript
// packages/types/src/schemas/__tests__/m42-schema.test.ts
import { describe, it, expect } from 'vitest';
import { M42OutputSchema } from '../m42-final-synthesis';

describe('M42 Output Schema Validation', () => {
  it('should accept a valid complete output', () => {
    const valid = {
      marketingIQ: 75,
      overallTrafficLight: 'yellow',
      executiveSummary: 'A'.repeat(100),
      categories: [{
        category: 'Analytics',
        score: 80,
        trafficLight: 'green',
        summary: 'Strong analytics implementation with GA4 and GTM.',
        topFindings: ['GA4 properly configured'],
        recommendations: [{
          action: 'Implement server-side tagging',
          priority: 'medium',
          effort: 'moderate',
          impact: 'Improved data accuracy',
        }],
      }],
      topStrengths: ['Comprehensive analytics'],
      topWeaknesses: ['Missing DMARC policy'],
      competitivePosition: 'X'.repeat(50),
      generatedAt: '2025-06-15T14:30:00.000Z',
    };

    expect(M42OutputSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject marketingIQ outside 0-100', () => {
    const invalid = { marketingIQ: 150 };
    const result = M42OutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty recommendations', () => {
    const invalid = {
      categories: [{
        recommendations: [], // Must have at least 1
      }],
    };
    const result = M42OutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject summary shorter than 100 chars', () => {
    const result = M42OutputSchema.safeParse({
      executiveSummary: 'Too short',
    });
    expect(result.success).toBe(false);
  });
});
```

### 5.5 Cost Estimation for Golden Dataset Suite

**Per-run cost calculation (10 sites, Gemini API, February 2026 pricing):**

| Module | Model | Avg Input Tokens | Avg Output Tokens | Per-Site Cost | x10 Sites |
|--------|-------|-----------------|-------------------|---------------|-----------|
| M41 (x12 parallel) | Gemini 2.5 Flash | 3,000 per call | 1,500 per call | $0.0054 + $0.0108 = $0.016 | $0.16 |
| M42 | Gemini 2.5 Pro | 15,000 | 5,000 | $0.01875 + $0.05 = $0.069 | $0.69 |
| M43 | Gemini 2.5 Pro | 12,000 | 8,000 | $0.015 + $0.08 = $0.095 | $0.95 |
| M44 | Gemini 2.5 Flash | 5,000 | 3,000 | $0.00075 + $0.0018 = $0.003 | $0.03 |
| M45 | Gemini 2.5 Flash | 4,000 | 2,000 | $0.0006 + $0.0012 = $0.002 | $0.02 |
| M46 | Gemini 2.5 Flash | 8,000 | 2,000 | $0.0012 + $0.0012 = $0.002 | $0.02 |

**Total per golden dataset run: ~$1.87**

**Monthly budget at weekly runs: ~$7.50/month**

**Cost-saving strategies:**
- Cache golden dataset inputs so you never re-run M01-M40 against live sites (those are free to replay from fixtures).
- Use `describe.skipIf(!process.env.RUN_GOLDEN)` so golden tests don't run on every PR -- only on `main` merge or manual trigger.
- Use Gemini's batch API for 50% cost reduction when running the full suite (non-interactive, results in ~24 hours).

---

## 6. E2E Testing

### 6.1 Critical User Journeys

Prioritized by business impact and fragility:

| Priority | Journey | Modules Exercised | Estimated Duration |
|----------|---------|-------------------|-------------------|
| **P0** | Anonymous scan: enter URL -> see progress -> view free report | Scan form, SSE stream, BullMQ, all 46 modules, Supabase write, results rendering | 60-90s (scan takes time) |
| **P0** | Registration: email signup -> verification -> login | Supabase Auth, Resend email, auth state persistence | 15s |
| **P0** | Payment: view scan -> click buy report -> Stripe checkout -> receive report | Stripe Checkout, webhook handler, Supabase entitlement update | 20s |
| **P1** | AI Chat: paid user -> open chat -> ask question -> receive streamed answer | Gemini API, SSE streaming, message history | 15s |
| **P1** | Mobile scan flow: same as anonymous scan on mobile viewport | Responsive layout, touch interactions | 60-90s |
| **P2** | Report download: paid user -> download PDF/print view | PDF generation, print CSS | 10s |
| **P2** | Returning user: login -> view past scans -> select one -> view report | Auth persistence, Supabase queries, list rendering | 10s |

### 6.2 Playwright E2E Test Structure

```
e2e/
├── fixtures/
│   ├── test-urls.ts               # URLs to scan in E2E (use stable sites)
│   └── test-users.ts              # Test account credentials
├── pages/                         # Page Object Models
│   ├── home.page.ts
│   ├── scan.page.ts
│   ├── results.page.ts
│   ├── auth.page.ts
│   ├── checkout.page.ts
│   └── chat.page.ts
├── auth.setup.ts                  # Auth state setup (runs once)
├── anonymous-scan.spec.ts
├── registration.spec.ts
├── payment.spec.ts
├── ai-chat.spec.ts
├── mobile.spec.ts
└── visual-regression.spec.ts
```

**Page Object Model example:**

```typescript
// e2e/pages/scan.page.ts
import type { Page, Locator } from '@playwright/test';

export class ScanPage {
  readonly page: Page;
  readonly urlInput: Locator;
  readonly scanButton: Locator;
  readonly progressBar: Locator;
  readonly phaseIndicators: Locator;
  readonly moduleCards: Locator;
  readonly marketingIQScore: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.urlInput = page.getByPlaceholder(/enter.*url/i);
    this.scanButton = page.getByRole('button', { name: /scan|analyze/i });
    this.progressBar = page.getByRole('progressbar');
    this.phaseIndicators = page.locator('[data-testid="phase-indicator"]');
    this.moduleCards = page.locator('[data-testid="module-card"]');
    this.marketingIQScore = page.locator('[data-testid="marketing-iq"]');
    this.errorMessage = page.locator('[data-testid="scan-error"]');
  }

  async submitUrl(url: string) {
    await this.urlInput.fill(url);
    await this.scanButton.click();
  }

  async waitForScanComplete(timeout = 120_000) {
    await this.marketingIQScore.waitFor({
      state: 'visible',
      timeout,
    });
  }

  async getProgress(): Promise<number> {
    const value = await this.progressBar.getAttribute('aria-valuenow');
    return parseInt(value || '0', 10);
  }

  async getCompletedModuleCount(): Promise<number> {
    return this.moduleCards.filter({ has: this.page.locator('.status-complete') }).count();
  }
}
```

**Anonymous scan E2E test:**

```typescript
// e2e/anonymous-scan.spec.ts
import { test, expect } from '@playwright/test';
import { ScanPage } from './pages/scan.page';

test.describe('Anonymous Scan Flow', () => {
  test('should complete a full scan and show results', async ({ page }) => {
    const scanPage = new ScanPage(page);

    // Navigate to home
    await page.goto('/');

    // Submit a URL
    await scanPage.submitUrl('https://example.com');

    // Should navigate to scan progress page
    await expect(page).toHaveURL(/\/scan\/[a-z0-9-]+/);

    // Progress should start updating
    await expect(scanPage.progressBar).toBeVisible({ timeout: 10_000 });

    // Wait for phase 1 to complete (passive modules -- fast)
    await expect(scanPage.phaseIndicators.nth(0)).toHaveAttribute(
      'data-status', 'complete',
      { timeout: 30_000 }
    );

    // Wait for full scan completion (up to 2 minutes)
    await scanPage.waitForScanComplete(120_000);

    // MarketingIQ score should be visible
    await expect(scanPage.marketingIQScore).toBeVisible();
    const scoreText = await scanPage.marketingIQScore.textContent();
    const score = parseInt(scoreText || '0', 10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);

    // Module cards should be rendered
    const moduleCount = await scanPage.moduleCards.count();
    expect(moduleCount).toBeGreaterThanOrEqual(20); // At least 20 modules visible
  });

  test('should handle invalid URL gracefully', async ({ page }) => {
    const scanPage = new ScanPage(page);

    await page.goto('/');
    await scanPage.submitUrl('not-a-url');

    await expect(scanPage.errorMessage).toBeVisible();
    await expect(scanPage.errorMessage).toContainText(/valid url/i);
  });

  test('should handle unreachable site gracefully', async ({ page }) => {
    const scanPage = new ScanPage(page);

    await page.goto('/');
    await scanPage.submitUrl('https://this-domain-does-not-exist-12345.com');

    // Should show an error after initial checks fail
    await expect(scanPage.errorMessage).toBeVisible({ timeout: 30_000 });
  });
});
```

### 6.3 Test Environment Setup

**Strategy: Use a dedicated staging environment deployed alongside production.**

| Environment | Purpose | Data | External APIs |
|-------------|---------|------|---------------|
| **Local dev** | Developer runs E2E manually | Local Supabase, local Redis | MSW intercepts OR real APIs (developer choice) |
| **CI staging** | GitHub Actions E2E | Dedicated Supabase test project, Testcontainers Redis | MSW intercepts (zero external cost) |
| **Production smoke** | Post-deploy verification (manual, not automated) | Production Supabase (read-only test user) | Real APIs |

**For CI E2E, mock the engine's external dependencies:**

The E2E tests hit the real Next.js frontend and real Fastify engine, but the engine's outbound calls (DataForSEO, Gemini, etc.) are intercepted by MSW running inside the engine process. This gives you realistic full-stack testing without API costs.

```typescript
// apps/engine/src/test-mode.ts
// Conditionally enable MSW in the engine when TEST_MODE=true
if (process.env.TEST_MODE === 'true') {
  const { server } = await import('../test/mocks/server');
  server.listen({ onUnhandledRequest: 'bypass' });
  console.log('[TEST_MODE] MSW intercepting external API calls');
}
```

### 6.4 Visual Regression Testing

Use Playwright's built-in `toHaveScreenshot()`. No external service needed.

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage should match baseline', async ({ page }) => {
    await page.goto('/');
    // Wait for animations to settle
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('homepage.png', {
      maxDiffPixelRatio: 0.01, // Allow 1% pixel difference (font rendering)
      fullPage: true,
    });
  });

  test('scan results page should match baseline', async ({ page }) => {
    // Navigate to a known completed scan (seeded in test DB)
    await page.goto('/scan/test-completed-scan-id');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('scan-results.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test('mobile homepage should match baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await page.goto('/');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
```

**Workflow for updating baselines:**
```bash
# Generate new baselines after intentional UI changes
npx playwright test visual-regression --update-snapshots

# Commit the updated screenshots
git add e2e/visual-regression.spec.ts-snapshots/
git commit -m "chore: update visual regression baselines"
```

Screenshots are stored in `e2e/<spec-name>-snapshots/` and committed to git. Small binary files (~50-200 KB each). Use `.gitattributes` to mark them as binary:

```
e2e/**/*.png binary
```

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# Cancel in-progress runs for the same PR
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'

jobs:
  # ─────────────────────────────────────────
  # Stage 1: Lint + Type Check (fast, cheap)
  # Runs on EVERY PR push. ~1-2 min.
  # ─────────────────────────────────────────
  lint-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck  # tsc --noEmit across all workspaces

  # ─────────────────────────────────────────
  # Stage 2: Unit Tests (parallel per workspace)
  # Runs on EVERY PR push. ~2-4 min.
  # ─────────────────────────────────────────
  unit-tests:
    name: Unit Tests (${{ matrix.workspace }})
    runs-on: ubuntu-latest
    needs: lint-typecheck
    strategy:
      fail-fast: false
      matrix:
        workspace: [engine, web, types]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.workspace }} run test:unit -- --reporter=github-actions
      - name: Upload coverage
        if: matrix.workspace == 'engine'
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.workspace }}
          path: apps/${{ matrix.workspace }}/coverage/

  # ─────────────────────────────────────────
  # Stage 3: Integration Tests (needs Docker)
  # Runs on EVERY PR push. ~3-5 min.
  # ─────────────────────────────────────────
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: lint-typecheck
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Use GitHub service Redis instead of Testcontainers in CI
      # (avoids Docker-in-Docker overhead)
      - run: pnpm --filter engine run test:integration
        env:
          REDIS_URL: redis://localhost:6379
          SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}

  # ─────────────────────────────────────────
  # Stage 4: E2E Tests (only on main merge)
  # Runs ONLY on push to main. ~5-10 min.
  # ─────────────────────────────────────────
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium

      - name: Build apps
        run: pnpm run build

      - name: Run E2E tests
        run: npx playwright test --project=chromium
        env:
          E2E_BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_MODE: 'true'

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # ─────────────────────────────────────────
  # Stage 5: Golden Dataset (weekly cron only)
  # Runs ONLY on weekly schedule. ~5 min + API costs.
  # ─────────────────────────────────────────
  golden-dataset:
    name: AI Golden Dataset Regression
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter engine run test:golden
        env:
          RUN_GOLDEN: 'true'
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      - name: Upload golden results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: golden-dataset-results
          path: apps/engine/test/golden/results/
```

**Cron trigger for golden dataset (separate workflow or add to above):**

```yaml
# .github/workflows/golden-dataset.yml
name: Golden Dataset Regression

on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6 AM UTC
  workflow_dispatch: {}    # Manual trigger

jobs:
  golden-dataset:
    # ... (same as above Stage 5)
```

### 7.2 Test Parallelization Strategy

| Stage | Parallelization | CI Minutes (est.) | Runs On |
|-------|----------------|-------------------|---------|
| Lint + Type Check | Single job | ~2 min | Every PR push |
| Unit Tests | 3 parallel jobs (engine/web/types) | ~3 min (longest leg) | Every PR push |
| Integration Tests | Single job (Redis service) | ~4 min | Every PR push |
| E2E Tests | 1 browser (Chromium only in CI) | ~8 min | Main merge only |
| Golden Dataset | 1 job, sequential | ~5 min | Weekly cron |

**Total CI minutes per PR:** ~9 min (Lint + Unit parallel with Integration)

**Monthly CI budget (assuming 50 PRs/month + 4 main merges + 4 golden runs):**
- PR runs: 50 x 9 min = 450 min
- Main merges: 4 x 17 min = 68 min
- Golden dataset: 4 x 5 min = 20 min
- **Total: ~538 min/month**

GitHub Free tier provides **2,000 min/month** for private repos. This strategy uses ~27% of the free allocation. Plenty of headroom.

### 7.3 When to Run What

| Trigger | Lint | Type Check | Unit | Integration | E2E | Golden | Visual Reg |
|---------|------|-----------|------|-------------|-----|--------|------------|
| PR push | Yes | Yes | Yes | Yes | No | No | No |
| PR merge to main | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Weekly cron | No | No | No | No | No | Yes | No |
| Manual dispatch | Configurable | Configurable | Configurable | Configurable | Configurable | Configurable | Configurable |

---

## 8. Test Data Management

### 8.1 Fixture Generation and Maintenance

**Recording real responses for fixtures:**

```typescript
// apps/engine/scripts/record-fixtures.ts
// Run manually: npx tsx scripts/record-fixtures.ts --domain hubspot.com
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import dns from 'node:dns/promises';

async function recordDnsFixture(domain: string) {
  const fixtureDir = join(import.meta.dirname, '../test/fixtures/dns');
  await mkdir(fixtureDir, { recursive: true });

  const fixture = {
    domain,
    recordedAt: new Date().toISOString(),
    txt: await dns.resolveTxt(domain).catch(() => []),
    mx: await dns.resolveMx(domain).catch(() => []),
    ns: await dns.resolveNs(domain).catch(() => []),
    a: await dns.resolve4(domain).catch(() => []),
    aaaa: await dns.resolve6(domain).catch(() => []),
    cname: await dns.resolveCname(domain).catch(() => []),
    dmarcTxt: await dns.resolveTxt(`_dmarc.${domain}`).catch(() => []),
  };

  await writeFile(
    join(fixtureDir, `${domain}.json`),
    JSON.stringify(fixture, null, 2),
  );

  console.log(`Recorded DNS fixture for ${domain}`);
}

// Main
const domain = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
  || 'example.com';
await recordDnsFixture(domain);
```

**Fixture staleness policy:**
- DNS/HTTP fixtures: Re-record **quarterly**. Websites change their headers and DNS records infrequently.
- Network traffic fixtures: Re-record **monthly**. Ad tech and analytics scripts update their URLs and payloads more frequently.
- Gemini response fixtures: Re-record when **prompt templates change** or **model version changes**.
- Golden dataset: Re-validate **quarterly** with a full live run.

### 8.2 Seed Data for Supabase

```sql
-- supabase/seed.sql
-- Run via: supabase db reset (applies migrations + seed)

-- Test users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'free@test.com', crypt('testpass123', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'paid@test.com', crypt('testpass123', gen_salt('bf')), now(), now(), now());

-- Test user profiles
INSERT INTO public.profiles (id, email, full_name, plan)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'free@test.com', 'Free Test User', 'free'),
  ('00000000-0000-0000-0000-000000000002', 'paid@test.com', 'Paid Test User', 'paid');

-- Completed test scan (for E2E tests that need pre-existing data)
INSERT INTO public.scans (id, url, domain, status, user_id, marketing_iq, created_at, completed_at)
VALUES
  ('test-completed-scan-id', 'https://example.com', 'example.com', 'complete',
   '00000000-0000-0000-0000-000000000001', 72, now() - interval '1 hour', now());

-- Module results for the completed scan
INSERT INTO public.scan_modules (scan_id, module_id, status, data, created_at)
VALUES
  ('test-completed-scan-id', 'M01', 'success', '{"spf":{"exists":true}}'::jsonb, now()),
  ('test-completed-scan-id', 'M02', 'success', '{"cms":"WordPress"}'::jsonb, now());
  -- ... truncated for brevity
```

### 8.3 Mock Server Approach: MSW

**Decision: MSW v2, not custom mock servers.**

MSW operates at the network level (intercepting `fetch`/`http`/`https` in Node.js, Service Worker in browser), which means:

1. Your application code doesn't know it's being mocked. No dependency injection required.
2. Handlers are composable and overridable per-test.
3. One handler set works for both Vitest (Node.js) and Playwright E2E (browser).

**Handler organization:**

```typescript
// apps/engine/test/mocks/handlers.ts
import { dataForSeoHandlers } from './dataforseo-handlers';
import { geminiHandlers } from './gemini-handlers';
import { googleAdsHandlers } from './google-ads-handlers';
import { resendHandlers } from './resend-handlers';

export const handlers = [
  ...dataForSeoHandlers,
  ...geminiHandlers,
  ...googleAdsHandlers,
  ...resendHandlers,
];
```

```typescript
// apps/engine/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

**Per-test handler override:**

```typescript
it('should handle DataForSEO rate limiting', async () => {
  // Override the default handler for this single test
  server.use(
    http.post('https://api.dataforseo.com/v3/*', () => {
      return new HttpResponse(null, { status: 429 });
    })
  );

  const result = await executeM25(ctx);
  expect(result.status).toBe('error');
  expect(result.errors).toContain('Rate limited by DataForSEO');
});
```

### 8.4 Network Recording for Playwright Tests

For E2E tests that need realistic network data without hitting real APIs, use Playwright's HAR recording:

```typescript
// Record a HAR file of a real scan (run manually once)
// npx playwright test --project=chromium e2e/record-har.spec.ts

// e2e/record-har.spec.ts
import { test } from '@playwright/test';

test('record scan HAR', async ({ page }) => {
  await page.routeFromHAR('e2e/fixtures/scan-example.com.har', {
    update: true, // Record mode
    url: /api\.dataforseo\.com|generativelanguage\.googleapis\.com/,
  });

  await page.goto('/');
  // ... perform scan flow
});
```

Then in actual E2E tests, replay from HAR:

```typescript
test('scan with recorded network data', async ({ page }) => {
  await page.routeFromHAR('e2e/fixtures/scan-example.com.har', {
    update: false, // Replay mode
    url: /api\.dataforseo\.com|generativelanguage\.googleapis\.com/,
  });

  // Test runs against pre-recorded API responses
  // Zero external API calls, zero cost, deterministic
});
```

---

## 9. Coverage Targets

### 9.1 Realistic Targets Per Layer

| Layer | Target | Rationale |
|-------|--------|-----------|
| **Engine module parsers** (SPF, DMARC, header analysis, cookie classification, tech detection heuristics) | **85% line, 75% branch** | These are the core value proposition. Parsing logic is deterministic and highly testable. Bugs here directly produce wrong scan results. |
| **Engine module executors** (M01-M40 main functions) | **70% line, 60% branch** | High value but many code paths depend on real browser state that's hard to fully mock. |
| **Engine infrastructure** (queue, worker, middleware, DB client) | **60% line, 50% branch** | Integration tests cover this more meaningfully than unit tests. |
| **Frontend components** | **60% line, 50% branch** | Test interactive components (forms, modals, cards). Don't test purely visual components. |
| **Frontend hooks** | **75% line, 65% branch** | Custom hooks contain business logic. Worth testing thoroughly. |
| **Frontend utilities** | **80% line, 70% branch** | Pure functions. Easy to test. |
| **Shared types/schemas** | **90% line, 85% branch** | Zod schemas are critical contracts. Test validation edge cases exhaustively. |
| **E2E** | **P0 journeys: 100%, P1: 80%, P2: 50%** | Cover all critical paths. Don't try to E2E test every edge case. |

### 9.2 What NOT to Test (Diminishing Returns)

**Do not unit test:**
- Playwright's own API behavior (e.g., "does `page.goto` actually navigate"). Trust the library.
- CSS/styling (use visual regression E2E instead).
- Supabase query builder chain correctness (test at integration level against real DB).
- BullMQ's internal job lifecycle (test at integration level with real Redis).
- Third-party component libraries (shadcn/ui, Recharts). Test your usage, not their internals.
- Server Components that are purely data-fetching wrappers. Test the data-fetching function instead.

**Do not integration test:**
- Every possible DNS record combination (use property-based tests for parser robustness instead).
- Every DataForSEO API endpoint in isolation. Test the module that consumes it.
- Stripe's checkout UI (mock the session creation, trust Stripe handles the rest).

**Do not E2E test:**
- Admin/debug pages.
- Error pages (test with unit tests on error boundary components).
- Every possible scan result permutation. Test one happy path and one error path.
- Browser compatibility beyond Chromium in CI (run Firefox/WebKit locally before release if needed).

### 9.3 Critical Path Coverage Priorities

In order of investment priority:

1. **Module output schema validation** (Zod tests) -- Prevents frontend crashes from unexpected data shapes. Cost: 1 hour. Value: Prevents every "cannot read property of undefined" error.

2. **Phase 1 module parsers** (SPF, DMARC, CSP, header analysis) -- Pure functions, highest ROI for testing. These run on every scan and errors are immediately visible to users. Cost: 4 hours. Value: Correctness of the core product.

3. **SSE stream consumer** (frontend hook) -- The real-time scan experience. If this breaks, the product feels broken even if the engine works fine. Cost: 2 hours. Value: User experience integrity.

4. **HMAC auth + rate limiting middleware** -- Security-critical. A bug here either blocks legitimate users or allows abuse. Cost: 1 hour. Value: Security.

5. **BullMQ worker lifecycle** (integration) -- Job processing reliability. A bug here means scans silently fail. Cost: 2 hours. Value: Reliability.

6. **AI schema validation** (Zod for M41-M46) -- AI outputs are inherently variable. Schema validation is the safety net that ensures the frontend always receives renderable data. Cost: 2 hours. Value: AI output reliability.

7. **Anonymous scan E2E** -- The entire product funnel. If a new user can't submit a URL and see results, nothing else matters. Cost: 3 hours. Value: Revenue.

**Total estimated initial test implementation time: ~15 hours** for the highest-priority tests. This covers >80% of the critical path risk with minimal investment.

---

## Appendix A: Package.json Scripts

```jsonc
// Root package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "playwright test visual-regression",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc -b"
  }
}

// apps/engine/package.json
{
  "scripts": {
    "test:unit": "vitest run --project engine",
    "test:integration": "vitest run --project engine --testPathPattern integration",
    "test:golden": "RUN_GOLDEN=true vitest run --project engine --testPathPattern golden"
  }
}

// apps/web/package.json
{
  "scripts": {
    "test:unit": "vitest run --project web"
  }
}
```

---

## Appendix B: Directory Structure Summary

```
/
├── vitest.config.ts                    # Root orchestrator
├── playwright.config.ts                # E2E config
├── .github/workflows/ci.yml           # CI pipeline
├── apps/
│   ├── engine/
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   └── modules/
│   │   │       ├── m01-dns-security/
│   │   │       │   ├── index.ts
│   │   │       │   ├── parsers.ts
│   │   │       │   ├── schema.ts
│   │   │       │   └── __tests__/
│   │   │       │       ├── m01.test.ts
│   │   │       │       ├── m01.prop.test.ts
│   │   │       │       └── parsers.test.ts
│   │   │       └── ...
│   │   └── test/
│   │       ├── setup.ts
│   │       ├── mocks/
│   │       │   ├── server.ts
│   │       │   ├── handlers.ts
│   │       │   ├── mock-page.ts
│   │       │   ├── mock-network-collector.ts
│   │       │   ├── mock-supabase.ts
│   │       │   ├── dataforseo-handlers.ts
│   │       │   └── gemini-handlers.ts
│   │       ├── fixtures/
│   │       │   ├── loader.ts
│   │       │   ├── dns/
│   │       │   ├── http/
│   │       │   ├── network/
│   │       │   ├── dataforseo/
│   │       │   ├── gemini/
│   │       │   └── golden/
│   │       └── integration/
│   │           ├── queue-lifecycle.test.ts
│   │           ├── full-pipeline.test.ts
│   │           └── hmac-auth.test.ts
│   └── web/
│       ├── vitest.config.ts
│       └── test/
│           ├── setup.ts
│           └── mocks/
│               ├── supabase-auth.ts
│               └── posthog.ts
├── packages/
│   └── types/
│       ├── vitest.config.ts
│       └── src/schemas/
│           ├── m01-output.ts
│           ├── m42-final-synthesis.ts
│           └── __tests__/
│               └── m42-schema.test.ts
├── e2e/
│   ├── fixtures/
│   ├── pages/
│   ├── auth.setup.ts
│   ├── anonymous-scan.spec.ts
│   ├── registration.spec.ts
│   ├── payment.spec.ts
│   └── visual-regression.spec.ts
└── supabase/
    └── seed.sql
```
