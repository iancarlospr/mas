import pino from 'pino';

const logger = pino({ name: 'dataforseo-service' });

const BASE_URL = 'https://api.dataforseo.com/v3';
const MAX_CONCURRENT = 30;

let activeRequests = 0;
const pendingQueue: Array<{
  resolve: () => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Get DataForSEO credentials from environment.
 */
function getCredentials(): { login: string; password: string } {
  const login = process.env['DATAFORSEO_LOGIN'];
  const password = process.env['DATAFORSEO_PASSWORD'];

  if (!login || !password) {
    throw new Error('Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD environment variables');
  }

  return { login, password };
}

/**
 * Build Basic Auth header value.
 */
function getAuthHeader(): string {
  const { login, password } = getCredentials();
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

/**
 * Rate limiting: acquire a slot before making a request.
 */
async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return;
  }

  return new Promise<void>((resolve, reject) => {
    pendingQueue.push({ resolve, reject });
  });
}

/**
 * Rate limiting: release a slot after a request completes.
 */
function releaseSlot(): void {
  activeRequests--;

  const next = pendingQueue.shift();
  if (next) {
    activeRequests++;
    next.resolve();
  }
}

export interface DataForSEOResponse<T = unknown> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: unknown;
    result: T[] | null;
  }>;
}

/**
 * Make a POST request to the DataForSEO API with rate limiting.
 */
export async function dataForSeoPost<T = unknown>(
  endpoint: string,
  body: unknown[],
  timeoutMs: number = 25_000,
): Promise<DataForSEOResponse<T>> {
  await acquireSlot();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      throw new DataForSEOError(
        `DataForSEO API error: ${response.status} ${response.statusText}`,
        response.status,
        text,
      );
    }

    const data = (await response.json()) as DataForSEOResponse<T>;

    if (data.status_code !== 20000) {
      throw new DataForSEOError(
        `DataForSEO task error: ${data.status_message}`,
        data.status_code,
        JSON.stringify(data),
      );
    }

    logger.debug(
      { endpoint, cost: data.cost, taskCount: data.tasks_count },
      'DataForSEO request successful',
    );

    return data;
  } catch (error) {
    if (error instanceof DataForSEOError) throw error;

    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new DataForSEOError(
        `DataForSEO request timeout after ${timeoutMs}ms`,
        408,
        '',
      );
    }

    throw new DataForSEOError(
      `DataForSEO request failed: ${err.message}`,
      0,
      '',
    );
  } finally {
    releaseSlot();
  }
}

/**
 * Make a GET request to the DataForSEO API with rate limiting.
 */
export async function dataForSeoGet<T = unknown>(
  endpoint: string,
  timeoutMs: number = 25_000,
): Promise<DataForSEOResponse<T>> {
  await acquireSlot();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(),
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      throw new DataForSEOError(
        `DataForSEO API error: ${response.status} ${response.statusText}`,
        response.status,
        text,
      );
    }

    const data = (await response.json()) as DataForSEOResponse<T>;
    return data;
  } catch (error) {
    if (error instanceof DataForSEOError) throw error;

    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new DataForSEOError(
        `DataForSEO request timeout after ${timeoutMs}ms`,
        408,
        '',
      );
    }

    throw error;
  } finally {
    releaseSlot();
  }
}

export class DataForSEOError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'DataForSEOError';
  }
}

// ─── DRY Shared Calls ────────────────────────────────────────────────────────

/**
 * Cache for traffic_analytics/overview to avoid duplicate API calls.
 * Key: domain, Value: { data, timestamp }
 */
const trafficOverviewCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Shared traffic analytics overview call.
 * Multiple modules (M25, M26, M27, M31, M33, M36) can use this single call.
 * Results are cached for the duration of a scan to avoid redundant API costs.
 */
