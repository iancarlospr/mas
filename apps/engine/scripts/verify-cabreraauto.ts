import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { autoRefreshToken: false, persistSession: false } });
const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';

async function main() {
  const mods = ['M01','M02','M04','M05','M07','M41','M42','M43','M45','M46'];
  for (const m of mods) {
    const { data } = await sb.from('module_results').select('module_id, status, score').eq('scan_id', scanId).eq('module_id', m).single();
    const d = data as Record<string, unknown>;
    console.log(`${m}: status=${d?.status}, score=${d?.score}`);
  }

  const { data: m41 } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M41').single();
  const ctx = (m41?.data as Record<string, unknown>)?.businessContext as Record<string, unknown>;
  console.log(`\nM41 businessName: ${ctx?.businessName}`);
  console.log(`M41 CMS: ${(ctx?.techStack as Record<string, unknown>)?.cms}`);

  const { data: m42 } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M42').single();
  const syn = (m42?.data as Record<string, unknown>)?.synthesis as Record<string, unknown>;
  console.log(`\nM42 headline: ${String(syn?.synthesis_headline).substring(0, 90)}...`);
  console.log(`M42 verdict: ${String(syn?.verdict_headline).substring(0, 90)}...`);

  const { data: m45 } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M45').single();
  const stack = ((m45?.data as Record<string, unknown>)?.stackAnalysis as Record<string, unknown>)?.currentStack as Record<string, unknown>;
  console.log(`\nM45 totalTools: ${stack?.totalTools}`);

  const { data: m43 } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M43').single();
  const md = (m43?.data as Record<string, unknown>)?.markdown as string;
  const meta = (m43?.data as Record<string, unknown>)?.metadata as Record<string, unknown>;
  console.log(`\nM43 PRD: ${md?.length} chars, ${meta?.totalFindings} findings`);
}

main();
