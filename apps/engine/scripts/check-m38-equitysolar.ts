import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  const { data: m38 } = await sb.from('module_results').select('data, status, score, checkpoints').eq('scan_id', SCAN_ID).eq('module_id', 'M38').single();
  console.log('=== M38 RAW ===');
  console.log('Status:', m38?.status, '| Score:', m38?.score);
  console.log('Data:', JSON.stringify(m38?.data, null, 2));
  console.log('Checkpoints:', JSON.stringify(m38?.checkpoints, null, 2));

  const { data: m41 } = await sb.from('module_results').select('data').eq('scan_id', SCAN_ID).eq('module_id', 'M41').single();
  const m38syn = (m41?.data as any)?.moduleSummaries?.['M38'];
  console.log('\n=== M41 SYNTHESIS FOR M38 ===');
  console.log(JSON.stringify(m38syn, null, 2));
}
main();
