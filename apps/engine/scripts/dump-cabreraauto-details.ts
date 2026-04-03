import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';
const modules = ['M01', 'M02', 'M04', 'M05', 'M07'];

for (const mod of modules) {
  const { data } = await supabase
    .from('module_results')
    .select('module_id, status, score, data, checkpoints, signals')
    .eq('scan_id', scanId)
    .eq('module_id', mod)
    .single();

  console.log(`\n===== ${mod} =====`);
  console.log(JSON.stringify(data, null, 2));
}
