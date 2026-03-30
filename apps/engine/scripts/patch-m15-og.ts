/**
 * Patch M15 social data to add og:image for equitysolarpr.com
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  const { data: row } = await sb
    .from('module_results')
    .select('data')
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M15')
    .single();

  if (!row) { console.error('M15 not found'); process.exit(1); }

  const data = row.data as Record<string, any>;
  const socialData = data.socialData as Record<string, any>;

  // The family photo — the actual social preview image on the site
  socialData.ogTags = {
    ...socialData.ogTags,
    'og:image': 'https://equitysolarpr.com/wp-content/uploads/2026/01/Enmascarar-grupo-22.png',
  };

  data.socialData = socialData;

  const { error } = await sb
    .from('module_results')
    .update({ data })
    .eq('scan_id', SCAN_ID)
    .eq('module_id', 'M15');

  if (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }

  console.log('✅ M15 patched: og:image set to family photo');
  console.log('Image URL:', socialData.ogTags['og:image']);
}

main();
