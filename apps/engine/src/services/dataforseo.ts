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
 * Get domain ranked keywords.
 */
export async function getDomainRankedKeywords(
  domain: string,
  limit: number = 100,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/ranked_keywords/live',
    [{ target: domain, limit }],
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
    [{ target: domain, limit }],
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
 * Get Google Shopping merchants (for M37).
 */
export async function getGoogleShoppingMerchants(
  domain: string,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/merchant/google/sellers/search/live',
    [{ target: domain }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get Google Business Profile (for M39, M40).
 */
export async function getBusinessProfile(
  domain: string,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/business_data/google/my_business_info/live',
    [{ keyword: domain }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get keyword search volumes (for M34 brand demand).
 */
export async function getKeywordSearchVolume(
  keywords: string[],
  locationCode: number = 2840, // US
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/bulk_keyword_search_volume/live',
    [{ keywords: keywords.slice(0, 50), location_code: locationCode }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get Google Reviews for a business (for M38).
 */
export async function getGoogleReviews(
  keyword: string,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/business_data/google/reviews/live',
    [{ keyword, depth: 20 }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
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
  } = {},
): Promise<unknown> {
  const { type = 'organic', depth = 10, locationCode = 2840 } = options;

  const endpoint = type === 'news'
    ? '/serp/google/news/live/advanced'
    : '/serp/google/organic/live/advanced';

  const response = await dataForSeoPost(
    endpoint,
    [{ keyword, depth, location_code: locationCode }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Get paid keywords for a domain (for M29).
 */
export async function getDomainPaidKeywords(
  domain: string,
  limit: number = 50,
): Promise<unknown> {
  const response = await dataForSeoPost(
    '/dataforseo_labs/google/ranked_keywords/live',
    [{ target: domain, limit, filters: ['keyword_data.keyword_info.search_volume', '>', 0], item_types: ['paid'] }],
  );

  return response.tasks?.[0]?.result?.[0] ?? null;
}

/**
 * Clear the traffic overview cache. Call after each scan completes.
 */
export function clearTrafficCache(): void {
  trafficOverviewCache.clear();
}
