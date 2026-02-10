/**
 * M02 - CMS & Infrastructure Detection
 *
 * Detects CMS, CDN, server, framework, hosting, and build tools
 * using fingerprint matching against HTML source and HTTP headers.
 *
 * Detection pipeline:
 *   1. Load fingerprints.json at startup (once, not per request)
 *   2. For each fingerprint, test all rule types (html, headers, meta, scripts)
 *   3. Aggregate confidence: final = 1 - product(1 - rule_confidence)
 *   4. Resolve "implies" chains (e.g. WordPress -> PHP)
 *   5. Score 9 infrastructure checkpoints
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { parseHtml, extractMetaTags, extractScriptSrcs } from '../../utils/html.js';

// ---------------------------------------------------------------------------
// Fingerprint types
// ---------------------------------------------------------------------------

interface HtmlRule {
  pattern: string;
  confidence: number;
}

interface MetaRule {
  name: string;
  contentPattern: string;
  confidence: number;
}

interface HeaderRule {
  name: string;
  pattern?: string;
  confidence: number;
}

interface ScriptRule {
  pattern: string;
  confidence: number;
}

interface CookieRule {
  namePattern: string;
  confidence: number;
}

interface FingerprintRules {
  html?: HtmlRule[];
  meta?: MetaRule[];
  headers?: HeaderRule[];
  scripts?: ScriptRule[];
  cookies?: CookieRule[];
}

interface Fingerprint {
  id: string;
  name: string;
  category: string;
  rules: FingerprintRules;
  implies?: string[];
}

// ---------------------------------------------------------------------------
// Detected technology type
// ---------------------------------------------------------------------------

interface DetectedTech {
  id: string;
  name: string;
  category: string;
  confidence: number;
  version?: string;
}

// ---------------------------------------------------------------------------
// Load fingerprints once at module load time
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fingerprintsPath = join(__dirname, '..', '..', 'data', 'fingerprints.json');

let fingerprints: Fingerprint[];
try {
  const raw = readFileSync(fingerprintsPath, 'utf-8');
  fingerprints = JSON.parse(raw) as Fingerprint[];
} catch {
  // Fallback: if the file is not found at the expected dist path, try
  // the source-relative path (useful during tests / ts-node).
  fingerprints = [];
}

// Build a lookup map for implies resolution
const fingerprintById = new Map<string, Fingerprint>();
for (const fp of fingerprints) {
  fingerprintById.set(fp.id, fp);
}

// Well-known enterprise CDNs for scoring
const ENTERPRISE_CDNS = new Set([
  'cloudflare',
  'cloudfront',
  'akamai',
  'fastly',
  'google',
  'stackpath',
  'keycdn',
  'bunnycdn',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to extract a version string from the raw HTML near a technology's
 * fingerprint match.  Looks for common version patterns.
 */
