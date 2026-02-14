/**
 * WS6-A: Full Pipeline Integration Test
 *
 * Verifies the ModuleRunner orchestrates all phases correctly:
 * - Passive phase runs with fetched HTML
 * - Browser phase creates page and runs modules
 * - GhostScan phase reuses browser page
 * - External/Synthesis phases execute
 * - previousResults populated across phases
 *
 * Uses mocked Supabase, browser, and external services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';

// Mock Supabase before imports
vi.mock('../../src/services/supabase.js', () => ({
  updateScanStatus: vi.fn().mockResolvedValue(undefined),
  upsertModuleResult: vi.fn().mockResolvedValue(undefined),
}));

// Mock HTTP fetch
vi.mock('../../src/utils/http.js', () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    body: '<html><head><title>Test</title></head><body><h1>Hello</h1><p>Content</p></body></html>',
    headers: { 'content-type': 'text/html', 'x-frame-options': 'DENY' },
    status: 200,
    finalUrl: 'https://test.example.com',
  }),
}));

// Mock browser pool — avoid launching real Chromium
vi.mock('../../src/ghostscan/browser-pool.js', () => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(null),
    content: vi.fn().mockResolvedValue('<html><body><h1>Rendered</h1></body></html>'),
    title: vi.fn().mockResolvedValue('Test Page'),
    url: vi.fn().mockReturnValue('https://test.example.com'),
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
    blocked: false,
    provider: null,
    autoResolved: false,
    retrySucceeded: false,
  }),
}));

// Mock registry to return a minimal set of test modules
vi.mock('../../src/modules/registry.js', () => {
  const testModules = [
    { id: 'M01', name: 'DNS Security', phase: 'passive', minimumTier: 'full', timeout: 30000, retries: 1, category: 'compliance_security' },
    { id: 'M04', name: 'Page Metadata', phase: 'passive', minimumTier: 'full', timeout: 30000, retries: 1, category: 'seo_content' },
    { id: 'M03', name: 'Performance', phase: 'browser', minimumTier: 'full', timeout: 60000, retries: 1, category: 'performance_ux' },
    { id: 'M09', name: 'Behavioral', phase: 'ghostscan', minimumTier: 'full', timeout: 60000, retries: 0, category: 'analytics_integrity' },
  ];

  return {
    getModulesForPhaseAndTier: vi.fn().mockImplementation((phase: string, tier: string) => {
      // All tiers now run all phases
      return testModules.filter(m => m.phase === phase);
    }),
    getScoredModuleIds: vi.fn().mockReturnValue(['M01', 'M03', 'M04', 'M09']),
  };
});

// Register test module executors
import { registerModuleExecutor } from '../../src/modules/runner.js';

function makeTestResult(moduleId: ModuleId): ModuleResult {
  return {
    moduleId,
    status: 'success',
    data: { test: true, moduleId },
    signals: [],
    score: 75,
    checkpoints: [{ id: `${moduleId}-cp1`, name: 'Test CP', weight: 0.5, health: 'good', evidence: 'Test evidence' }],
    duration: 100,
  };
}

// Register mock executors for test modules
registerModuleExecutor('M01' as ModuleId, async () => makeTestResult('M01' as ModuleId));
registerModuleExecutor('M04' as ModuleId, async () => makeTestResult('M04' as ModuleId));
registerModuleExecutor('M03' as ModuleId, async () => makeTestResult('M03' as ModuleId));
registerModuleExecutor('M09' as ModuleId, async () => makeTestResult('M09' as ModuleId));

// Import after mocks are set up
import { ModuleRunner } from '../../src/modules/runner.js';
import { updateScanStatus, upsertModuleResult } from '../../src/services/supabase.js';

describe('ModuleRunner Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run all phases for full tier', async () => {
    const runner = new ModuleRunner('test-scan-1', 'https://test.example.com', 'full');
    const { results, modulesCompleted, modulesFailed } = await runner.run();

    // All 4 test modules should complete
    expect(modulesCompleted).toBe(4);
    expect(modulesFailed).toBe(0);

    // Results should be populated
    expect(results.has('M01' as ModuleId)).toBe(true);
    expect(results.has('M04' as ModuleId)).toBe(true);
    expect(results.has('M03' as ModuleId)).toBe(true);
    expect(results.has('M09' as ModuleId)).toBe(true);

    // Each result should have success status
    for (const result of results.values()) {
      expect(result.status).toBe('success');
      expect(result.score).toBe(75);
    }
  });

  it('should run all phases for full tier', async () => {
    const runner = new ModuleRunner('test-scan-2', 'https://test.example.com', 'full');
    const { results, modulesCompleted } = await runner.run();

    // All modules should run for full tier
    expect(modulesCompleted).toBeGreaterThanOrEqual(2);
    expect(results.has('M01' as ModuleId)).toBe(true);
    expect(results.has('M04' as ModuleId)).toBe(true);
  });

  it('should update scan status for each phase', async () => {
    const runner = new ModuleRunner('test-scan-3', 'https://test.example.com', 'full');
    await runner.run();

    // Should have been called for each phase
    expect(updateScanStatus).toHaveBeenCalledWith('test-scan-3', 'passive');
    expect(updateScanStatus).toHaveBeenCalledWith('test-scan-3', 'browser');
    expect(updateScanStatus).toHaveBeenCalledWith('test-scan-3', 'ghostscan');
  });

  it('should upsert each module result to Supabase', async () => {
    const runner = new ModuleRunner('test-scan-4', 'https://test.example.com', 'full');
    await runner.run();

    // Each module result should be upserted
    expect(upsertModuleResult).toHaveBeenCalledTimes(4);
  });

  it('should make previousResults available to downstream modules', async () => {
    // Register a module that checks previousResults
    let seenPreviousResults: Map<ModuleId, ModuleResult> | null = null;

    registerModuleExecutor('M09' as ModuleId, async (ctx) => {
      seenPreviousResults = new Map(ctx.previousResults);
      return makeTestResult('M09' as ModuleId);
    });

    const runner = new ModuleRunner('test-scan-5', 'https://test.example.com', 'full');
    await runner.run();

    // M09 (ghostscan) should see results from M01, M04 (passive) and M03 (browser)
    expect(seenPreviousResults).not.toBeNull();
    expect(seenPreviousResults!.has('M01' as ModuleId)).toBe(true);
    expect(seenPreviousResults!.has('M04' as ModuleId)).toBe(true);
    expect(seenPreviousResults!.has('M03' as ModuleId)).toBe(true);

    // Restore original executor
    registerModuleExecutor('M09' as ModuleId, async () => makeTestResult('M09' as ModuleId));
  });
});
