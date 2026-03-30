/**
 * Check OG image data for equitysolarpr.com
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  // Check M04 (SEO/meta) and M15 (social data)
  const { data: results } = await sb
    .from('module_results')
    .select('module_id, data')
    .eq('scan_id', SCAN_ID)
    .in('module_id', ['M04', 'M15']);

  if (!results) { console.error('No results'); process.exit(1); }

  for (const r of results) {
    const d = r.data as Record<string, any>;
    console.log(`\n=== ${r.module_id} ===`);

    if (r.module_id === 'M04') {
      console.log('OG Tags:', JSON.stringify(d.ogTags, null, 2));
      console.log('Twitter Cards:', JSON.stringify(d.twitterCards, null, 2));
      console.log('Favicon:', d.favicon);
    }

    if (r.module_id === 'M15') {
      console.log('Social Data:', JSON.stringify(d.socialData, null, 2));
    }
  }
}
main();
