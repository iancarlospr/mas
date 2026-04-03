import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

// Get all completed paid scans with MarketingIQ
const { data: scans, error } = await sb
  .from('scans')
  .select('id, domain, marketing_iq, cache_source')
  .eq('status', 'complete')
  .not('marketing_iq', 'is', null)
  .order('marketing_iq', { ascending: true });

if (error) { console.error(error); process.exit(1); }

console.log(`Total scans with MarketingIQ: ${scans!.length}\n`);
console.log('=== SCORE DISTRIBUTION ===');
const buckets: Record<string, number> = { '0-9':0, '10-19':0, '20-29':0, '30-39':0, '40-49':0, '50-59':0, '60-69':0, '70-79':0, '80-89':0, '90-100':0 };
for (const s of scans!) {
  const iq = s.marketing_iq;
  if (iq <= 9) buckets['0-9']++;
  else if (iq <= 19) buckets['10-19']++;
  else if (iq <= 29) buckets['20-29']++;
  else if (iq <= 39) buckets['30-39']++;
  else if (iq <= 49) buckets['40-49']++;
  else if (iq <= 59) buckets['50-59']++;
  else if (iq <= 69) buckets['60-69']++;
  else if (iq <= 79) buckets['70-79']++;
  else if (iq <= 89) buckets['80-89']++;
  else buckets['90-100']++;
}
for (const [range, count] of Object.entries(buckets)) {
  const bar = '█'.repeat(count);
  console.log(`  ${range.padStart(6)}: ${String(count).padStart(3)} ${bar}`);
}

console.log('\n=== ALL SCORES ===');
for (const s of scans!) {
  console.log(`  ${String(s.marketing_iq).padStart(3)}  ${s.domain}`);
}

// Stats
const scores = scans!.map(s => s.marketing_iq);
const min = Math.min(...scores);
const max = Math.max(...scores);
const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
const sorted = [...scores].sort((a: number, b: number) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const stddev = Math.round(Math.sqrt(scores.reduce((sum: number, s: number) => sum + (s - avg) ** 2, 0) / scores.length));

console.log(`\n=== STATS ===`);
console.log(`  Min: ${min}, Max: ${max}, Avg: ${avg}, Median: ${median}, StdDev: ${stddev}`);