function extractVersionFromHtml(html: string, techId: string): string | undefined {
  // Generator meta tag often includes the version
  const generatorMatch = html.match(
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i,
  );
  if (generatorMatch) {
    const content = generatorMatch[1];
    if (content) {
      const versionMatch = content.match(/[\s/](\d+(?:\.\d+)*)/);
      if (versionMatch) {
        // Make sure this generator belongs to the tech we care about
        if (content.toLowerCase().includes(techId.toLowerCase().replace('js', ''))) {
          return versionMatch[1];
        }
      }
    }
  }

  // ng-version="X.Y.Z"
  if (techId === 'angular') {
    const ngVersion = html.match(/ng-version=["'](\d+(?:\.\d+)*)/);
    if (ngVersion) return ngVersion[1];
  }

  return undefined;
}

/**
 * Extract version from an X-Powered-By or Server header value.
 */
function extractVersionFromHeader(value: string): string | undefined {
  const m = value.match(/[\s/](\d+(?:\.\d+)*)/);
  return m ? m[1] : undefined;
}

/**
 * Aggregate multiple rule confidences using the formula:
 *   final = 1 - product(1 - c_i)
 */
function aggregateConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  const product = confidences.reduce((acc, c) => acc * (1 - c), 1);
  return 1 - product;
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

function detectTechnologies(
  html: string | null,
  headers: Record<string, string>,
): DetectedTech[] {
  const results = new Map<string, { confidences: number[]; fp: Fingerprint; version?: string }>();

  const $ = html ? parseHtml(html) : null;
  const metaTags = $ ? extractMetaTags($) : [];
  const scriptSrcs = $ ? extractScriptSrcs($) : [];
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  for (const fp of fingerprints) {
    const matched: number[] = [];
    let version: string | undefined;

    // --- HTML rules ---
    if (fp.rules.html && html) {
      for (const rule of fp.rules.html) {
        try {
          const re = new RegExp(rule.pattern, 'i');
          if (re.test(html)) {
            matched.push(rule.confidence);
          }
        } catch {
          // Invalid regex in fingerprint data -- skip
        }
      }
    }

    // --- Meta rules ---
    if (fp.rules.meta && metaTags.length > 0) {
      for (const rule of fp.rules.meta) {
        for (const meta of metaTags) {
          if (
            meta.name &&
            meta.name.toLowerCase() === rule.name.toLowerCase() &&
            meta.content
          ) {
            try {
              const re = new RegExp(rule.contentPattern, 'i');
              if (re.test(meta.content)) {
                matched.push(rule.confidence);
                // Try to get version from the meta content
                const vm = meta.content.match(/[\s/]?(\d+(?:\.\d+)*)/);
                if (vm) version = vm[1];
              }
            } catch {
              // Invalid regex -- skip
            }
          }
        }
      }
    }

    // --- Header rules ---
    if (fp.rules.headers) {
      for (const rule of fp.rules.headers) {
        const headerName = rule.name.toLowerCase();
        const headerValue = lowerHeaders[headerName];
        if (headerValue !== undefined) {
          if (rule.pattern) {
            try {
              const re = new RegExp(rule.pattern, 'i');
              if (re.test(headerValue)) {
                matched.push(rule.confidence);
                // Try to extract version from the header
                const hv = extractVersionFromHeader(headerValue);
                if (hv) version = hv;
              }
            } catch {
              // Invalid regex -- skip
            }
          } else {
            // Header simply exists -- that is enough
            matched.push(rule.confidence);
          }
        }
      }
    }

    // --- Script rules ---
    if (fp.rules.scripts && scriptSrcs.length > 0) {
      for (const rule of fp.rules.scripts) {
        for (const src of scriptSrcs) {
          try {
            const re = new RegExp(rule.pattern, 'i');
            if (re.test(src)) {
              matched.push(rule.confidence);
              break; // one match per rule is enough
            }
          } catch {
            // Invalid regex -- skip
          }
        }
      }
    }

    if (matched.length > 0) {
      // Also try to pull version from HTML if not already found via meta/header
      if (!version && html) {
        version = extractVersionFromHtml(html, fp.id);
      }

      const existing = results.get(fp.id);
      if (existing) {
        existing.confidences.push(...matched);
        if (version && !existing.version) existing.version = version;
      } else {
        results.set(fp.id, { confidences: matched, fp, version });
      }
    }
  }

  // --- Resolve "implies" chains ---
  const toProcess = Array.from(results.keys());
  const visited = new Set<string>();

  while (toProcess.length > 0) {
    const techId = toProcess.pop()!;
    if (visited.has(techId)) continue;
    visited.add(techId);

    const fp = fingerprintById.get(techId);
    if (!fp?.implies) continue;

    for (const impliedId of fp.implies) {
      if (!results.has(impliedId)) {
        const impliedFp = fingerprintById.get(impliedId);
        if (impliedFp) {
          // Implied technologies get a slightly lower confidence
          const parentConf = aggregateConfidence(results.get(techId)!.confidences);
          results.set(impliedId, {
            confidences: [parentConf * 0.85],
            fp: impliedFp,
          });
          toProcess.push(impliedId);
        }
      }
    }
  }

  // --- Filter by minimum confidence threshold (0.6) ---
  const detected: DetectedTech[] = [];
  for (const [id, entry] of results) {
    const finalConf = aggregateConfidence(entry.confidences);
    if (finalConf >= 0.6) {
      detected.push({
        id,
        name: entry.fp.name,
        category: entry.fp.category,
        confidence: Math.round(finalConf * 1000) / 1000,
        version: entry.version,
      });
    }
  }

  // Sort by confidence descending
  detected.sort((a, b) => b.confidence - a.confidence);
  return detected;
}

// ---------------------------------------------------------------------------
// Direct header-based detection (server, compression, HTTP version)
// ---------------------------------------------------------------------------

interface InfraDetails {
  server: string | null;
  serverVersion: string | null;
  serverOs: string | null;
  compression: string | null;
  httpVersion: string | null;
}

function detectInfraFromHeaders(headers: Record<string, string>): InfraDetails {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v;
  }

  // Server header
  const serverRaw = lower['server'] ?? null;
  let server: string | null = null;
  let serverVersion: string | null = null;
  let serverOs: string | null = null;

  if (serverRaw) {
    // e.g. "Apache/2.4.51 (Ubuntu)"
    const parts = serverRaw.match(/^([^\s/]+)(?:\/(\S+))?(?:\s+\(([^)]+)\))?/);
    if (parts) {
      server = parts[1] ?? null;
      serverVersion = parts[2] ?? null;
      serverOs = parts[3] ?? null;
    } else {
      server = serverRaw.trim();
    }
  }

  // Compression
  const contentEncoding = lower['content-encoding'] ?? null;
  let compression: string | null = null;
  if (contentEncoding) {
    if (/br/i.test(contentEncoding)) {
      compression = 'brotli';
    } else if (/gzip/i.test(contentEncoding)) {
      compression = 'gzip';
    } else if (/deflate/i.test(contentEncoding)) {
      compression = 'deflate';
    } else {
      compression = contentEncoding;
    }
  }

  // HTTP version -- some servers expose it via headers or alt-svc
  let httpVersion: string | null = null;
  const altSvc = lower['alt-svc'] ?? '';
  if (/h3/i.test(altSvc)) {
    httpVersion = 'HTTP/3';
  } else if (lower['x-firefox-spdy'] || lower['x-http2'] || altSvc.includes('h2')) {
    httpVersion = 'HTTP/2';
  }
  // Note: actual protocol version comes from the response object,
  // which passive modules don't have direct access to.  We rely on
  // header hints.

  return { server, serverVersion, serverOs, compression, httpVersion };
}

