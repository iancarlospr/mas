/**
 * Cloudflare Browser Rendering — crawl + single-page content APIs.
 *
 * Replaces per-module HTTP probing with a single crawl job that discovers
 * pages via sitemaps + link following, returns JS-rendered HTML, and feeds
 * results to all passive modules.
 *
 * Env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 */
import pino from 'pino';

const logger = pino({ name: 'cloudflare-crawl' });

// ── Config ──────────────────────────────────────────────────────────────────

let _available: boolean | null = null;

export function isAvailable(): boolean {
  if (_available !== null) return _available;
  _available = !!(process.env['CLOUDFLARE_ACCOUNT_ID'] && process.env['CLOUDFLARE_API_TOKEN']);
  return _available;
}

function getConfig() {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']!;
  const apiToken = process.env['CLOUDFLARE_API_TOKEN']!;
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  return { accountId, apiToken, baseUrl };
}

function authHeaders(): Record<string, string> {
  const { apiToken } = getConfig();
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface CrawlOptions {
  limit?: number;
  depth?: number;
  source?: 'all' | 'sitemaps' | 'links';
  formats?: ('html' | 'markdown')[];
  render?: boolean;
  rejectResourceTypes?: string[];
}

export interface CrawledPage {
  url: string;
  status: 'completed' | 'errored' | 'disallowed' | 'skipped' | 'queued' | 'cancelled';
  html?: string;
  metadata: { status: number; title: string; url: string };
}

export interface CrawlJobResult {
  id: string;
  status: 'running' | 'completed' | 'errored' | 'cancelled_due_to_timeout' | 'cancelled_due_to_limits' | 'cancelled_by_user';
  total: number;
  finished: number;
  records: CrawledPage[];
  cursor?: number;
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Submit a crawl job. Returns the job ID.
 */
export async function submitCrawl(url: string, options?: CrawlOptions): Promise<string> {
  const { baseUrl } = getConfig();

  const body = {
    url,
    limit: options?.limit ?? 50,
    depth: options?.depth ?? 2,
    source: options?.source ?? 'all',
    formats: options?.formats ?? ['html'],
    render: options?.render ?? true,
    rejectResourceTypes: options?.rejectResourceTypes ?? ['image', 'media', 'font'],
  };

  const resp = await fetch(`${baseUrl}/browser-rendering/crawl`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Cloudflare crawl submit failed: ${resp.status} ${text.slice(0, 200)}`);
  }

  const json = await resp.json() as { result?: string | { id?: string }; success?: boolean };
  // API returns job ID either as result directly (string) or as result.id
  const jobId = typeof json.result === 'string'
    ? json.result
    : json.result?.id;
  if (!jobId) {
    throw new Error(`Cloudflare crawl submit returned no job ID: ${JSON.stringify(json).slice(0, 200)}`);
  }

  logger.info({ url, jobId, limit: body.limit }, 'Cloudflare crawl submitted');
  return jobId;
}

/**
 * Get crawl status and records for a job.
 */
export async function getCrawlStatus(
  jobId: string,
  limit?: number,
  statusFilter?: string,
): Promise<CrawlJobResult> {
  const { baseUrl } = getConfig();

  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (statusFilter) params.set('status', statusFilter);

  const url = `${baseUrl}/browser-rendering/crawl/${jobId}${params.toString() ? `?${params}` : ''}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Cloudflare crawl status failed: ${resp.status} ${text.slice(0, 200)}`);
  }

  const json = await resp.json() as {
    result?: {
      id: string;
      status: CrawlJobResult['status'];
      total: number;
      finished: number;
      data: CrawledPage[];
      cursor?: number;
    };
  };

  const r = json.result;
  if (!r) {
    throw new Error(`Cloudflare crawl status returned no result: ${JSON.stringify(json).slice(0, 200)}`);
  }

  // Log raw response shape for debugging
  logger.debug({
    jobId,
    resultKeys: Object.keys(r),
    status: r.status,
    total: r.total,
    finished: r.finished,
    dataLength: Array.isArray(r.data) ? r.data.length : 'not-array',
    rawSnippet: JSON.stringify(r).slice(0, 500),
  }, 'Cloudflare crawl status raw');

  return {
    id: r.id,
    status: r.status,
    total: r.total,
    finished: r.finished,
    records: r.data ?? [],
    cursor: r.cursor,
  };
}

/**
 * Fetch JS-rendered HTML for a single page via Cloudflare /content endpoint.
 * Returns null on failure.
 */
export async function fetchRenderedContent(url: string): Promise<string | null> {
  if (!isAvailable()) return null;

  const { baseUrl } = getConfig();

  try {
    const resp = await fetch(`${baseUrl}/browser-rendering/content`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        url,
        rejectResourceTypes: ['image', 'media', 'font'],
        gotoOptions: { waitUntil: 'domcontentloaded' },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) return null;

    const json = await resp.json() as { result?: string; success?: boolean };
    return json.result ?? null;
  } catch (error) {
    logger.debug({ url, error: (error as Error).message }, 'Cloudflare /content fetch failed');
    return null;
  }
}

// ── High-level ──────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set([
  'completed', 'errored', 'cancelled_due_to_timeout',
  'cancelled_due_to_limits', 'cancelled_by_user',
]);

/**
 * Poll an existing crawl job until done or maxWait exceeded.
 * Returns all completed pages as a Map<url, CrawledPage>.
 */
export async function pollUntilDone(
  jobId: string,
  options?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
  },
): Promise<{ pages: Map<string, CrawledPage>; jobStatus: string }> {
  const pollInterval = options?.pollIntervalMs ?? 3_000;
  const maxWait = options?.maxWaitMs ?? 20_000;

  const pages = new Map<string, CrawledPage>();
  const start = Date.now();
  let lastStatus = 'running';

  while (Date.now() - start < maxWait) {
    try {
      const result = await getCrawlStatus(jobId, 100);
      lastStatus = result.status;

      logger.debug({ jobId, status: result.status, total: result.total, finished: result.finished, records: result.records.length }, 'Crawl poll tick');

      // Collect completed pages
      for (const record of result.records) {
        if (record.status === 'completed' && record.html) {
          pages.set(normalizePageUrl(record.url), record);
        }
      }

      if (TERMINAL_STATUSES.has(result.status)) {
        break;
      }

      // Wait before next poll
      await sleep(pollInterval);
    } catch (error) {
      logger.warn({ jobId, error: (error as Error).message }, 'Crawl poll error');
      break;
    }
  }

  logger.info(
    { jobId, pagesFound: pages.size, jobStatus: lastStatus, durationMs: Date.now() - start },
    'Crawl poll complete',
  );

  return { pages, jobStatus: lastStatus };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizePageUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip trailing slash, lowercase host
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
