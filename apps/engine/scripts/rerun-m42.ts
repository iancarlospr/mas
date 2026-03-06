/**
 * Re-run M42 synthesis for a scan using the latest local code.
 * Usage: npx tsx --env-file=.env scripts/rerun-m42.ts <scanId>
 */

import { createClient } from '@supabase/supabase-js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';

// Import the M42 execute function (side-effect registers it)
import { execute } from '../src/modules/synthesis/m42-final-synthesis.js';
import type { ModuleContext } from '../src/modules/types.js';

const scanId = process.argv[2];
if (!scanId) {
  console.error('Usage: npx tsx --env-file=.env scripts/rerun-m42.ts <scanId>');
  process.exit(1);
}

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
);

async function main() {
  // 1. Get scan
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

  // 2. Load all existing module results
  const { data: results, error: resErr } = await supabase
    .from('module_results')
    .select('module_id, status, score, data, checkpoints, signals')
    .eq('scan_id', scanId);

  if (resErr || !results) {
    console.error('Failed to load results:', resErr?.message);
    process.exit(1);
  }

  console.log(`Loaded ${results.length} module results`);

  // 3. Build previousResults map
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

  // 4. Build minimal ModuleContext for M42
  const ctx: ModuleContext = {
    url: scan.url,
    scanId: scan.id,
    tier: scan.tier,
    html: '',
    headers: new Map(),
    previousResults,
    // Unused by M42 but required by type
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

  console.log('Running M42 synthesis with latest code...');
  const result = await execute(ctx);

  if (result.status !== 'success') {
    console.error('M42 failed:', result.error);
    process.exit(1);
  }

  const synthesis = (result.data as any).synthesis;

  // SAFETY: abort if AI failed and returned fallback
  if (!synthesis?.executive_brief || synthesis.executive_brief.includes('could not be generated')) {
    console.error('AI synthesis failed (got fallback). NOT overwriting DB.');
    process.exit(1);
  }

  console.log('\n=== synthesis_headline ===');
  console.log(synthesis.synthesis_headline);
  console.log('\n=== verdict_headline (Galloway) ===');
  console.log(synthesis.verdict_headline);
  console.log('\n=== executive_brief (first 300 chars) ===');
  console.log(synthesis.executive_brief?.slice(0, 300));

  // 5. Upsert to DB
  const { error: upsertErr } = await supabase
    .from('module_results')
    .upsert({
      scan_id: scanId,
      module_id: 'M42',
      status: result.status,
      score: result.score,
      data: result.data,
      checkpoints: result.checkpoints,
      signals: result.signals,
    }, { onConflict: 'scan_id,module_id' });

  if (upsertErr) {
    console.error('Upsert failed:', upsertErr.message);
    process.exit(1);
  }

  console.log('\nM42 upserted successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
