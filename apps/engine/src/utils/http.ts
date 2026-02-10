import pino from 'pino';

const logger = pino({ name: 'http-util' });

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  maxRedirects?: number;
  retries?: number;
  retryDelay?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  redirectChain: string[];
  finalUrl: string;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000;
const DEFAULT_MAX_REDIRECTS = 10;

/**
 * Fetch with retries, redirect following, header extraction, and timeout.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelay * Math.pow(2, attempt - 1);
      logger.debug({ attempt, delay, url }, 'Retrying fetch');
      await sleep(delay);
    }

    try {
      const result = await fetchWithRedirects(url, {
        method,
        headers,
        body,
        timeout,
        maxRedirects,
      });
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn({ attempt, url, error: lastError.message }, 'Fetch attempt failed');

      // Don't retry on 4xx errors (except 429)
      if (
        lastError instanceof HttpError &&
        lastError.status >= 400 &&
        lastError.status < 500 &&
        lastError.status !== 429
      ) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

async function fetchWithRedirects(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeout: number;
    maxRedirects: number;
  },
): Promise<FetchResult> {
  const redirectChain: string[] = [];
  let currentUrl = url;

  for (let i = 0; i <= options.maxRedirects; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(currentUrl, {
        method: options.method,
        headers: {
          'User-Agent': 'MarketingAlphaScan/1.0 (+https://marketingalphascan.com)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
        redirect: 'manual',
      });

      clearTimeout(timer);

      // Handle redirects manually to track the chain
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new HttpError(
            `Redirect without Location header at ${currentUrl}`,
            response.status,
          );
        }
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const bodyText = await response.text();

      if (!response.ok && response.status !== 304) {
        throw new HttpError(
          `HTTP ${response.status} ${response.statusText} for ${currentUrl}`,
          response.status,
        );
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyText,
        redirectChain,
        finalUrl: currentUrl,
      };
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof HttpError) throw error;

      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new HttpError(`Request timeout after ${options.timeout}ms for ${currentUrl}`, 408);
      }
      throw err;
    }
  }

  throw new HttpError(
    `Too many redirects (>${options.maxRedirects}) starting from ${url}`,
    310,
  );
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Extract specific headers from a response header map.
 */
export function extractHeaders(
  headers: Record<string, string>,
  keys: string[],
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  const lowerHeaders: Record<string, string> = {};

  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  for (const key of keys) {
    result[key] = lowerHeaders[key.toLowerCase()];
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
