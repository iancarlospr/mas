/**
 * Dump M41, M42, M43, M45, M46 synthesis data for cabreraauto scan.
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/dump-cabreraauto-synthesis.ts
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';
const modules = ['M41', 'M42', 'M43', 'M45', 'M46'];

async function main() {
  for (const mod of modules) {
    const { data, error } = await supabase
      .from('module_results')
      .select('module_id, status, score, data, checkpoints, signals')
      .eq('scan_id', scanId)
      .eq('module_id', mod)
      .single();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`MODULE: ${mod}`);
    console.log(`${'='.repeat(60)}`);
    if (error) {
      console.log(`ERROR: ${error.message}`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
