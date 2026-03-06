import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '7f2db19a-ff6e-4ba6-b5ef-b5c18a038440';

async function main() {
  const { data: results } = await sb.from('module_results').select('module_id, data').eq('scan_id', SCAN_ID);
  if (!results) { console.error('No results'); process.exit(1); }
  const get = (id: string) => results.find(r => r.module_id === id)?.data as Record<string, unknown> | undefined;

  // M02: full detectedTechnologies + httpVersion + server + cdn + cms + framework + hosting
  const m02 = get('M02');
  console.log('M02 detectedTechnologies:', JSON.stringify(m02?.detectedTechnologies));
  console.log('M02 httpVersion:', m02?.httpVersion);
  console.log('M02 server:', m02?.server);
  console.log('M02 cdn:', m02?.cdn);
  console.log('M02 cms:', m02?.cms);
  console.log('M02 framework:', m02?.framework);
  console.log('M02 hosting:', m02?.hosting);

  // M05: consent, serverSideTracking
  const m05 = get('M05');
  console.log('\nM05 consent:', JSON.stringify(m05?.consent));
  console.log('M05 serverSideTracking:', JSON.stringify(m05?.serverSideTracking));

  // M08: tms, thirdPartyProfiles
  const m08 = get('M08');
  console.log('\nM08 tms:', JSON.stringify(m08?.tms));
  console.log('M08 serverSideIndicators:', JSON.stringify(m08?.serverSideIndicators));
  console.log('M08 thirdPartyProfiles (first 5):', JSON.stringify((m08?.thirdPartyProfiles as any[])?.slice(0, 5)));

  // M12: consent/privacy tools
  const m12 = get('M12');
  console.log('\nM12 hasTcf:', m12?.hasTcf);
  console.log('M12 preConsentTracking:', JSON.stringify(m12?.preConsentTracking)?.slice(0, 200));

  // M20: payment/auth providers
  const m20 = get('M20');
  console.log('\nM20 authProviders:', JSON.stringify(m20?.authProviders));
  console.log('M20 paymentProviders:', JSON.stringify(m20?.paymentProviders));

  // M41 businessContext
  const m41 = get('M41');
  console.log('\nM41 businessContext:', JSON.stringify(m41?.businessContext)?.slice(0, 500));
}
main();

