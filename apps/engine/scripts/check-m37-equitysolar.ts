import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  // M37 raw data
  const { data: m37 } = await sb.from('module_results').select('data, status, score, checkpoints').eq('scan_id', SCAN_ID).eq('module_id', 'M37').single();
  console.log('=== M37 RAW ===');
  console.log('Status:', m37?.status, '| Score:', m37?.score);
  console.log('Data:', JSON.stringify(m37?.data, null, 2));
  console.log('Checkpoints:', JSON.stringify(m37?.checkpoints, null, 2));

  // M41 synthesis for M37
  const { data: m41 } = await sb.from('module_results').select('data').eq('scan_id', SCAN_ID).eq('module_id', 'M41').single();
  const summaries = (m41?.data as any)?.moduleSummaries;
  const m37syn = summaries?.['M37'];
  console.log('\n=== M41 SYNTHESIS FOR M37 ===');
  console.log(JSON.stringify(m37syn, null, 2));
}
main();
