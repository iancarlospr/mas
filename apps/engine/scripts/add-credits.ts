import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
  // Find user
  const { data: users } = await sb.auth.admin.listUsers();
  const user = users?.users?.find(u =>
    u.email?.includes('ianramirezbba') ||
    u.user_metadata?.display_name?.includes('ianramirezbba')
  );

  if (!user) {
    console.log('User not found. Listing all users:');
    for (const u of users?.users ?? []) {
      console.log(u.id, u.email, u.user_metadata?.display_name ?? u.user_metadata?.name);
    }
    return;
  }

  console.log('Found user:', user.id, user.email);

  // Find their latest nike scan and upgrade to paid
  const { data: scans } = await sb.from('scans')
    .select('id, domain, tier, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent scans:', JSON.stringify(scans, null, 2));

  // Upgrade latest scan to paid
  if (scans && scans.length > 0) {
    const latest = scans[0]!;
    if (latest.tier !== 'paid') {
      await sb.from('scans').update({ tier: 'paid' }).eq('id', latest.id);
      console.log(`Upgraded scan ${latest.id} (${latest.domain}) to paid`);
    } else {
      console.log('Latest scan already paid');
    }
  }
}
main();
