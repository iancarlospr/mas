import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

const { data: scans } = await sb
  .from('scans')
  .select('id, domain, cache_source')
  .ilike('domain', '%elnuevodia%')
  .order('created_at', { ascending: false })
  .limit(1);

const scan = scans![0]!;
const sourceId = scan.cache_source ?? scan.id;

const { data: results } = await sb
  .from('module_results')
  .select('module_id, data')
  .eq('scan_id', sourceId)
  .in('module_id', ['M04', 'M06']);

const m04 = results!.find(r => r.module_id === 'M04')?.data as any;
const m06 = results!.find(r => r.module_id === 'M06')?.data as any;

if (m04) {
  console.log('=== M04 DB DATA ===');
  console.log(JSON.stringify({
    title: m04.title,
    metaDescription: m04.metaDescription,
    canonical: m04.canonical,
    ogTags: m04.ogTags,
    twitterCards: m04.twitterCards,
    jsonLd: { types: m04.jsonLd?.types, organizationName: m04.jsonLd?.organizationName, websiteName: m04.jsonLd?.websiteName, socialProfiles: m04.jsonLd?.socialProfiles },
    robotsTxt: { present: m04.robotsTxt?.present, blocked: m04.robotsTxt?.blocked, sitemapUrls: m04.robotsTxt?.sitemapUrls },
    sitemap: m04.sitemap,
    favicon: m04.favicon,
    htmlLang: m04.htmlLang,
    hreflang: m04.hreflang,
    preconnectHints: m04.preconnectHints,
    robotsDirectives: m04.robotsDirectives,
    viewport: m04.viewport,
    charset: m04.charset,
    adsTxt: { present: m04.adsTxt?.present, blocked: m04.adsTxt?.blocked, lineCount: m04.adsTxt?.lineCount },
    llmsTxt: m04.llmsTxt,
    manifest: m04.manifest,
    isAMP: m04.isAMP,
    openSearch: m04.openSearch,
    alternateLinks: m04.alternateLinks,
    pagination: m04.pagination,
  }, null, 2));
}

if (m06) {
  console.log('\n=== M06 DB DATA ===');
  console.log(JSON.stringify(m06, null, 2));
}
