/**
 * Dump M41 structure + synthesis modules + external API modules for cabreraauto scan.
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/dump-cabreraauto-m41-structure.ts
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';

async function main() {
  // First get the scan to check for cache_source
  const { data: scan } = await supabase
    .from('scans')
    .select('id, domain, url, tier, status, marketing_iq, cache_source')
    .eq('id', scanId)
    .single();

  if (!scan) {
    console.error('Scan not found');
    process.exit(1);
  }

  const sourceId = scan.cache_source ?? scan.id;
  console.log(`Scan: ${scan.id} | Domain: ${scan.domain} | MIQ: ${scan.marketing_iq}`);
  console.log(`Source ID for results: ${sourceId}`);
  console.log('');

  // Fetch all needed modules in one query
  const moduleIds = [
    'M41', 'M42', 'M43', 'M45', 'M46',
    'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30',
    'M31', 'M33', 'M34', 'M36', 'M37', 'M38', 'M39', 'M40',
  ];

  const { data: results } = await supabase
    .from('module_results')
    .select('module_id, status, data, score')
    .eq('scan_id', sourceId)
    .in('module_id', moduleIds)
    .order('module_id');

  if (!results || results.length === 0) {
    console.error('No module results found');
    process.exit(1);
  }

  const byId = Object.fromEntries(results.map(r => [r.module_id, r]));

  // ─── M41: Module Synthesis ───
  const m41 = byId['M41'];
  if (m41?.data) {
    const d = m41.data as any;
    console.log('═══════════════════════════════════════════════════════');
    console.log('  M41 — Module Synthesis');
    console.log('═══════════════════════════════════════════════════════');

    // 1. businessContext
    console.log('\n--- businessContext ---');
    console.log(JSON.stringify(d.businessContext, null, 2));

    // 2. moduleSummaries — keys + scores only
    console.log('\n--- moduleSummaries (keys + scores only) ---');
    if (d.moduleSummaries) {
      const summaries = d.moduleSummaries as Record<string, any>;
      for (const [key, val] of Object.entries(summaries)) {
        console.log(`  ${key}: module_score=${val?.module_score ?? 'N/A'}`);
      }
    }
  } else {
    console.log('M41: NO DATA');
  }

  // ─── M42: Executive Brief (Full) ───
  const m42 = byId['M42'];
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  M42 — Executive Brief (synthesis)');
  console.log('═══════════════════════════════════════════════════════');
  if (m42?.data) {
    console.log(JSON.stringify(m42.data, null, 2));
  } else {
    console.log('M42: NO DATA');
  }

  // ─── M45: Stack Analyzer (Full) ───
  const m45 = byId['M45'];
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  M45 — Stack Analyzer');
  console.log('═══════════════════════════════════════════════════════');
  if (m45?.data) {
    console.log(JSON.stringify(m45.data, null, 2));
  } else {
    console.log('M45: NO DATA');
  }

  // ─── M46: Boss Deck (Full) ───
  const m46 = byId['M46'];
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  M46 — Boss Deck');
  console.log('═══════════════════════════════════════════════════════');
  if (m46?.data) {
    console.log(JSON.stringify(m46.data, null, 2));
  } else {
    console.log('M46: NO DATA');
  }

  // ─── M43: PRD — metadata only ───
  const m43 = byId['M43'];
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  M43 — PRD (metadata only, markdown omitted)');
  console.log('═══════════════════════════════════════════════════════');
  if (m43?.data) {
    const d43 = m43.data as any;
    const { markdown, prd_markdown, ...metadata } = d43;
    console.log(JSON.stringify(metadata, null, 2));
    if (markdown) console.log(`  [markdown field: ${(markdown as string).length} chars]`);
    if (prd_markdown) console.log(`  [prd_markdown field: ${(prd_markdown as string).length} chars]`);
  } else {
    console.log('M43: NO DATA');
  }

  // ─── External API Modules (M21-M40) ───
  const externalIds = [
    'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30',
    'M31', 'M33', 'M34', 'M36', 'M37', 'M38', 'M39', 'M40',
  ];

  for (const mid of externalIds) {
    const mod = byId[mid];
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`  ${mid} — External Module | status=${mod?.status ?? 'MISSING'} | score=${mod?.score ?? 'N/A'}`);
    console.log(`═══════════════════════════════════════════════════════`);
    if (mod?.data) {
      console.log(JSON.stringify(mod.data, null, 2));
    } else {
      console.log(`${mid}: NO DATA`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
