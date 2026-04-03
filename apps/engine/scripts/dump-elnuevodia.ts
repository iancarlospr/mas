import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

const { data: scans, error: scanErr } = await sb
  .from('scans')
  .select('id, domain, url, tier, status, marketing_iq, created_at, completed_at, cache_source')
  .ilike('domain', '%elnuevodia%')
  .order('created_at', { ascending: false })
  .limit(5);

if (scanErr) { console.error('Scan error:', scanErr); process.exit(1); }
if (!scans?.length) { console.log('No scans found for elnuevodia'); process.exit(0); }

console.log('=== SCANS ===');
for (const s of scans) {
  console.log(JSON.stringify(s));
}

const scan = scans[0]!;
const sourceId = scan.cache_source ?? scan.id;
console.log('\nUsing sourceId:', sourceId);

const { data: results, error: modErr } = await sb
  .from('module_results')
  .select('module_id, status, data, score, checkpoints, duration_ms, error')
  .eq('scan_id', sourceId)
  .in('module_id', ['M04', 'M06']);

if (modErr) { console.error('Module error:', modErr); process.exit(1); }

for (const r of results ?? []) {
  console.log('\n=== ' + r.module_id + ' (score: ' + r.score + ', status: ' + r.status + ') ===');
  console.log(JSON.stringify(r.data, null, 2));
}
