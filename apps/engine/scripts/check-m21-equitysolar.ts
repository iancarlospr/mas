/**
 * Dump M21 data for equitysolarpr.com scan
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  const { data } = await sb
    .from('module_results')
    .select('data, status, score, checkpoints, signals')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M21')
    .single();

  if (!data) { console.error('M21 not found'); process.exit(1); }

  console.log('Status:', data.status);
  console.log('Score:', data.score);
  console.log('\nFull data:');
  console.log(JSON.stringify(data.data, null, 2));
  console.log('\nCheckpoints:');
  console.log(JSON.stringify(data.checkpoints, null, 2));
  console.log('\nSignals:');
  console.log(JSON.stringify(data.signals, null, 2));
}
main();
