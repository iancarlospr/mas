/**
 * WS6-B: Passive Retry Integration Test
 *
 * Simulates the scenario where initial HTTP fetch fails (403)
 * but browser navigation succeeds. Verifies:
 * - Passive modules fail on initial run
 * - retryFailedPassiveModules() re-runs them with browser HTML
 * - Re-run succeeds with the browser-rendered HTML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleId, ModuleResult, ModuleContext } from '../../src/modules/types.js';

// Track how many times each module is called
const callCounts: Record<string, number> = {};

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  updateScanStatus: vi.fn().mockResolvedValue(undefined),
  upsertModuleResult: vi.fn().mockResolvedValue(undefined),
}));

// Mock HTTP fetch — returns 403 (simulating bot block)
vi.mock('../../src/utils/http.js', () => ({
  fetchWithRetry: vi.fn().mockRejectedValue(new Error('HTTP 403 Forbidden')),
}));

// Mock browser pool
vi.mock('../../src/ghostscan/browser-pool.js', () => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(null),
    content: vi.fn().mockResolvedValue('<html><head><title>Works</title></head><body><h1>Real Content</h1><p>Paragraph</p></body></html>'),
    title: vi.fn().mockResolvedValue('Works'),
    url: vi.fn().mockReturnValue('https://etsy-like.example.com'),
    evaluate: vi.fn().mockResolvedValue(undefined),
    evaluateHandle: vi.fn().mockResolvedValue({ jsonValue: vi.fn().mockResolvedValue({}), dispose: vi.fn() }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0), all: vi.fn().mockResolvedValue([]) }),
    waitForSelector: vi.fn().mockResolvedValue(null),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    route: vi.fn().mockResolvedValue(undefined),
    context: vi.fn().mockReturnValue({ cookies: vi.fn().mockResolvedValue([]) }),
    close: vi.fn().mockResolvedValue(undefined),
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    viewportSize: vi.fn().mockReturnValue({ width: 1440, height: 900 }),
    mouse: { move: vi.fn(), click: vi.fn(), wheel: vi.fn() },
    isClosed: vi.fn().mockReturnValue(false),
  };

  return {
    BrowserPool: vi.fn().mockImplementation(() => ({
      createPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockReturnValue(true),
    })),
  };
});

// Mock bot wall detector
vi.mock('../../src/ghostscan/bot-wall-detector.js', () => ({
  detectAndHandleBotWall: vi.fn().mockResolvedValue({
    blocked: false, provider: null, autoResolved: false, retrySucceeded: false,
  }),
}));

// Mock registry — only passive + browser modules
vi.mock('../../src/modules/registry.js', () => ({
  getModulesForPhaseAndTier: vi.fn().mockImplementation((phase: string) => {
    if (phase === 'passive') return [
      { id: 'M04', name: 'Page Metadata', phase: 'passive', minimumTier: 'full', timeout: 30000, retries: 0, category: 'seo_content' },
    ];
    if (phase === 'browser') return [
      { id: 'M03', name: 'Performance', phase: 'browser', minimumTier: 'full', timeout: 60000, retries: 0, category: 'performance_ux' },
    ];
    return [];
  }),
  getScoredModuleIds: vi.fn().mockReturnValue(['M03', 'M04']),
}));

import { registerModuleExecutor, ModuleRunner } from '../../src/modules/runner.js';

// M04: Fails when html is null, succeeds when html is present
registerModuleExecutor('M04' as ModuleId, async (ctx: ModuleContext): Promise<ModuleResult> => {
  callCounts['M04'] = (callCounts['M04'] ?? 0) + 1;

  if (!ctx.html) {
    return {
      moduleId: 'M04' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'No HTML available',
    };
  }

  return {
    moduleId: 'M04' as ModuleId,
    status: 'success',
    data: { title: { content: 'Works', length: 5 } },
    signals: [],
    score: 80,
    checkpoints: [{ id: 'm04-title', name: 'Title', weight: 0.3, health: 'good', evidence: 'Title present' }],
    duration: 50,
  };
});

// M03: Always succeeds (browser module)
registerModuleExecutor('M03' as ModuleId, async (): Promise<ModuleResult> => ({
  moduleId: 'M03' as ModuleId,
  status: 'success',
  data: { test: true },
  signals: [],
  score: 70,
  checkpoints: [],
  duration: 100,
}));

describe('Passive Module Retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callCounts['M04'] = 0;
  });

  it('should retry failed passive modules with browser HTML', async () => {
    const runner = new ModuleRunner('retry-test', 'https://etsy-like.example.com', 'full');
    const { results, modulesCompleted } = await runner.run();

    // M04 should have been called twice (initial fail + retry)
    expect(callCounts['M04']).toBe(2);

    // Final result should be success (from the retry with browser HTML)
    const m04Result = results.get('M04' as ModuleId);
    expect(m04Result).toBeDefined();
    expect(m04Result!.status).toBe('success');
    expect(m04Result!.score).toBe(80);

    // M03 should also succeed
    expect(results.get('M03' as ModuleId)?.status).toBe('success');

    // Both should be counted as completed
    expect(modulesCompleted).toBe(2);
  });
});
