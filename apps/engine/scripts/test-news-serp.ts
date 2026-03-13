/**
 * Diagnostic script for M22/M23 DataForSEO SERP endpoints.
 * Simulates what the fixed M22 fetchNews would extract.
 *
 * Usage: cd apps/engine && npx tsx --env-file=.env scripts/test-news-serp.ts
 */

const BASE_URL = 'https://api.dataforseo.com/v3';

function getAuthHeader(): string {
  const login = process.env['DATAFORSEO_LOGIN'];
  const password = process.env['DATAFORSEO_PASSWORD'];
  if (!login || !password) throw new Error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD');
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

async function post(endpoint: string, payload: unknown[]) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    return null;
  }
  return res.json();
}

interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  url: string;
  date: string;
}

async function main() {
  console.log('M22 fetchNews simulation (with top_stories flattening)\n');

  const response = await post('/serp/google/news/live/advanced', [
    { keyword: 'Nike', depth: 10, location_code: 2840, language_code: 'en', time_range: 'y' },
  ]);

  if (!response) return;

  const rawItems = response.tasks?.[0]?.result?.[0]?.items ?? [];
  console.log(`Raw items from API: ${rawItems.length}`);

  // Flatten top_stories (the fix)
  const flatItems: Array<Record<string, unknown>> = [];
  for (const item of rawItems) {
    if (item.type === 'top_stories' && Array.isArray(item.items)) {
      for (const sub of item.items) flatItems.push(sub);
    } else {
      flatItems.push(item);
    }
  }
  console.log(`After flattening: ${flatItems.length}\n`);

  const seenUrls = new Set<string>();
  const allItems: NewsItem[] = [];

  for (const item of flatItems) {
    const url = (item.url ?? '').slice(0, 500);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    allItems.push({
      title: (item.title ?? '').slice(0, 200),
      snippet: (item.snippet ?? item.description ?? '').slice(0, 300),
      source: (item.source ?? item.domain ?? ''),
      url,
      date: (item.date ?? item.time_published ?? ''),
    });
  }

  console.log(`Extracted articles: ${allItems.length}\n`);

  for (const [i, a] of allItems.entries()) {
    console.log(`${i + 1}. [${a.source}] ${a.title}`);
    console.log(`   Date: ${a.date}`);
    console.log(`   URL: ${a.url.slice(0, 80)}...`);
    if (a.snippet) console.log(`   Snippet: ${a.snippet.slice(0, 100)}...`);
    console.log();
  }
}

main().catch(console.error);