export async function getTrafficAnalyticsOverview(
  domain: string,
): Promise<unknown> {
  // Check cache
  const cached = trafficOverviewCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ domain }, 'Using cached traffic analytics overview');
    return cached.data;
  }

  const response = await dataForSeoPost(
    '/dataforseo_labs/google/domain_metrics_by_categories/live',
    [{ target: domain }],
  );

  const result = response.tasks?.[0]?.result?.[0] ?? null;

  trafficOverviewCache.set(domain, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Cache for paid keywords to avoid duplicate API calls between M28 and M29.
 */
const paidKeywordsCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

/**
 * Cache for ranked keywords to avoid duplicate API calls between M26 and M34.
 */
const rankedKeywordsCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

/**
 * Get domain ranked keywords (shared by M26 and M34).
 * Cached for the scan duration.
 */
export async function getDomainRankedKeywords(
  domain: string,
  limit: number = 100,
  itemTypes: string[] = ['organic'],
  orderBy: string[] = ['keyword_data.keyword_info.search_volume,desc'],
): Promise<unknown> {
  const cacheKey = `${domain}:${limit}:${itemTypes.join(',')}`;
  const cached = rankedKeywordsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ domain }, 'Using cached ranked keywords');
    return cached.data;
  }

  const response = await dataForSeoPost(
    '/dataforseo_labs/google/ranked_keywords/live',
    [{ target: domain, limit, location_code: 2840, language_code: 'en', item_types: itemTypes, order_by: orderBy }],
  );

  const result = response.tasks?.[0]?.result?.[0] ?? null;

  rankedKeywordsCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Get domain rank overview across all countries (M25 traffic by country).
 * Returns organic + paid ETV per location when no location_code is specified.
 */