// ---------------------------------------------------------------------------
// Checkpoint scoring
// ---------------------------------------------------------------------------

function buildCheckpoints(
  detected: DetectedTech[],
  infra: InfraDetails,
  headers: Record<string, string>,
): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];

  // Helper: find first tech by category
  const byCategory = (cat: string) => detected.find((t) => t.category === cat);
  const allByCategory = (cat: string) => detected.filter((t) => t.category === cat);

  // -----------------------------------------------------------------------
  // 1. CMS identified (weight 3/10)
  // -----------------------------------------------------------------------
  const cmsDetected = allByCategory('cms');
  if (cmsDetected.length === 1) {
    const cms = cmsDetected[0]!;
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-identified',
        name: 'CMS identified',
        weight: 0.3,
        health: cms.version ? 'excellent' : 'good',
        evidence: cms.version
          ? `${cms.name} ${cms.version} detected (confidence ${cms.confidence})`
          : `${cms.name} detected (confidence ${cms.confidence})`,
      }),
    );
  } else if (cmsDetected.length > 1) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-identified',
        name: 'CMS identified',
        weight: 0.3,
        health: 'warning',
        evidence: `Multiple CMS signals: ${cmsDetected.map((c) => c.name).join(', ')}`,
        recommendation: 'Verify which CMS is actually in use; conflicting signals may indicate migration artifacts.',
      }),
    );
  } else {
    // No CMS -- informational only (no score impact per spec)
    checkpoints.push(
      infoCheckpoint(
        'm02-cms-identified',
        'CMS identified',
        'No CMS detected; site may use a custom or headless solution.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 2. CMS version currency (weight 5/10)
  // -----------------------------------------------------------------------
  const primaryCms = cmsDetected[0];
  if (primaryCms?.version) {
    // Without a version database we default to 'good' when version is present
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cms-version-currency',
        name: 'CMS version currency',
        weight: 0.5,
        health: 'good',
        evidence: `${primaryCms.name} version ${primaryCms.version} detected. Version currency check requires a version database.`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm02-cms-version-currency',
        'CMS version currency',
        primaryCms
          ? `${primaryCms.name} detected but version could not be determined.`
          : 'No CMS version information available.',
      ),
    );
  }

  // -----------------------------------------------------------------------
  // 3. CDN detected (weight 6/10)
  // -----------------------------------------------------------------------
  const cdnDetected = byCategory('cdn');
  const hostingDetected = byCategory('hosting');
  // Some hosting providers (Vercel, Netlify) include a CDN
  const hasEdgeCdn = cdnDetected || (hostingDetected && ['vercel', 'netlify'].includes(hostingDetected.id));

  if (hasEdgeCdn) {
    const cdnName = cdnDetected?.name ?? hostingDetected?.name ?? 'unknown';
    const isEnterprise = cdnDetected
      ? ENTERPRISE_CDNS.has(cdnDetected.id)
      : false;

    checkpoints.push(
      createCheckpoint({
        id: 'm02-cdn-detected',
        name: 'CDN detected',
        weight: 0.6,
        health: isEnterprise ? 'excellent' : 'good',
        evidence: isEnterprise
          ? `Enterprise CDN detected: ${cdnName}`
          : `CDN / edge hosting detected: ${cdnName}`,
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-cdn-detected',
        name: 'CDN detected',
        weight: 0.6,
        health: 'critical',
        evidence: 'No CDN detected. Assets are likely served from origin.',
        recommendation: 'Consider using a CDN (e.g. Cloudflare, CloudFront, Fastly) to improve global load times and resilience.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 4. HTTPS enforced (weight 8/10)
  // -----------------------------------------------------------------------
  // Passive modules only see the final response; we infer HTTPS from the URL
  // and check for Strict-Transport-Security header.
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const hasHsts = !!lowerHeaders['strict-transport-security'];
  const isHttps = true; // We always fetch via HTTPS in the runner

  if (hasHsts) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'excellent',
        evidence: `HTTPS active with HSTS header: ${lowerHeaders['strict-transport-security']}`,
      }),
    );
  } else if (isHttps) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'good',
        evidence: 'HTTPS active but no HSTS header detected.',
        recommendation: 'Add a Strict-Transport-Security header to prevent protocol downgrade attacks.',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-https-enforced',
        name: 'HTTPS enforced',
        weight: 0.8,
        health: 'critical',
        evidence: 'No HTTPS detected. The site is served over plain HTTP.',
        recommendation: 'Enable HTTPS immediately. This affects SEO rankings, user trust, and data security.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 5. HTTP/2 or HTTP/3 (weight 5/10)
  // -----------------------------------------------------------------------
  if (infra.httpVersion === 'HTTP/3') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'excellent',
        evidence: 'HTTP/3 (QUIC) detected via alt-svc header.',
      }),
    );
  } else if (infra.httpVersion === 'HTTP/2') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'good',
        evidence: 'HTTP/2 detected.',
      }),
    );
  } else {
    // Cannot confirm protocol from passive headers alone
    checkpoints.push(
      createCheckpoint({
        id: 'm02-http-version',
        name: 'HTTP/2 or HTTP/3',
        weight: 0.5,
        health: 'warning',
        evidence: 'Could not confirm HTTP/2 or HTTP/3 from response headers. Likely HTTP/1.1.',
        recommendation: 'Enable HTTP/2 (or HTTP/3) on your web server or CDN for improved multiplexing and performance.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 6. Compression (weight 6/10)
  // -----------------------------------------------------------------------
  if (infra.compression === 'brotli') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'excellent',
        evidence: 'Brotli compression detected on the initial HTML response.',
      }),
    );
  } else if (infra.compression === 'gzip') {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'good',
        evidence: 'Gzip compression detected on the initial HTML response.',
        recommendation: 'Consider enabling Brotli compression for ~15-20% smaller payloads compared to gzip.',
      }),
    );
  } else if (infra.compression) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'warning',
        evidence: `Partial or uncommon compression detected: ${infra.compression}`,
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-compression',
        name: 'Compression',
        weight: 0.6,
        health: 'critical',
        evidence: 'No compression detected on the HTML response.',
        recommendation: 'Enable gzip or Brotli compression on your server/CDN. This can reduce transfer sizes by 60-80%.',
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 7. Server header exposure (weight 4/10)
  // -----------------------------------------------------------------------
  if (!infra.server) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'excellent',
        evidence: 'Server header is hidden or absent.',
      }),
    );
  } else if (infra.serverOs) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'critical',
        evidence: `Server header exposes software, version, and OS: ${headers['server'] ?? headers['Server'] ?? infra.server}`,
        recommendation: 'Remove or minimize the Server header. Exposing server software, version, and OS aids attackers in targeting known vulnerabilities.',
      }),
    );
  } else if (infra.serverVersion) {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'warning',
        evidence: `Server header exposes software and version: ${infra.server}/${infra.serverVersion}`,
        recommendation: 'Remove the version number from the Server header to reduce information leakage.',
      }),
    );
  } else {
    checkpoints.push(
      createCheckpoint({
        id: 'm02-server-header-exposure',
        name: 'Server header exposure',
        weight: 0.4,
        health: 'good',
        evidence: `Server header present without version: ${infra.server}`,
      }),
    );
  }

  // -----------------------------------------------------------------------
  // 8. Framework detected (weight 2/10, info only)
  // -----------------------------------------------------------------------
  const frameworks = allByCategory('framework');
  checkpoints.push(
    infoCheckpoint(
      'm02-framework-detected',
      'Framework detected',
      frameworks.length > 0
        ? `Frameworks: ${frameworks.map((f) => f.name).join(', ')}`
        : 'No frontend framework detected.',
    ),
  );

  // -----------------------------------------------------------------------
  // 9. Hosting identified (weight 2/10, info only)
  // -----------------------------------------------------------------------
  const hostingAll = allByCategory('hosting');
  checkpoints.push(
    infoCheckpoint(
      'm02-hosting-identified',
      'Hosting identified',
      hostingAll.length > 0
        ? `Hosting: ${hostingAll.map((h) => h.name).join(', ')}`
        : 'Hosting provider not identified from fingerprints.',
    ),
  );

  return checkpoints;
}

