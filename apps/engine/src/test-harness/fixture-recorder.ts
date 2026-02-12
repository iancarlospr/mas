/**
 * API Fixture Recorder
 *
 * Intercepts outgoing fetch() calls to DataForSEO and Gemini APIs,
 * saves request/response pairs to disk as JSON fixtures.
 *
 * Usage: Import and call `installRecorder(domain)` before running modules.
 * Fixtures are saved to `testing-modules/fixtures/{domain}/{hash}.json`.
 *
 * WS2-D: Enables CI replay of external API calls without credentials.
 */

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
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
 * Generate a deterministic hash for a request URL + body.
 * Used as the fixture filename.
 */
function hashRequest(url: string, body: string | null): string {
  const h = createHash('sha256');
  h.update(url);
  if (body) h.update(body);
  return h.digest('hex').slice(0, 16);
}

/**
 * Get the fixture directory for a given scan domain.
 */
function getFixtureDir(domain: string): string {
  return join(FIXTURES_BASE, domain);
}

/**
 * Install fetch interceptor that records API responses to fixture files.
 *
 * Wraps `globalThis.fetch` — all DataForSEO and Gemini API calls are
 * transparently recorded while still returning real responses.
 *
 * @param domain - The scan target domain (used to organize fixture files)
 * @returns Cleanup function to restore original fetch
 */
export function installRecorder(domain: string): { restore: () => void; fixtureCount: number } {
  const fixtureDir = getFixtureDir(domain);
  mkdirSync(fixtureDir, { recursive: true });

  const originalFetch = globalThis.fetch;
  let fixtureCount = 0;

  const state = { fixtureCount };

  globalThis.fetch = async function recordingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept API calls to our tracked hosts
    const isIntercepted = INTERCEPTED_HOSTS.some(host => url.includes(host));
    if (!isIntercepted) {
      return originalFetch(input, init);
    }

    // Execute the real request
    const response = await originalFetch(input, init);

    // Clone response so we can read the body without consuming it
    const cloned = response.clone();

    // Read response body
    let responseBody: unknown;
    try {
      responseBody = await cloned.json();
    } catch {
      responseBody = await cloned.text();
    }

    // Get request body
    const requestBody = init?.body ? String(init.body) : null;
    const hash = hashRequest(url, requestBody);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Build fixture entry
    const fixture: FixtureEntry = {
      url,
      method: init?.method ?? 'GET',
      requestBodyHash: requestBody ? createHash('sha256').update(requestBody).digest('hex').slice(0, 16) : '',
      status: response.status,
      headers: responseHeaders,
      body: responseBody,
      recordedAt: new Date().toISOString(),
    };

    // Save to disk
    const fixturePath = join(fixtureDir, `${hash}.json`);
    try {
      writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
      state.fixtureCount++;
    } catch (err) {
      console.warn(`[fixture-recorder] Failed to save fixture: ${(err as Error).message}`);
    }

    return response;
  };

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    get fixtureCount() {
      return state.fixtureCount;
    },
  };
}
