/**
 * Fix equitysolarpr.com scan:
 * 1. Patch M21 data: Facebook = 7 active ads, Google = 0 ads
 * 2. Re-run synthesis modules M42, M43, M45, M46
 *
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/fix-equitysolar.ts
 */
import { createClient } from '@supabase/supabase-js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';
import type { ModuleContext } from '../src/modules/types.js';

import { execute as m42Execute } from '../src/modules/synthesis/m42-final-synthesis.js';
import { execute as m43Execute } from '../src/modules/synthesis/m43-prd-generation.js';
import { execute as m45Execute } from '../src/modules/synthesis/m45-cost-cutter.js';
import { execute as m46Execute } from '../src/modules/synthesis/m46-boss-deck.js';

const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  // ─── Step 1: Patch M21 ───────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('STEP 1: Patching M21 data');
  console.log('═'.repeat(60));

  // Get current M21 data
  const { data: m21Row } = await sb
    .from('module_results')
    .select('data, checkpoints, signals')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M21')
    .single();

  if (!m21Row) { console.error('M21 not found'); process.exit(1); }

  const m21Data = m21Row.data as Record<string, any>;

  // Update Facebook: 7 active ads, search successful
  m21Data.facebook = {
    ...m21Data.facebook,
    totalAdsVisible: 7,
    searchSuccessful: true,
    ads: [], // no individual ad details scraped, but count is correct
  };

  // Google stays at 0 (already correct)
  m21Data.google = {
    ...m21Data.google,
    totalAdsVisible: 0,
    searchSuccessful: true,
  };

  // Update summary
  m21Data.summary = {
    totalImages: 0,
    facebookActive: true,
    googleSearchActive: false,
  };

  // Rebuild checkpoints to match the corrected data
  const newCheckpoints = [
    {
      id: 'm21-facebook',
      name: 'Facebook Ad Library',
      weight: 0.4,
      health: 'excellent',
      evidence: '7 active Facebook ads found',
      recommendation: undefined,
    },
    {
      id: 'm21-google-search',
      name: 'Google Search Ads',
      weight: 0.4,
      health: 'good',
      evidence: 'Google Ads Transparency search successful but no Search ads found',
      recommendation: 'Consider running Google Search ad campaigns for brand visibility',
    },
    {
      id: 'm21-multi-platform',
      name: 'Multi-Platform Advertising',
      weight: 0.2,
      health: 'good',
      evidence: 'Active on 1 platform: Facebook',
      recommendation: 'Diversify advertising across multiple platforms for broader reach',
    },
  ];

  // Rebuild signals
  const newSignals = [
    {
      type: 'facebook_ads_active',
      name: 'Facebook Ads Active',
      confidence: 0.9,
      evidence: '7 active ads found in Facebook Ad Library',
      category: 'paid_media',
    },
  ];

  // Upsert patched M21
  const { error: m21Err } = await sb
    .from('module_results')
    .upsert({
      scan_id: SCAN_ID,
      module_id: 'M21',
      status: 'success', // was 'partial', now both platforms searched successfully
      data: m21Data,
      checkpoints: newCheckpoints,
      signals: newSignals,
    }, { onConflict: 'scan_id,module_id' });

  if (m21Err) {
    console.error('M21 upsert failed:', m21Err.message);
    process.exit(1);
  }

  console.log('✅ M21 patched: Facebook=7 ads (active), Google=0 ads, status=success');

  // ─── Step 2: Load all module results for synthesis context ──────
  console.log('\n' + '═'.repeat(60));
  console.log('STEP 2: Loading all module results for synthesis context');
  console.log('═'.repeat(60));

  const { data: scan } = await sb
    .from('scans')
    .select('id, url, domain, tier')
    .eq('id', SCAN_ID)
    .single();

  if (!scan) { console.error('Scan not found'); process.exit(1); }

  const { data: results } = await sb
    .from('module_results')
    .select('module_id, status, score, data, checkpoints, signals')
    .eq('scan_id', SCAN_ID);

  if (!results) { console.error('Failed to load results'); process.exit(1); }

  console.log(`Loaded ${results.length} module results for ${scan.domain}`);

  const previousResults = new Map<ModuleId, ModuleResult>();
  for (const r of results) {
    previousResults.set(r.module_id as ModuleId, {
      moduleId: r.module_id as ModuleId,
      status: r.status,
      score: r.score,
      data: r.data ?? {},
      checkpoints: r.checkpoints ?? [],
      signals: r.signals ?? [],
      duration: 0,
    });
  }

  // ─── Step 3: Re-run synthesis M42, M45, M43, M46 ───────────────
  // Order: M42 first (M43/M46 depend on it), M45 independent, M43 depends on M42+M45, M46 depends on M42+M43+M45
  const EXECUTORS: [string, (ctx: ModuleContext) => Promise<ModuleResult>][] = [
    ['M42', m42Execute],
    ['M45', m45Execute],
    ['M43', m43Execute],
    ['M46', m46Execute],
  ];

  const ctx: ModuleContext = {
    url: scan.url,
    scanId: scan.id,
    tier: scan.tier,
    html: '',
    headers: new Map(),
    previousResults,
    page: null as any,
    networkCollector: null as any,
    consoleCollector: null as any,
    storageSnapshot: null as any,
    frameSnapshot: null as any,
    domForensics: null as any,
    inlineConfigs: null as any,
    cookieAnalysis: null as any,
    formSnapshot: null as any,
    imageAudit: null as any,
    linkAnalysis: null as any,
    navigatorSnapshot: null as any,
    redirectChain: [],
    mobileMetrics: null as any,
    spaDetected: false,
  };

  for (const [moduleId, executeFn] of EXECUTORS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Running ${moduleId}...`);

    try {
      const result = await executeFn(ctx);

      if (result.status === 'error') {
        console.error(`❌ ${moduleId} failed:`, result.error);
      } else {
        console.log(`✅ ${moduleId}: ${result.status}`);
      }

      // Print summary
      if (moduleId === 'M42' && result.data) {
        const synth = (result.data as any).synthesis;
        if (synth) {
          console.log(`  verdict_headline: ${synth.verdict_headline}`);
          console.log(`  synthesis_headline: ${synth.synthesis_headline}`);
          console.log(`  executive_brief: ${synth.executive_brief?.slice(0, 200)}...`);
          console.log(`  categories: ${synth.category_assessments?.length ?? 0}`);
          console.log(`  key_findings: ${synth.key_findings?.length ?? 0}`);
        }
      } else if (moduleId === 'M45' && result.data) {
        const stack = (result.data as any).stackAnalysis;
        if (stack) {
          console.log(`  totalTools: ${stack.currentStack?.totalTools}, abandoned: ${stack.currentStack?.abandonedTools}, redundant: ${stack.currentStack?.redundantPairs}`);
        }
      } else if (moduleId === 'M43' && result.data) {
        console.log(`  markdown length: ${(result.data as any).markdown?.length ?? 0} chars`);
        console.log(`  metadata: ${JSON.stringify((result.data as any).metadata)?.slice(0, 200)}`);
      } else if (moduleId === 'M46' && result.data) {
        const deck = (result.data as any).bossDeck;
        if (deck) {
          console.log(`  wins: ${deck.wins_highlights?.length}, issues: ${deck.top_issues?.length}, initiatives: ${deck.initiatives?.length}`);
        }
      }

      // Update previousResults for downstream modules
      previousResults.set(moduleId as ModuleId, result);

      // Upsert to DB
      const { error: upsertErr } = await sb
        .from('module_results')
        .upsert({
          scan_id: SCAN_ID,
          module_id: moduleId,
          status: result.status,
          score: result.score,
          data: result.data,
          checkpoints: result.checkpoints,
          signals: result.signals,
          duration_ms: result.duration,
          error: result.error ?? null,
        }, { onConflict: 'scan_id,module_id' });

      if (upsertErr) {
        console.error(`  ⚠️ ${moduleId} upsert failed:`, upsertErr.message);
      } else {
        console.log(`  📝 ${moduleId} upserted to DB`);
      }
    } catch (err) {
      console.error(`❌ ${moduleId} threw:`, (err as Error).message);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('DONE');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
