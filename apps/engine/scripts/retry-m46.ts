/**
 * Retry M46 Boss Deck only for equitysolarpr.com
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/retry-m46.ts
 */
import { createClient } from '@supabase/supabase-js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';
import type { ModuleContext } from '../src/modules/types.js';
import { execute as m46Execute } from '../src/modules/synthesis/m46-boss-deck.js';

const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  const { data: scan } = await sb.from('scans').select('id, url, domain, tier').eq('id', SCAN_ID).single();
  if (!scan) { console.error('Scan not found'); process.exit(1); }

  const { data: results } = await sb.from('module_results')
    .select('module_id, status, score, data, checkpoints, signals')
    .eq('scan_id', SCAN_ID);
  if (!results) { console.error('No results'); process.exit(1); }

  console.log(`Loaded ${results.length} results for ${scan.domain}`);

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

  console.log('Running M46 Boss Deck...');
  const result = await m46Execute({
    url: scan.url, scanId: scan.id, tier: scan.tier,
    html: '', headers: new Map(), previousResults,
    page: null as any, networkCollector: null as any, consoleCollector: null as any,
    storageSnapshot: null as any, frameSnapshot: null as any, domForensics: null as any,
    inlineConfigs: null as any, cookieAnalysis: null as any, formSnapshot: null as any,
    imageAudit: null as any, linkAnalysis: null as any, navigatorSnapshot: null as any,
    redirectChain: [], mobileMetrics: null as any, spaDetected: false,
  });

  if (result.status === 'error') {
    console.error('❌ M46 failed:', result.error);
    process.exit(1);
  }

  console.log(`✅ M46: ${result.status}`);
  const deck = (result.data as any).bossDeck;
  if (deck) {
    console.log(`  wins: ${deck.wins_highlights?.length}, issues: ${deck.top_issues?.length}, initiatives: ${deck.initiatives?.length}`);
    console.log(`  timeline: ${deck.timeline_items?.length}, next_steps: ${deck.next_steps?.length}`);
  }

  const { error } = await sb.from('module_results').upsert({
    scan_id: SCAN_ID, module_id: 'M46',
    status: result.status, score: result.score,
    data: result.data, checkpoints: result.checkpoints,
    signals: result.signals, duration_ms: result.duration,
    error: result.error ?? null,
  }, { onConflict: 'scan_id,module_id' });

  if (error) console.error('Upsert failed:', error.message);
  else console.log('📝 M46 upserted to DB');
}

main().catch(err => { console.error(err); process.exit(1); });
