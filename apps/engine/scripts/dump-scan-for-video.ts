/**
 * Dump scan data for Remotion video.
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/dump-scan-for-video.ts <domain>
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: npx tsx --env-file=.env scripts/dump-scan-for-video.ts <domain>');
  process.exit(1);
}

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  // Find scans for domain (try with and without .com)
  const searchDomains = [domain, `${domain}.com`, `www.${domain}.com`];

  let scan: any = null;
  for (const d of searchDomains) {
    const { data: scans } = await sb
      .from('scans')
      .select('*')
      .eq('domain', d)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);

    if (scans?.length) {
      scan = scans[0];
      console.log(`Found scan for domain: ${d}`);
      break;
    }
  }

  // Also try ilike search
  if (!scan) {
    const { data: scans } = await sb
      .from('scans')
      .select('*')
      .ilike('domain', `%${domain}%`)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);

    if (scans?.length) {
      scan = scans[0];
      console.log(`Found scan via fuzzy match: ${scan.domain}`);
    }
  }

  if (!scan) {
    console.error(`No completed scans found for: ${domain}`);
    // List all domains to help debug
    const { data: all } = await sb
      .from('scans')
      .select('domain, status, marketing_iq, created_at')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(30);
    console.log('\nRecent completed scans:');
    all?.forEach(s => console.log(`  ${s.domain} (MIQ: ${s.marketing_iq}) - ${s.created_at}`));
    process.exit(1);
  }

  console.log(`\nScan: ${scan.id}`);
  console.log(`Domain: ${scan.domain}`);
  console.log(`URL: ${scan.url}`);
  console.log(`Tier: ${scan.tier} | Status: ${scan.status} | MIQ: ${scan.marketing_iq}`);

  const sourceId = scan.cache_source ?? scan.id;

  // Get all module results
  const { data: results } = await sb
    .from('module_results')
    .select('module_id, status, data, signals, score, checkpoints, duration_ms, error')
    .eq('scan_id', sourceId)
    .order('module_id');

  if (!results) {
    console.error('No module results found');
    process.exit(1);
  }

  console.log(`Module results: ${results.length}`);

  // Build output
  const output = {
    scan: {
      id: scan.id,
      domain: scan.domain,
      url: scan.url,
      tier: scan.tier,
      status: scan.status,
      marketing_iq: scan.marketing_iq,
      marketing_iq_result: scan.marketing_iq_result,
      created_at: scan.created_at,
      completed_at: scan.completed_at,
    },
    modules: Object.fromEntries(
      results.map(r => [r.module_id, {
        status: r.status,
        score: r.score,
        data: r.data,
        checkpoints: r.checkpoints,
        duration_ms: r.duration_ms,
      }])
    ),
  };

  const outPath = `../../packages/video/src/data/${scan.domain.replace(/\./g, '-')}-scan.json`;
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
