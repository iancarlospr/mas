import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  const { data } = await sb.from('module_results').select('module_id, status, data')
    .eq('scan_id', 'c5f56eaf-da76-44c6-8d0c-fd7a014ac975').eq('module_id', 'M42').single();
  console.log('M42 status:', data?.status);
  console.log('M42 data:', JSON.stringify(data?.data, null, 2)?.slice(0, 2000));
}
main();
