/**
 * API Fixture Replayer
 *
 * Replaces `globalThis.fetch` with a version that serves recorded fixtures
 * for DataForSEO and Gemini API calls. Non-API calls pass through normally.
 *
 * Usage: Import and call `installReplayer(domain)` before running modules.
 * Reads fixtures from `testing-modules/fixtures/{domain}/{hash}.json`.
 *
 * WS2-D: Enables full 46-module pipeline testing in CI without API keys.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_BASE = join(__dirname, '..', '..', '..', '..', 'testing-modules', 'fixtures');

/** API hosts we intercept */
const INTERCEPTED_HOSTS = [
  'api.dataforseo.com',
  'generativelanguage.googleapis.com',
];

interface FixtureEntry {
  url: string;
  method: string;
  requestBodyHash: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  recordedAt: string;
}

/**
 * Generate a deterministic hash for a request URL + body (must match recorder).
 */
function hashRequest(url: string, body: string | null): string {
  const h = createHash('sha256');
  h.update(url);
  if (body) h.update(body);
  return h.digest('hex').slice(0, 16);
}

/**
 * Load all fixtures for a domain into an in-memory map.
 */
function loadFixtures(domain: string): Map<string, FixtureEntry> {
  const dir = join(FIXTURES_BASE, domain);
  const fixtures = new Map<string, FixtureEntry>();

  if (!existsSync(dir)) {
    return fixtures;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const fixture = JSON.parse(content) as FixtureEntry;
      // Key by the filename hash (without extension)
      const hash = file.replace('.json', '');
      fixtures.set(hash, fixture);
    } catch {
      // Skip malformed fixtures
    }
  }

  return fixtures;
}

export interface ReplayerStats {
  hits: number;
  misses: number;
  passthrough: number;
}

/**
 * Install fetch interceptor that serves recorded fixtures instead of
 * making real API calls. Non-API calls pass through to real fetch.
 *
 * @param domain - The scan target domain (used to locate fixture files)
 * @returns Object with restore function and hit/miss stats
 */
export function installReplayer(domain: string): { restore: () => void; stats: ReplayerStats } {
  const fixtures = loadFixtures(domain);
  const originalFetch = globalThis.fetch;

  const stats: ReplayerStats = { hits: 0, misses: 0, passthrough: 0 };

  if (fixtures.size === 0) {
    console.warn(`[fixture-replayer] No fixtures found for domain "${domain}" in ${join(FIXTURES_BASE, domain)}`);
  } else {
    console.log(`[fixture-replayer] Loaded ${fixtures.size} fixtures for "${domain}"`);
  }

  globalThis.fetch = async function replayingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept API calls to our tracked hosts
    const isIntercepted = INTERCEPTED_HOSTS.some(host => url.includes(host));
    if (!isIntercepted) {
      stats.passthrough++;
      return originalFetch(input, init);
    }

    // Look up fixture by hash
    const requestBody = init?.body ? String(init.body) : null;
    const hash = hashRequest(url, requestBody);
    const fixture = fixtures.get(hash);

    if (fixture) {
      stats.hits++;

      // Build a synthetic Response from the fixture
      const body = typeof fixture.body === 'string'
        ? fixture.body
        : JSON.stringify(fixture.body);

      return new Response(body, {
        status: fixture.status,
        headers: fixture.headers,
      });
    }

    // Fixture miss — try fuzzy match by URL path (ignore query params / body differences)
    const urlPath = new URL(url).pathname;
    for (const [, f] of fixtures) {
      try {
        const fixtureUrlPath = new URL(f.url).pathname;
        if (fixtureUrlPath === urlPath) {
          stats.hits++;

          const body = typeof f.body === 'string'
            ? f.body
            : JSON.stringify(f.body);

          return new Response(body, {
            status: f.status,
            headers: f.headers,
          });
        }
      } catch {
        // Skip fixtures with invalid URLs
      }
    }

    // No fixture found — return a plausible empty response
    stats.misses++;
    console.warn(`[fixture-replayer] MISS: ${init?.method ?? 'GET'} ${url.slice(0, 100)} (hash=${hash})`);

    // Return a 200 with empty result structure that won't crash modules
    if (url.includes('api.dataforseo.com')) {
      return new Response(JSON.stringify({
        version: '0.1',
        status_code: 20000,
        status_message: 'Ok. [fixture-replay: no fixture found]',
        time: '0 sec.',
        cost: 0,
        tasks_count: 1,
        tasks_error: 0,
        tasks: [{
          id: 'fixture-miss',
          status_code: 20000,
          status_message: 'Ok.',
          time: '0 sec.',
          cost: 0,
          result_count: 0,
          path: [],
          data: null,
          result: null,
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: '{}' }],
            role: 'model',
          },
          finishReason: 'STOP',
        }],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Generic fallback
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  return { restore: () => { globalThis.fetch = originalFetch; }, stats };
}
