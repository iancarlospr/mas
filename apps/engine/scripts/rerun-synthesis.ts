/**
 * Re-run synthesis modules (M41-M45) for a scan using the latest local code.
 * Usage: GOOGLE_AI_API_KEY=... npx tsx --env-file=.env scripts/rerun-synthesis.ts <scanId> [M41|M42|M43|M44|M45]
 * Default: re-runs M41 then M42 (M42 depends on M41 output).
 */

import { createClient } from '@supabase/supabase-js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';
import type { ModuleContext } from '../src/modules/types.js';

// Side-effect imports to register module executors
import { execute as m41Execute } from '../src/modules/synthesis/m41-module-synthesis.js';
import { execute as m42Execute } from '../src/modules/synthesis/m42-final-synthesis.js';
import { execute as m43Execute } from '../src/modules/synthesis/m43-prd-generation.js';
import { execute as m44Execute } from '../src/modules/synthesis/m44-roi-simulator.js';
import { execute as m45Execute } from '../src/modules/synthesis/m45-cost-cutter.js';

const EXECUTORS: Record<string, (ctx: ModuleContext) => Promise<ModuleResult>> = {
  M41: m41Execute,
  M42: m42Execute,
  M43: m43Execute,
  M44: m44Execute,
  M45: m45Execute,
};

const scanId = process.argv[2];
const requestedModules = process.argv.slice(3);
if (!scanId) {
  console.error('Usage: npx tsx --env-file=.env scripts/rerun-synthesis.ts <scanId> [M41|M42|M43|M44|M45]');
  console.error('Default: re-runs M41 then M42');
  process.exit(1);
}

const modulesToRun = requestedModules.length > 0
  ? requestedModules
  : ['M41', 'M42']; // Default: M41 first (M42 depends on it)

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
);

async function main() {
  const { data: scan, error: scanErr } = await supabase
    .from('scans')
    .select('id, url, domain, tier')
    .eq('id', scanId)
    .single();

  if (scanErr || !scan) {
    console.error('Scan not found:', scanErr?.message);
    process.exit(1);
  }

  console.log(`Scan: ${scan.domain} (${scan.id}), tier: ${scan.tier}`);

  const { data: results, error: resErr } = await supabase
    .from('module_results')
    .select('module_id, status, score, data, checkpoints, signals')
    .eq('scan_id', scanId);

  if (resErr || !results) {
    console.error('Failed to load results:', resErr?.message);
    process.exit(1);
  }

  console.log(`Loaded ${results.length} module results`);

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

  for (const moduleId of modulesToRun) {
    const executeFn = EXECUTORS[moduleId];
    if (!executeFn) {
      console.error(`No executor for ${moduleId}. Available: ${Object.keys(EXECUTORS).join(', ')}`);
      continue;
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Running ${moduleId}...`);

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

    const result = await executeFn(ctx);

    if (result.status !== 'success') {
      console.error(`${moduleId} failed:`, result.error);
      continue;
    }

    // Update previousResults so M42 sees fresh M41
    previousResults.set(moduleId as ModuleId, result);

    // Print summary
    if (moduleId === 'M41') {
      const sums = (result.data as any).moduleSummaries ?? {};
      const aiCount = Object.values(sums).filter((s: any) => s.source === 'ai').length;
      const fbCount = Object.values(sums).filter((s: any) => s.source === 'fallback').length;
      console.log(`M41: ${aiCount} AI syntheses, ${fbCount} fallbacks`);
    } else if (moduleId === 'M42') {
      const synth = (result.data as any).synthesis;
      console.log(`verdict_headline: ${synth?.verdict_headline}`);
      console.log(`executive_brief: ${synth?.executive_brief?.slice(0, 200)}...`);
    } else if (moduleId === 'M45') {
      const stack = (result.data as any).stackAnalysis;
      const current = stack?.currentStack;
      console.log(`M45: ${current?.totalTools} tools, ${current?.redundantPairs} redundant, ${current?.abandonedTools} abandoned`);
      console.log(`Assessment: ${current?.assessment}`);
      console.log(`Lean: ${stack?.leanStack?.totalToolsAfter} tools — ${stack?.leanStack?.keyBenefit}`);
      console.log(`Optimal: ${stack?.optimalStack?.totalToolsAfter} tools — ${stack?.optimalStack?.keyBenefit}`);
      if (stack?.optimalStack?.gaps?.length > 0) {
        console.log(`Gaps: ${stack.optimalStack.gaps.map((g: any) => g.capability).join(', ')}`);
      }
    } else if (moduleId === 'M44') {
      const roi = (result.data as any).roi;
      if (roi?._fallback) {
        console.log('M44: fallback (no AI scenarios)');
      } else {
        const mod = roi?.scenarios?.find((s: any) => s.id === 'moderate');
        console.log(`M44 headline: ${roi?.headline}`);
        console.log(`M44 moderate: $${mod?.totalMonthlyImpact?.toLocaleString()}/mo ($${mod?.totalAnnualImpact?.toLocaleString()}/yr)`);
        console.log(`M44 score: ${roi?.scoreImprovement?.current} → ${roi?.scoreImprovement?.estimated}`);
      }
    }

    // Upsert
    const { error: upsertErr } = await supabase
      .from('module_results')
      .upsert({
        scan_id: scanId,
        module_id: moduleId,
        status: result.status,
        score: result.score,
        data: result.data,
        checkpoints: result.checkpoints,
        signals: result.signals,
      }, { onConflict: 'scan_id,module_id' });

    if (upsertErr) {
      console.error(`${moduleId} upsert failed:`, upsertErr.message);
    } else {
      console.log(`${moduleId} upserted.`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
