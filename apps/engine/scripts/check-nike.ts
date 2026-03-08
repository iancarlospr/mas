import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  const { data } = await sb.from('scans').select('id, domain, status, created_at, tier')
    .ilike('domain', '%nike%').order('created_at', { ascending: false }).limit(1);
  console.log(JSON.stringify(data, null, 2));
  if (data && data[0]) {
    const { data: results } = await sb.from('module_results')
      .select('module_id, status').eq('scan_id', data[0].id).order('module_id');
    console.log('Completed modules:', results?.length);
    console.log(results?.map(r => r.module_id + ': ' + r.status).join(', '));
  }
}
main();