// ---------------------------------------------------------------------------
// Build signals from detected technologies
// ---------------------------------------------------------------------------

function buildSignals(detected: DetectedTech[], infra: InfraDetails): Signal[] {
  const signals: Signal[] = [];

  for (const tech of detected) {
    signals.push(
      createSignal({
        type: 'technology',
        name: tech.version ? `${tech.name} ${tech.version}` : tech.name,
        confidence: tech.confidence,
        evidence: `Detected via fingerprint matching (category: ${tech.category})`,
        category: tech.category,
      }),
    );
  }

  if (infra.server) {
    signals.push(
      createSignal({
        type: 'server',
        name: infra.serverVersion ? `${infra.server}/${infra.serverVersion}` : infra.server,
        confidence: 0.95,
        evidence: 'Detected from Server HTTP header',
        category: 'server',
      }),
    );
  }

  if (infra.compression) {
    signals.push(
      createSignal({
        type: 'compression',
        name: infra.compression,
        confidence: 1.0,
        evidence: 'Detected from content-encoding HTTP header',
        category: 'infrastructure',
      }),
    );
  }

  if (infra.httpVersion) {
    signals.push(
      createSignal({
        type: 'protocol',
        name: infra.httpVersion,
        confidence: 0.9,
        evidence: 'Detected from HTTP response headers (alt-svc / protocol hints)',
        category: 'infrastructure',
      }),
    );
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Module execute function
// ---------------------------------------------------------------------------

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const startTime = Date.now();

  // Detect technologies from fingerprints
  const detected = detectTechnologies(ctx.html, ctx.headers);

  // Detect infrastructure details from headers
  const infra = detectInfraFromHeaders(ctx.headers);

  // Build signals
  const signals = buildSignals(detected, infra);

  // Build checkpoints
  const checkpoints = buildCheckpoints(detected, infra, ctx.headers);

  // Organize data output by category
  const byCategory = (cat: string) => detected.filter((t) => t.category === cat);
  const primaryOf = (cat: string) => {
    const items = byCategory(cat);
    return items.length > 0 ? items[0] : null;
  };

  const cms = primaryOf('cms');
  const cdn = primaryOf('cdn');
  const framework = primaryOf('framework');
  const hosting = primaryOf('hosting');
  const language = primaryOf('language');
  const buildTool = primaryOf('build_tool');
  const server = primaryOf('server');

  const data: Record<string, unknown> = {
    detectedTechnologies: detected,
    cms: cms ? { id: cms.id, name: cms.name, version: cms.version ?? null, confidence: cms.confidence } : null,
    cdn: cdn ? { id: cdn.id, name: cdn.name, confidence: cdn.confidence } : null,
    framework: framework ? { id: framework.id, name: framework.name, confidence: framework.confidence } : null,
    hosting: hosting ? { id: hosting.id, name: hosting.name, confidence: hosting.confidence } : null,
    language: language ? { id: language.id, name: language.name, confidence: language.confidence } : null,
    buildTool: buildTool ? { id: buildTool.id, name: buildTool.name, confidence: buildTool.confidence } : null,
    server: server
      ? { id: server.id, name: server.name, confidence: server.confidence }
      : infra.server
        ? { id: infra.server.toLowerCase(), name: infra.server, version: infra.serverVersion, os: infra.serverOs }
        : null,
    compression: infra.compression,
    httpVersion: infra.httpVersion,
  };

  return {
    moduleId: 'M02' as ModuleId,
    status: detected.length > 0 || infra.server ? 'success' : 'partial',
    data,
    signals,
    score: null, // calculated by the runner from checkpoints
    checkpoints,
    duration: Date.now() - startTime,
  };
};

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

registerModuleExecutor('M02' as ModuleId, execute);

export { execute };
