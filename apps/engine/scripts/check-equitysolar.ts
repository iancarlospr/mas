/**
 * Diagnostic: Check equitysolarpr.com scan data completeness.
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/check-equitysolar.ts
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  // 1. Find all scans for this domain
  const { data: scans, error: scanErr } = await sb
    .from('scans')
    .select('id, url, domain, tier, status, marketing_iq, created_at, completed_at, cache_source, user_id')
    .eq('domain', 'equitysolarpr.com')
    .order('created_at', { ascending: false });

  if (scanErr || !scans?.length) {
    console.error('No scans found for equitysolarpr.com:', scanErr?.message);
    process.exit(1);
  }

  console.log(`Found ${scans.length} scan(s) for equitysolarpr.com:\n`);
  for (const s of scans) {
    console.log(`  ID: ${s.id}`);
    console.log(`  URL: ${s.url}`);
    console.log(`  Tier: ${s.tier} | Status: ${s.status} | MIQ: ${s.marketing_iq ?? 'NULL'}`);
    console.log(`  Created: ${s.created_at} | Completed: ${s.completed_at ?? 'NULL'}`);
    console.log(`  Cache Source: ${s.cache_source ?? 'NONE'}`);
    console.log('');
  }

  // Use the most recent scan
  const scan = scans[0]!;
  const sourceId = scan.cache_source ?? scan.id;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Using scan: ${scan.id} (source: ${sourceId})`);
  console.log(`${'═'.repeat(70)}\n`);

  // 2. Get ALL module results
  const { data: results, error: resErr } = await sb
    .from('module_results')
    .select('module_id, status, score, duration_ms, error, data')
    .eq('scan_id', sourceId)
    .order('module_id');

  if (resErr || !results) {
    console.error('Failed to load results:', resErr?.message);
    process.exit(1);
  }

  console.log(`Total module results: ${results.length}\n`);

  // 3. Summary table
  const statusCounts: Record<string, number> = {};
  console.log('MODULE  STATUS     SCORE  DURATION  ERROR');
  console.log('─'.repeat(70));

  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const score = r.score != null ? String(r.score).padStart(5) : '    -';
    const dur = r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s`.padStart(8) : '       -';
    const err = r.error ? r.error.slice(0, 60) : '';
    console.log(`${r.module_id.padEnd(6)}  ${r.status.padEnd(9)}  ${score}  ${dur}  ${err}`);
  }

  console.log('─'.repeat(70));
  console.log('Status summary:', statusCounts);

  // 4. Check data completeness for each module
  console.log(`\n${'═'.repeat(70)}`);
  console.log('DATA COMPLETENESS CHECK');
  console.log(`${'═'.repeat(70)}\n`);

  const emptyDataModules: string[] = [];
  const errorModules: string[] = [];
  const skippedModules: string[] = [];

  for (const r of results) {
    const data = r.data as Record<string, unknown> | null;
    const dataKeys = data ? Object.keys(data) : [];
    const hasData = dataKeys.length > 0;

    if (r.status === 'error') {
      errorModules.push(r.module_id);
      console.log(`❌ ${r.module_id}: ERROR — ${r.error}`);
    } else if (r.status === 'skipped') {
      skippedModules.push(r.module_id);
      console.log(`⏭  ${r.module_id}: SKIPPED — ${r.error ?? (data as any)?.reason ?? 'no reason'}`);
    } else if (!hasData) {
      emptyDataModules.push(r.module_id);
      console.log(`⚠️  ${r.module_id}: ${r.status} but EMPTY DATA`);
    } else {
      console.log(`✅ ${r.module_id}: ${r.status} — keys: [${dataKeys.join(', ')}]`);
    }
  }

  // 5. Synthesis modules deep-dive
  console.log(`\n${'═'.repeat(70)}`);
  console.log('SYNTHESIS MODULES DEEP-DIVE');
  console.log(`${'═'.repeat(70)}\n`);

  const synthIds = ['M41', 'M42', 'M43', 'M45', 'M46'];
  for (const mid of synthIds) {
    const r = results.find(r => r.module_id === mid);
    if (!r) {
      console.log(`${mid}: NOT FOUND (never ran)`);
      continue;
    }

    console.log(`\n--- ${mid} ---`);
    console.log(`Status: ${r.status} | Duration: ${r.duration_ms ? (r.duration_ms / 1000).toFixed(1) + 's' : 'N/A'}`);
    if (r.error) console.log(`Error: ${r.error}`);

    const data = r.data as Record<string, unknown> | null;
    if (!data || Object.keys(data).length === 0) {
      console.log('Data: EMPTY');
      continue;
    }

    if (mid === 'M41') {
      const sums = data.moduleSummaries as Record<string, any> | undefined;
      if (sums) {
        const aiCount = Object.values(sums).filter((s: any) => s.source === 'ai').length;
        const fbCount = Object.values(sums).filter((s: any) => s.source === 'fallback').length;
        console.log(`Synthesized: ${aiCount} AI, ${fbCount} fallback, ${Object.keys(sums).length} total`);
        console.log(`Business context: ${JSON.stringify(data.businessContext)?.slice(0, 200)}`);
      } else {
        console.log('moduleSummaries: MISSING');
      }
    } else if (mid === 'M42') {
      const synth = data.synthesis as Record<string, any> | undefined;
      if (synth) {
        console.log(`verdict_headline: ${synth.verdict_headline}`);
        console.log(`synthesis_headline: ${synth.synthesis_headline}`);
        console.log(`executive_brief: ${synth.executive_brief?.slice(0, 200)}...`);
        console.log(`categories: ${synth.category_assessments?.length ?? 0}`);
        console.log(`key_findings: ${synth.key_findings?.length ?? 0}`);
      } else {
        console.log('synthesis: MISSING');
      }
    } else if (mid === 'M43') {
      console.log(`markdown length: ${(data.markdown as string)?.length ?? 0} chars`);
      console.log(`metadata: ${JSON.stringify(data.metadata)?.slice(0, 200)}`);
    } else if (mid === 'M45') {
      const stack = data.stackAnalysis as Record<string, any> | undefined;
      if (stack) {
        console.log(`totalTools: ${stack.currentStack?.totalTools}`);
        console.log(`abandoned: ${stack.currentStack?.abandonedTools}`);
        console.log(`redundant: ${stack.currentStack?.redundantPairs}`);
        console.log(`leanStack: ${stack.leanStack?.totalToolsAfter} tools`);
        console.log(`optimalStack: ${stack.optimalStack?.totalToolsAfter} tools`);
      } else {
        console.log('stackAnalysis: MISSING');
      }
    } else if (mid === 'M46') {
      const deck = data.bossDeck as Record<string, any> | undefined;
      if (deck) {
        console.log(`wins: ${deck.wins_highlights?.length ?? 0}`);
        console.log(`issues: ${deck.top_issues?.length ?? 0}`);
        console.log(`initiatives: ${deck.initiatives?.length ?? 0}`);
        console.log(`timeline: ${deck.timeline_items?.length ?? 0}`);
        console.log(`next_steps: ${deck.next_steps?.length ?? 0}`);
      } else {
        console.log('bossDeck: MISSING');
      }
    }
  }

  // 6. Missing modules check
  const allExpected = [
    'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08',
    'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16',
    'M17', 'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24',
    'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M31', 'M32',
    'M33', 'M34', 'M35', 'M36', 'M37', 'M38', 'M39', 'M40',
    'M41', 'M42', 'M43', 'M45', 'M46',
  ];
  const found = new Set(results.map(r => r.module_id));
  const missing = allExpected.filter(m => !found.has(m));
  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING MODULES (never created): ${missing.join(', ')}`);
  }

  // Summary
  console.log(`\n${'═'.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(70)}`);
  console.log(`Scan: ${scan.id}`);
  console.log(`Tier: ${scan.tier} | Status: ${scan.status} | MIQ: ${scan.marketing_iq ?? 'NULL'}`);
  console.log(`Total results: ${results.length}`);
  console.log(`Errors: ${errorModules.length > 0 ? errorModules.join(', ') : 'NONE'}`);
  console.log(`Skipped: ${skippedModules.length > 0 ? skippedModules.join(', ') : 'NONE'}`);
  console.log(`Empty data: ${emptyDataModules.length > 0 ? emptyDataModules.join(', ') : 'NONE'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
