import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { autoRefreshToken: false, persistSession: false } });
const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';

async function main() {
  const { data: m41 } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M41').single();
  const summaries = (m41?.data as Record<string, unknown>)?.moduleSummaries as Record<string, Record<string, unknown>>;

  const allScores: { mod: string; score: number }[] = [];
  for (const [mod, syn] of Object.entries(summaries)) {
    if (syn.module_score != null) {
      allScores.push({ mod, score: syn.module_score as number });
    }
  }

  allScores.sort((a, b) => a.mod.localeCompare(b.mod));
  for (const { mod, score } of allScores) {
    console.log(`  ${mod}: ${score}`);
  }

  const avg = Math.round(allScores.reduce((a, b) => a + b.score, 0) / allScores.length);
  console.log(`\nTotal modules with scores: ${allScores.length}`);
  console.log(`Sum: ${allScores.reduce((a, b) => a + b.score, 0)}`);
  console.log(`New MarketingIQ: ${avg}`);

  // Update the scan record
  const { error } = await sb.from('scans').update({ marketing_iq: avg }).eq('id', scanId);
  if (error) throw error;
  console.log(`\nScan record updated: marketing_iq = ${avg}`);
}
main();
