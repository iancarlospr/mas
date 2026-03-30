import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  // Find walmart scan
  const { data: scans } = await sb.from('scans').select('id, domain, tier, status, created_at, marketing_iq')
    .ilike('domain', '%walmart%').order('created_at', { ascending: false }).limit(3);
  console.log('Walmart scans:', JSON.stringify(scans, null, 2));

  if (!scans || scans.length === 0) { console.error('No walmart scans found'); process.exit(1); }
  const scanId = scans[0]!.id;
  console.log('\nUsing scan:', scanId);

  // Get all module results
  const { data: results } = await sb.from('module_results').select('module_id, status, data')
    .eq('scan_id', scanId);
  if (!results) { console.error('No results'); process.exit(1); }

  console.log('\nModule results:');
  for (const r of results.sort((a, b) => a.module_id.localeCompare(b.module_id))) {
    const dataKeys = r.data ? Object.keys(r.data as Record<string, unknown>) : [];
    console.log(`  ${r.module_id}: ${r.status} (keys: ${dataKeys.join(', ')})`);
  }

  // Check M42 specifically
  const m42 = results.find(r => r.module_id === 'M42');
  if (m42) {
    console.log('\nM42 status:', m42.status);
    console.log('M42 data:', JSON.stringify(m42.data, null, 2).slice(0, 3000));
  } else {
    console.log('\nM42: NOT FOUND');
  }

  // Check M41
  const m41 = results.find(r => r.module_id === 'M41');
  if (m41) {
    console.log('\nM41 status:', m41.status);
  } else {
    console.log('\nM41: NOT FOUND');
  }
}
main();