export async function getDomainRankOverview(
  domain: string,
  limit: number = 20,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/domain_rank_overview/live',
    [{ target: domain, language_code: 'en', limit }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get domain competitors.
 */
export async function getDomainCompetitors(
  domain: string,
  limit: number = 20,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/competitors_domain/live',
    [{ target: domain, limit, location_code: 2840, language_code: 'en' }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get domain page intersection (keyword overlap).
 */
export async function getDomainIntersection(
  domain: string,
  competitors: string[],
): Promise<unknown> {
  const targets = Object.fromEntries(
    [domain, ...competitors.slice(0, 4)].map((d, i) => [String(i + 1), d]),
  );

  const response = await dataForSeoPost(
    '/dataforseo_labs/google/domain_intersection/live',
    [{ targets, limit: 100 }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get backlink summary for domain authority.
 */
export async function getBacklinkSummary(
  domain: string,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/backlinks/summary/live',
    [{ target: domain }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Cache for referring domains to avoid duplicate API calls between M30 and M32.
 */
const referringDomainsCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

/**
 * Get backlink referring domains for a domain (shared by M30 and M32).
 * Returns top referring domains sorted by rank. Cached for the scan duration.
 */
export async function getBacklinkReferringDomains(
  domain: string,
  limit: number = 30,
): Promise<unknown> {
  const cacheKey = `${domain}:${limit}`;
  const cached = referringDomainsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ domain }, 'Using cached referring domains');
    return cached.data;
  }

  const response = await dataForSeoPost(
    '/backlinks/referring_domains/live',
    [{ target: domain, limit, order_by: ['backlinks,desc'] }],
  );

  const result = response.tasks?.[0]?.result?.[0] ?? null;

  referringDomainsCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Get backlink anchor text distribution for a domain (for M32 enrichment).
 * Returns top anchors sorted by backlink count.
 */
export async function getBacklinkAnchors(
  domain: string,
  limit: number = 20,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/backlinks/anchors/live',
    [{ target: domain, limit, order_by: ['backlinks,desc'] }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get Google Shopping products for a domain (M36).
 * Uses async task_post → poll → task_get flow since Merchant API has no live endpoint.
 * Returns null if task doesn't complete within timeout.
 */
export async function getGoogleShoppingProducts(
  domain: string,
  maxWaitMs: number = 25_000,
): Promise<unknown> {
  // Use brand name as keyword (not domain) — Google Shopping searches by product/brand
  const brandName = domain.replace(/\.[^.]+$/, '');

  // Step 1: Post the task
  const postResponse = await dataForSeoPost(
    '/merchant/google/products/task_post',
    [{ keyword: brandName, location_code: 2840, language_code: 'en', priority: 1 }],
  );

  const taskId = postResponse.tasks?.[0]?.id;
  if (!taskId) {
    logger.warn({ domain }, 'Google Shopping task_post returned no task ID');
    return null;
  }

  // Step 2: Poll for completion
  const pollInterval = 2_000;
  const maxAttempts = Math.floor(maxWaitMs / pollInterval);
  let ready = false;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const readyResponse = await dataForSeoGet<{ id: string }>('/merchant/google/products/tasks_ready');
      const readyTasks = readyResponse.tasks?.[0]?.result ?? [];
      if (readyTasks.some((t: { id: string }) => t.id === taskId)) {
        ready = true;
        break;
      }
    } catch {
      // tasks_ready can transiently fail — keep polling
    }
  }

  if (!ready) {
    logger.debug({ domain, taskId }, 'Google Shopping task not ready within timeout');
    return null;
  }

  // Step 3: Fetch results
  const getResponse = await dataForSeoGet(
    `/merchant/google/products/task_get/advanced/${taskId}`,
  );

  return getResponse.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Cache for business profile to avoid duplicate API calls between M37, M38, M39.
 */
const businessProfileCache = new Map<
  string,
  { data: unknown; timestamp: number }
>();

/**
 * Get Google Business Profile (shared by M37, M38, M39).
 * Returns the business name, place_id, CID, rating, address, etc.
 * Tries the domain first, then falls back to brand name if no results.
 * Cached for the scan duration.
 */
export async function getBusinessProfile(
  domain: string,
): Promise<unknown> {
  const cached = businessProfileCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ domain }, 'Using cached business profile');
    return cached.data;
  }

  // Try domain first (works for well-known brands like nike.com)
  let result = await fetchBusinessInfo(domain);

  // Fallback: try brand name (works for local businesses like "Maderas 3C")
  if (!result || !hasItems(result)) {
    // Extract brand: shop.maderas3c.com → maderas3c, www.nike.com → nike
    const parts = domain.replace(/^www\./, '').split('.');
    const brandName = parts.length >= 2 ? parts[parts.length - 2]! : parts[0]!;
    if (brandName !== domain) {
      logger.debug({ domain, brandName }, 'No GBP for domain, trying brand name');
      result = await fetchBusinessInfo(brandName);
    }
  }

  businessProfileCache.set(domain, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

async function fetchBusinessInfo(keyword: string): Promise<unknown> {
  try {
    const response = await dataForSeoPost(
      '/business_data/google/my_business_info/live',
      [{ keyword, location_code: 2840, language_code: 'en' }],
      45_000,
    );
    return response.tasks?.[0]?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

function hasItems(result: unknown): boolean {
  const items = (result as Record<string, unknown>)?.['items'];
  return Array.isArray(items) && items.length > 0;
}

/**
 * Get keyword search volumes (for M34 brand demand).
 */
export async function getKeywordSearchVolume(
  keywords: string[],
  locationCode: number = 2840, // US
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/keyword_overview/live',
    [{ keywords: keywords.slice(0, 50), location_code: locationCode, language_code: 'en' }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get Google Reviews for a business (M37).
 * Uses async task_post → poll → task_get flow since Reviews API has no live endpoint.
 */
export async function getGoogleReviews(
  keyword: string,
  depth: number = 40,
  sortBy: string = 'newest',
  maxWaitMs: number = 25_000,
): Promise<unknown> {
  // Step 1: Post the task
  const postResponse = await dataForSeoPost(
    '/business_data/google/reviews/task_post',
    [{ keyword, depth, sort_by: sortBy, location_code: 2840, language_code: 'en', priority: 1 }],
  );

  const taskId = postResponse.tasks?.[0]?.id;
  if (!taskId) {
    logger.warn({ keyword }, 'Google Reviews task_post returned no task ID');
    return null;
  }

  // Step 2: Poll for completion
  const pollInterval = 2_000;
  const maxAttempts = Math.floor(maxWaitMs / pollInterval);

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const readyResponse = await dataForSeoGet<{ id: string }>('/business_data/google/reviews/tasks_ready');
      const readyTasks = readyResponse.tasks?.[0]?.result ?? [];
      if (readyTasks.some((t: { id: string }) => t.id === taskId)) {
        // Step 3: Fetch results
        const getResponse = await dataForSeoGet(
          `/business_data/google/reviews/task_get/${taskId}`,
        );
        return getResponse.tasks?.[0]?.result?.[0] ?? null;
      }
    } catch {
      // tasks_ready can transiently fail — keep polling
    }
  }

  logger.debug({ keyword, taskId }, 'Google Reviews task not ready within timeout');
  return null;
}

/**
 * Run a SERP search (for M22 news, M23 social).
 */
export async function getSerpResults(
  keyword: string,
  options: {
    type?: 'organic' | 'news';
    depth?: number;
    locationCode?: number;
    timeRange?: string; // DataForSEO: 'y' (past year), 'm' (past month), 'w' (past week), 'd' (past day)
  } = {},
): Promise<unknown> {
  const { type = 'organic', depth = 10, locationCode = 2840, timeRange } = options;

  const endpoint = type === 'news'
    ? '/serp/google/news/live/advanced'
    : '/serp/google/organic/live/advanced';

  const payload: Record<string, unknown> = { keyword, depth, location_code: locationCode, language_code: 'en' };
  if (timeRange) payload.time_range = timeRange;

  const response = await dataForSeoPost(endpoint, [payload]);

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Convert ISO 3166-1 alpha-2 country code to DataForSEO location code.
 * Falls back to US (2840) for unknown codes.
 */
const COUNTRY_TO_DATAFORSEO_LOCATION: Record<string, number> = {
  // North America
  US: 2840, CA: 2124, MX: 2484,
  // Caribbean & US Territories
  PR: 2630, VI: 2850, GU: 2316,
  DO: 2214, CU: 2192, JM: 2388, TT: 2780, BS: 2044, BB: 2052,
  HT: 2332, KY: 2136, AW: 2533, CW: 2531, BM: 2060, TC: 2796,
  AG: 2028, LC: 2662, GD: 2308, VC: 2670, KN: 2659, DM: 2212,
  // Central America
  GT: 2320, HN: 2340, SV: 2222, NI: 2558, CR: 2188, PA: 2591, BZ: 2084,
  // South America
  BR: 2076, AR: 2032, CO: 2170, CL: 2152, PE: 2604, VE: 2862,
  EC: 2218, BO: 2068, PY: 2600, UY: 2858, GY: 2328, SR: 2740,
  // Europe
  GB: 2826, DE: 2276, FR: 2250, ES: 2724, IT: 2380, PT: 2620, NL: 2528,
  BE: 2056, AT: 2040, CH: 2756, SE: 2752, NO: 2578, DK: 2208, FI: 2246,
  IE: 2372, PL: 2616, CZ: 2203, RO: 2642, HU: 2348, GR: 2300,
  // Asia-Pacific
  AU: 2036, NZ: 2554, IN: 2356, JP: 2392, KR: 2410, SG: 2702,
  MY: 2458, TH: 2764, HK: 2344, TW: 2158, ID: 2360,
  // Middle East & Africa
  IL: 2376, AE: 2784, SA: 2682, ZA: 2710, EG: 2818, TR: 2792,
};

export function getDataForSEOLocationCode(countryCode: string): number {
  return COUNTRY_TO_DATAFORSEO_LOCATION[countryCode] ?? 2840;
}

/**
 * Convert ISO 3166-1 alpha-2 country code to English display name.
 */
export function getCountryDisplayName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? '';
  } catch {
    return '';
  }
}

/**
 * Find SERP competitors for a set of keywords.
 * Given specific keywords, returns all domains ranking for them with visibility
 * scores, traffic estimates, keyword counts, and per-keyword positions.
 * This is the precision competitor discovery endpoint.
 */
export async function getSerpCompetitors(
  keywords: string[],
  limit: number = 20,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/serp_competitors/live',
    [{
      keywords: keywords.slice(0, 200),
      limit,
      location_code: 2840,
      language_code: 'en',
      item_types: ['organic', 'paid'],
    }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get paid keywords for a domain (shared by M28 and M29).
 * Cached for the duration of a scan to avoid duplicate API calls.
 */
export async function getDomainPaidKeywords(
  domain: string,
  limit: number = 50,
): Promise<unknown> {
  const cacheKey = `${domain}:${limit}`;
  const cached = paidKeywordsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug({ domain }, 'Using cached paid keywords');
    return cached.data;
  }

  const response = await dataForSeoPost(
    '/dataforseo_labs/google/ranked_keywords/live',
    [{ target: domain, limit, filters: ['keyword_data.keyword_info.search_volume', '>', 0], item_types: ['paid'] }],
  );

  const result = response.tasks?.[0]?.result?.[0] ?? null;

  paidKeywordsCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Clear the traffic overview cache. Call after each scan completes.
 */
export function clearTrafficCache(): void {
  trafficOverviewCache.clear();
  paidKeywordsCache.clear();
  referringDomainsCache.clear();
  businessProfileCache.clear();
  rankedKeywordsCache.clear();
}
