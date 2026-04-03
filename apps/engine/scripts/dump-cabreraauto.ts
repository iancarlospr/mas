/**
 * Dump scan data for cabreraauto.com
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/dump-cabreraauto.ts
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

const HIGHLIGHT_MODULES = ['M01', 'M02', 'M04', 'M05', 'M07', 'M41', 'M42', 'M43', 'M45', 'M46'];

async function main() {
  const domain = 'cabreraauto.com';

  // Find scan for domain
  let scan: any = null;

  const { data: scans } = await sb
    .from('scans')
    .select('*')
    .ilike('domain', `%cabreraauto%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (scans?.length) {
    scan = scans[0];
    console.log(`Found ${scans.length} scan(s) for cabreraauto`);
    scans.forEach(s => {
      console.log(`  ${s.id} | ${s.domain} | ${s.status} | tier=${s.tier} | MIQ=${s.marketing_iq} | ${s.created_at}`);
    });
    console.log(`\nUsing most recent: ${scan.id}`);
  }

  if (!scan) {
    console.error(`No scans found for: ${domain}`);
    // List recent scans to help debug
    const { data: all } = await sb
      .from('scans')
      .select('domain, status, marketing_iq, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    console.log('\nRecent scans:');
    all?.forEach(s => console.log(`  ${s.domain} (${s.status}, MIQ: ${s.marketing_iq}) - ${s.created_at}`));
    process.exit(1);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Scan ID:      ${scan.id}`);
  console.log(`Domain:       ${scan.domain}`);
  console.log(`URL:          ${scan.url}`);
  console.log(`Tier:         ${scan.tier}`);
  console.log(`Status:       ${scan.status}`);
  console.log(`MarketingIQ:  ${scan.marketing_iq}`);
  console.log(`Created:      ${scan.created_at}`);
  console.log(`Completed:    ${scan.completed_at}`);
  console.log(`Cache Source:  ${scan.cache_source ?? 'none (self)'}`);
  console.log(`${'='.repeat(80)}\n`);

  const sourceId = scan.cache_source ?? scan.id;

  // Get all module results
  const { data: results, error } = await sb
    .from('module_results')
    .select('module_id, status, data, signals, score, checkpoints, duration_ms, error')
    .eq('scan_id', sourceId)
    .order('module_id');

  if (error) {
    console.error('Error fetching module_results:', error);
    process.exit(1);
  }

  if (!results?.length) {
    console.error('No module results found');
    process.exit(1);
  }

  console.log(`Total module results: ${results.length}\n`);

  // Summary table
  console.log('Module Summary:');
  console.log('-'.repeat(70));
  for (const r of results) {
    const highlight = HIGHLIGHT_MODULES.includes(r.module_id) ? ' <<<' : '';
    console.log(`  ${r.module_id.padEnd(6)} | ${(r.status ?? '').padEnd(10)} | score: ${String(r.score ?? '-').padEnd(5)} | ${r.duration_ms ?? '-'}ms${highlight}`);
  }

  // Print detailed data for highlighted modules
  console.log(`\n${'='.repeat(80)}`);
  console.log('DETAILED MODULE DATA');
  console.log(`${'='.repeat(80)}\n`);

  for (const modId of HIGHLIGHT_MODULES) {
    const mod = results.find(r => r.module_id === modId);
    if (!mod) {
      console.log(`--- ${modId}: NOT FOUND ---\n`);
      continue;
    }

    console.log(`--- ${modId} (status: ${mod.status}, score: ${mod.score}) ---`);

    if (mod.error) {
      console.log(`ERROR: ${JSON.stringify(mod.error)}`);
    }

    if (mod.data) {
      console.log('DATA:');
      console.log(JSON.stringify(mod.data, null, 2));
    }

    if (mod.checkpoints) {
      console.log('CHECKPOINTS:');
      console.log(JSON.stringify(mod.checkpoints, null, 2));
    }

    console.log('');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
