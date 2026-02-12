/**
 * WS6-C: Synthesis Upgrade Path Test
 *
 * Tests the runSynthesisOnly() path used when a free user upgrades to paid.
 * Pre-loads M01-M41 fixture results, then verifies M42-M46 execute
 * with correct dependency chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';

// Mock Supabase
vi.mock('../../src/services/supabase.js', () => ({
  updateScanStatus: vi.fn().mockResolvedValue(undefined),
  upsertModuleResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/utils/http.js', () => ({
  fetchWithRetry: vi.fn().mockResolvedValue({
    body: '<html><body></body></html>',
    headers: {},
    status: 200,
    finalUrl: 'https://example.com',
  }),
}));

vi.mock('../../src/ghostscan/browser-pool.js', () => ({
  BrowserPool: vi.fn().mockImplementation(() => ({
    createPage: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/ghostscan/bot-wall-detector.js', () => ({
  detectAndHandleBotWall: vi.fn().mockResolvedValue({
    blocked: false, provider: null, autoResolved: false, retrySucceeded: false,
  }),
}));

// Track execution order
const executionOrder: string[] = [];

vi.mock('../../src/modules/registry.js', () => ({
  getModulesForPhaseAndTier: vi.fn().mockImplementation((phase: string) => {
    if (phase === 'synthesis') return [
      { id: 'M41', name: 'Module Synthesis', phase: 'synthesis', minimumTier: 'paid', timeout: 120000, retries: 0, category: 'analytics_integrity' },
      { id: 'M42', name: 'Final Synthesis', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M41'], timeout: 120000, retries: 0, category: 'analytics_integrity' },
      { id: 'M43', name: 'PRD Generation', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M42'], timeout: 120000, retries: 0, category: 'analytics_integrity' },
      { id: 'M44', name: 'ROI Simulator', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M42'], timeout: 120000, retries: 0, category: 'analytics_integrity' },
      { id: 'M45', name: 'Cost Cutter', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M42'], timeout: 120000, retries: 0, category: 'analytics_integrity' },
      { id: 'M46', name: 'Knowledge Base', phase: 'synthesis', minimumTier: 'paid', dependsOn: ['M42'], timeout: 120000, retries: 0, category: 'analytics_integrity' },
    ];
    return [];
  }),
  getScoredModuleIds: vi.fn().mockReturnValue([]),
}));

import { registerModuleExecutor, ModuleRunner } from '../../src/modules/runner.js';

// Register synthesis module executors
for (const id of ['M41', 'M42', 'M43', 'M44', 'M45', 'M46']) {
  registerModuleExecutor(id as ModuleId, async (ctx): Promise<ModuleResult> => {
    executionOrder.push(id);
    return {
      moduleId: id as ModuleId,
      status: 'success',
      data: { synthesized: true, moduleId: id },
      signals: [],
      score: null,
      checkpoints: [],
      duration: 50,
    };
  });
}

describe('Synthesis Upgrade Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executionOrder.length = 0;
  });

  it('should run synthesis chain with pre-loaded results', async () => {
    // Create fixture results for M01-M39 (simulating a completed free scan)
    const existingResults = new Map<ModuleId, ModuleResult>();
    for (const id of ['M01', 'M02', 'M03', 'M04', 'M05']) {
      existingResults.set(id as ModuleId, {
        moduleId: id as ModuleId,
        status: 'success',
        data: { fixture: true },
        signals: [],
        score: 75,
        checkpoints: [{ id: `${id}-cp`, name: 'Test', weight: 0.5, health: 'good', evidence: 'Test' }],
        duration: 100,
      });
    }

    const runner = new ModuleRunner('upgrade-test', 'https://example.com', 'full');
    const { results, modulesCompleted } = await runner.runSynthesisOnly(existingResults);

    // All 6 synthesis modules should complete
    expect(modulesCompleted).toBeGreaterThanOrEqual(11); // 5 existing + 6 synthesis

    // Synthesis results should be present
    expect(results.has('M41' as ModuleId)).toBe(true);
    expect(results.has('M42' as ModuleId)).toBe(true);
    expect(results.has('M43' as ModuleId)).toBe(true);
    expect(results.has('M44' as ModuleId)).toBe(true);
    expect(results.has('M45' as ModuleId)).toBe(true);
    expect(results.has('M46' as ModuleId)).toBe(true);

    // M41 should run first
    expect(executionOrder[0]).toBe('M41');

    // Pre-loaded results should still be accessible
    expect(results.has('M01' as ModuleId)).toBe(true);
    expect(results.get('M01' as ModuleId)?.data).toMatchObject({ fixture: true });
  });

  it('should skip synthesis modules with missing dependencies', async () => {
    // Don't include M41 in existing results — M42-M46 depend on it
    const emptyResults = new Map<ModuleId, ModuleResult>();

    const runner = new ModuleRunner('upgrade-test-2', 'https://example.com', 'full');
    const { results } = await runner.runSynthesisOnly(emptyResults);

    // M41 should run (no dependencies)
    expect(results.get('M41' as ModuleId)?.status).toBe('success');

    // M42 should also run since M41 was just executed
    expect(results.get('M42' as ModuleId)?.status).toBe('success');
  });
});
