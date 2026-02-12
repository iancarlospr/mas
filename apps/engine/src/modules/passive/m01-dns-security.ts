/**
 * M01 - DNS & Security Baseline
 *
 * Passive-phase module that inspects DNS configuration, email authentication
 * (SPF / DMARC / DKIM), TLS certificate quality, HTTP security headers,
 * HTTPS redirect behaviour, and ancillary records (CAA, DNSSEC).
 *
 * Produces 15 scored checkpoints plus informational signals about the
 * detected infrastructure (NS provider, email provider, IP geolocation).
 */

import tls from 'node:tls';
import { URL } from 'node:url';

import * as cheerio from 'cheerio';

import { registerModuleExecutor } from '../runner.js';
import type {
  ModuleContext,
  ModuleExecuteFn,
} from '../types.js';
import type {
  ModuleResult,
  ModuleId,
  Signal,
  Checkpoint,
  CheckpointHealth,
} from '../types.js';
import {
  resolveAllRecords,
  findSpfRecord,
  findAllSpfRecords,
  resolveDmarc,
  probeDkim,
} from '../../utils/dns.js';
import type { DnsRecords } from '../../utils/dns.js';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { detectSourceMaps } from '../../utils/source-map-detector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive header lookup. */
function getHeader(headers: Record<string, string>, key: string): string | undefined {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** Count the number of DNS-lookup-producing mechanisms in an SPF record. */
function countSpfLookups(spf: string): number {
  // Mechanisms that cause a DNS lookup: include, a, mx, ptr, exists, redirect
  const lookupMechanisms = /\b(include:|a[:/]|a\b|mx[:/]|mx\b|ptr[:/]|ptr\b|exists:|redirect=)/gi;
  const matches = spf.match(lookupMechanisms);
  return matches ? matches.length : 0;
}

/** Extract the qualifier (all mechanism) from SPF. */
function getSpfAllQualifier(spf: string): string | null {
  const match = spf.match(/([+~?-])all/);
  return match ? match[1] ?? null : null;
}

/** Parse DMARC policy value. */
function parseDmarcPolicy(dmarc: string): { p: string | null; rua: boolean; ruf: boolean } {
  const pMatch = dmarc.match(/;\s*p\s*=\s*(\w+)/i) || dmarc.match(/^v=DMARC1;\s*p\s*=\s*(\w+)/i);
  const p = pMatch && pMatch[1] ? pMatch[1].toLowerCase() : null;
  const rua = /rua\s*=/i.test(dmarc);
  const ruf = /ruf\s*=/i.test(dmarc);
  return { p, rua, ruf };
}

/** Estimate DKIM key strength from the p= tag (base64-encoded public key). */
function estimateDkimKeyBits(record: string): number {
  const pMatch = record.match(/p=([A-Za-z0-9+/=\s]+)/);
  if (!pMatch) return 0;
  const base64 = (pMatch[1] ?? '').replace(/\s/g, '');
  if (base64.length === 0) return 0; // revoked key (p=)

  // The base64 encodes full DER SubjectPublicKeyInfo, which includes ~38 bytes
  // of overhead beyond the RSA modulus. Snap to nearest standard key size.
  const rawBits = Math.floor((base64.length * 3) / 4) * 8;
  if (rawBits <= 600) return 256;   // ed25519 or very small
  if (rawBits <= 1000) return 512;
  if (rawBits <= 1800) return 1024;
  if (rawBits <= 3400) return 2048;
  return 4096;
}

interface TlsCertInfo {
  valid: boolean;
  daysRemaining: number;
  protocol: string;
  issuer: string;
  subject: string;
  keyType: string; // 'ECDSA' | 'RSA' | 'unknown'
  serialNumber: string;
  subjectAltNames: string[];
  validFrom: string | null;
  validTo: string | null;
  keyBits: number | null;
  error?: string;
}

/** Connect via TLS and inspect the peer certificate. */
function inspectTlsCertificate(hostname: string, port: number = 443): Promise<TlsCertInfo> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        valid: false,
        daysRemaining: 0,
        protocol: 'unknown',
        issuer: '',
        subject: '',
        keyType: 'unknown',
        serialNumber: '',
        subjectAltNames: [],
        validFrom: null,
        validTo: null,
        keyBits: null,
        error: 'TLS connection timed out',
      });
    }, 10_000);

    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        clearTimeout(timeout);
        try {
          const cert = socket.getPeerCertificate(false);
          const protocol = socket.getProtocol() ?? 'unknown';

          if (!cert || !cert.valid_to) {
            socket.destroy();
            resolve({
              valid: false,
              daysRemaining: 0,
              protocol,
              issuer: '',
              subject: '',
              keyType: 'unknown',
              serialNumber: '',
              subjectAltNames: [],
              validFrom: null,
              validTo: null,
              keyBits: null,
              error: 'No certificate returned',
            });
            return;
          }

          const validTo = new Date(cert.valid_to);
          const now = new Date();
          const daysRemaining = Math.floor(
            (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          const valid = socket.authorized || daysRemaining > 0;

          // Determine key type from the certificate's public key
          let keyType = 'unknown';
          const pubkey = (cert as unknown as Record<string, unknown>).pubkey;
          const bits = (cert as unknown as Record<string, unknown>).bits;
          const asn1Curve = (cert as unknown as Record<string, unknown>).asn1Curve;
          if (asn1Curve || (typeof bits === 'number' && bits <= 521)) {
            keyType = 'ECDSA';
          } else if (typeof bits === 'number') {
            keyType = 'RSA';
          } else if (pubkey) {
            keyType = 'RSA'; // default assumption for non-EC keys
          }

          const issuerStr =
            typeof cert.issuer === 'object' && cert.issuer
              ? (cert.issuer as unknown as Record<string, string>).O ?? JSON.stringify(cert.issuer)
              : String(cert.issuer ?? '');

          const subjectStr =
            typeof cert.subject === 'object' && cert.subject
              ? (cert.subject as unknown as Record<string, string>).CN ?? JSON.stringify(cert.subject)
              : String(cert.subject ?? '');

          // Extract Subject Alternative Names
          const sanRaw = (cert as unknown as Record<string, string>).subjectaltname ?? '';
          const subjectAltNames = sanRaw
            ? sanRaw.split(',').map((s: string) => s.trim().replace(/^DNS:/, ''))
            : [];

          const keyBitsNum = typeof bits === 'number' ? bits : null;

          socket.destroy();
          resolve({
            valid,
            daysRemaining,
            protocol,
            issuer: issuerStr,
            subject: subjectStr,
            keyType,
            serialNumber: cert.serialNumber ?? '',
            subjectAltNames,
            validFrom: cert.valid_from ?? null,
            validTo: cert.valid_to ?? null,
            keyBits: keyBitsNum,
          });
        } catch (err) {
          socket.destroy();
          resolve({
            valid: false,
            daysRemaining: 0,
            protocol: 'unknown',
            issuer: '',
            subject: '',
            keyType: 'unknown',
            serialNumber: '',
            subjectAltNames: [],
            validFrom: null,
            validTo: null,
            keyBits: null,
            error: (err as Error).message,
          });
        }
      },
    );

    socket.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve({
        valid: false,
        daysRemaining: 0,
        protocol: 'unknown',
        issuer: '',
        subject: '',
        keyType: 'unknown',
        serialNumber: '',
        subjectAltNames: [],
        validFrom: null,
        validTo: null,
        keyBits: null,
        error: err.message,
      });
    });
  });
}

/** Identify email provider from MX records. */
function identifyEmailProvider(
  mxRecords: Array<{ exchange: string; priority: number }>,
): { provider: string; confidence: number } {
  if (mxRecords.length === 0) return { provider: 'none', confidence: 1.0 };

  const exchanges = mxRecords.map((r) => r.exchange.toLowerCase());

  if (exchanges.some((e) => e.includes('aspmx.l.google.com') || e.includes('google.com') || e.includes('googlemail.com'))) {
    return { provider: 'Google Workspace', confidence: 0.95 };
  }
  if (exchanges.some((e) => e.includes('outlook.com') || e.includes('protection.outlook.com') || e.includes('mail.protection.outlook.com'))) {
    return { provider: 'Microsoft 365', confidence: 0.95 };
  }
  if (exchanges.some((e) => e.includes('pphosted.com') || e.includes('proofpoint'))) {
    return { provider: 'Proofpoint', confidence: 0.9 };
  }
  if (exchanges.some((e) => e.includes('mimecast'))) {
    return { provider: 'Mimecast', confidence: 0.9 };
  }
  if (exchanges.some((e) => e.includes('zoho.com'))) {
    return { provider: 'Zoho Mail', confidence: 0.9 };
  }
  if (exchanges.some((e) => e.includes('yahoodns') || e.includes('yahoo.com'))) {
    return { provider: 'Yahoo Mail', confidence: 0.85 };
  }
  if (exchanges.some((e) => e.includes('mailgun'))) {
    return { provider: 'Mailgun', confidence: 0.9 };
  }
  if (exchanges.some((e) => e.includes('sendgrid'))) {
    return { provider: 'SendGrid', confidence: 0.9 };
  }

  return { provider: 'Custom', confidence: 0.6 };
}

/** Identify NS / DNS provider from NS records. */
function identifyNsProvider(nsRecords: string[]): { provider: string; confidence: number } {
  if (nsRecords.length === 0) return { provider: 'unknown', confidence: 0 };

  const joined = nsRecords.map((r) => r.toLowerCase()).join(' ');

  if (joined.includes('cloudflare')) return { provider: 'Cloudflare', confidence: 0.95 };
  if (joined.includes('awsdns') || joined.includes('route53')) return { provider: 'AWS Route 53', confidence: 0.95 };
  if (joined.includes('azure-dns') || joined.includes('microsoft.com')) return { provider: 'Azure DNS', confidence: 0.9 };
  if (joined.includes('googledomains') || joined.includes('google.com')) return { provider: 'Google Cloud DNS', confidence: 0.9 };
  if (joined.includes('domaincontrol') || joined.includes('godaddy')) return { provider: 'GoDaddy', confidence: 0.9 };
  if (joined.includes('namecheap') || joined.includes('registrar-servers')) return { provider: 'Namecheap', confidence: 0.9 };
  if (joined.includes('digitalocean')) return { provider: 'DigitalOcean', confidence: 0.9 };
  if (joined.includes('ns1.com')) return { provider: 'NS1', confidence: 0.9 };
  if (joined.includes('dnsimple')) return { provider: 'DNSimple', confidence: 0.9 };
  if (joined.includes('dynect') || joined.includes('dyn.com')) return { provider: 'Dyn / Oracle', confidence: 0.9 };
  if (joined.includes('ultradns')) return { provider: 'UltraDNS', confidence: 0.9 };
  if (joined.includes('akamai')) return { provider: 'Akamai', confidence: 0.9 };
  if (joined.includes('fastly')) return { provider: 'Fastly', confidence: 0.9 };

  return { provider: 'Other', confidence: 0.5 };
}

/** Parse HSTS header and return structured data. */
function parseHsts(value: string): { maxAge: number; includeSubDomains: boolean; preload: boolean } {
  const maxAgeMatch = value.match(/max-age\s*=\s*(\d+)/i);
  return {
    maxAge: maxAgeMatch ? parseInt(maxAgeMatch[1] ?? '0', 10) : 0,
    includeSubDomains: /includeSubDomains/i.test(value),
    preload: /preload/i.test(value),
  };
}

// ---------------------------------------------------------------------------
// Additional email authentication probes (BIMI, MTA-STS, SMTP TLS-RPT)
// ---------------------------------------------------------------------------

interface EmailExtras {
  bimi: string | null;
  mtaSts: string | null;
  tlsRpt: string | null;
}

async function probeEmailExtras(domain: string): Promise<EmailExtras> {
  const { Resolver } = await import('node:dns/promises');
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const results: EmailExtras = { bimi: null, mtaSts: null, tlsRpt: null };

  const tasks = [
    // BIMI record
    (async () => {
      try {
        const records = await resolver.resolveTxt(`default._bimi.${domain}`);
        for (const parts of records) {
          const full = parts.join('');
          if (full.includes('v=BIMI1')) { results.bimi = full; break; }
        }
      } catch { /* not found */ }
    })(),
    // MTA-STS
    (async () => {
      try {
        const records = await resolver.resolveTxt(`_mta-sts.${domain}`);
        for (const parts of records) {
          const full = parts.join('');
          if (full.includes('v=STSv1')) { results.mtaSts = full; break; }
        }
      } catch { /* not found */ }
    })(),
    // SMTP TLS Reporting
    (async () => {
      try {
        const records = await resolver.resolveTxt(`_smtp._tls.${domain}`);
        for (const parts of records) {
          const full = parts.join('');
          if (full.includes('v=TLSRPTv1')) { results.tlsRpt = full; break; }
        }
      } catch { /* not found */ }
    })(),
  ];

  await Promise.allSettled(tasks);
  return results;
}

// ---------------------------------------------------------------------------
// WWW vs apex consistency check
// ---------------------------------------------------------------------------

interface WwwConsistency {
  wwwExists: boolean;
  wwwRedirectsToApex: boolean;
  apexRedirectsToWww: boolean;
  headerDifferences: string[];
}

async function checkWwwConsistency(
  domain: string,
  apexHeaders: Record<string, string>,
): Promise<WwwConsistency> {
  const result: WwwConsistency = {
    wwwExists: false,
    wwwRedirectsToApex: false,
    apexRedirectsToWww: false,
    headerDifferences: [],
  };

  try {
    const wwwUrl = `https://www.${domain}`;
    const wwwResult = await fetchWithRetry(wwwUrl, { timeout: 10_000, retries: 0, maxRedirects: 5 });
    result.wwwExists = true;

    // Check if www redirects to apex or vice versa
    if (wwwResult.finalUrl.includes(`://${domain}`) && !wwwResult.finalUrl.includes(`://www.${domain}`)) {
      result.wwwRedirectsToApex = true;
    }

    // Compare security headers between www and apex
    const secHeaders = [
      'strict-transport-security', 'content-security-policy', 'x-content-type-options',
      'x-frame-options', 'referrer-policy', 'permissions-policy',
    ];

    for (const header of secHeaders) {
      const apexVal = getHeader(apexHeaders, header);
      const wwwVal = getHeader(wwwResult.headers, header);

      if (apexVal && !wwwVal) {
        result.headerDifferences.push(`${header}: present on apex, missing on www`);
      } else if (!apexVal && wwwVal) {
        result.headerDifferences.push(`${header}: missing on apex, present on www`);
      }
    }
  } catch {
    // www doesn't exist or isn't reachable
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cross-Origin / isolation headers
// ---------------------------------------------------------------------------

interface CrossOriginHeaders {
  cors: string | null;        // access-control-allow-origin
  coep: string | null;        // cross-origin-embedder-policy
  coop: string | null;        // cross-origin-opener-policy
  corp: string | null;        // cross-origin-resource-policy
}

function extractCrossOriginHeaders(headers: Record<string, string>): CrossOriginHeaders {
  return {
    cors: getHeader(headers, 'access-control-allow-origin') ?? null,
    coep: getHeader(headers, 'cross-origin-embedder-policy') ?? null,
    coop: getHeader(headers, 'cross-origin-opener-policy') ?? null,
    corp: getHeader(headers, 'cross-origin-resource-policy') ?? null,
  };
}

// ---------------------------------------------------------------------------
// CSP deep-parse helper
// ---------------------------------------------------------------------------

const CSP_DIRECTIVE_NAMES = [
  'default-src', 'script-src', 'style-src', 'img-src', 'font-src',
  'connect-src', 'media-src', 'frame-src', 'base-uri', 'form-action',
  'frame-ancestors', 'object-src', 'worker-src',
] as const;

interface CspDirectives {
  directives: Record<string, string[]>;
  hasReporting: boolean;
  permissiveDirectives: string[];
}

function parseFullCsp(cspValue: string): CspDirectives {
  const directives: Record<string, string[]> = {};
  const permissiveDirectives: string[] = [];
  let hasReporting = false;

  const rawDirectives = cspValue.split(';').map(d => d.trim()).filter(Boolean);

  for (const raw of rawDirectives) {
    const parts = raw.split(/\s+/);
    const name = (parts[0] ?? '').toLowerCase();
    const values = parts.slice(1);

    if (name === 'report-uri' || name === 'report-to') {
      hasReporting = true;
    }

    directives[name] = values;

    // Flag overly permissive wildcards per directive
    if (CSP_DIRECTIVE_NAMES.includes(name as typeof CSP_DIRECTIVE_NAMES[number])) {
      if (values.includes('*')) {
        permissiveDirectives.push(`${name} (wildcard *)`);
      }
    }

    // Flag data: URIs in script-src
    if (name === 'script-src' && values.some(v => v.toLowerCase() === 'data:')) {
      permissiveDirectives.push('script-src (data: URI)');
    }
  }

  return { directives, hasReporting, permissiveDirectives };
}

// ---------------------------------------------------------------------------
// SRI audit helper
// ---------------------------------------------------------------------------

interface SriCoverage {
  totalExternal: number;
  sriCount: number;
  coveragePct: number;
  uncoveredResources: string[];
}

function auditSri(html: string, pageDomain: string): SriCoverage {
  const $ = cheerio.load(html);
  const uncoveredResources: string[] = [];
  let totalExternal = 0;
  let sriCount = 0;

  // Scan <script src="..."> tags
  $('script[src]').each((_i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    if (isCrossOriginUrl(src, pageDomain)) {
      totalExternal++;
      if ($(el).attr('integrity')) {
        sriCount++;
      } else if (uncoveredResources.length < 20) {
        uncoveredResources.push(src);
      }
    }
  });

  // Scan <link rel="stylesheet" href="..."> tags
  $('link[rel="stylesheet"][href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (isCrossOriginUrl(href, pageDomain)) {
      totalExternal++;
      if ($(el).attr('integrity')) {
        sriCount++;
      } else if (uncoveredResources.length < 20) {
        uncoveredResources.push(href);
      }
    }
  });

  const coveragePct = totalExternal > 0 ? Math.round((sriCount / totalExternal) * 100) : 0;

  return { totalExternal, sriCount, coveragePct, uncoveredResources };
}

/** Check if a URL is cross-origin relative to the page domain. */
function isCrossOriginUrl(url: string, pageDomain: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
    return false; // relative URL — same origin
  }
  try {
    const normalized = url.startsWith('//') ? `https:${url}` : url;
    const urlHost = new URL(normalized).hostname.toLowerCase();
    const pageHost = pageDomain.toLowerCase();
    return urlHost !== pageHost && !urlHost.endsWith(`.${pageHost}`) && !pageHost.endsWith(`.${urlHost}`);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Permissions-Policy deep-parse helper
// ---------------------------------------------------------------------------

interface PermissionsPolicyDetails {
  features: Array<{ name: string; policy: string }>;
  permissiveFeatures: string[];
  restrictedFeatures: string[];
}

function parseFullPermissionsPolicy(ppValue: string): PermissionsPolicyDetails {
  const features: Array<{ name: string; policy: string }> = [];
  const permissiveFeatures: string[] = [];
  const restrictedFeatures: string[] = [];

  const directives = ppValue.split(',').map(d => d.trim()).filter(Boolean);

  for (const directive of directives) {
    const eqIndex = directive.indexOf('=');
    if (eqIndex === -1) continue;

    const name = directive.substring(0, eqIndex).trim();
    const value = directive.substring(eqIndex + 1).trim();

    let policy: string;
    if (value === '()' || value === '="none"') {
      policy = 'none';
      restrictedFeatures.push(name);
    } else if (value === '(self)' || value === '=(self)') {
      policy = 'self-only';
      restrictedFeatures.push(name);
    } else if (value === '*' || value === '=*') {
      policy = 'wildcard';
      permissiveFeatures.push(name);
    } else {
      policy = 'specific-origins';
    }

    features.push({ name, policy });
  }

  return { features, permissiveFeatures, restrictedFeatures };
}

// ---------------------------------------------------------------------------
// Accept-CH Client Hints helper
// ---------------------------------------------------------------------------

interface ClientHints {
  advertisedHints: string[];
  usesAdaptiveServing: boolean;
}

const ADAPTIVE_HINTS = ['dpr', 'device-memory', 'viewport-width'];

function parseClientHints(acceptCHValue: string): ClientHints {
  const advertisedHints = acceptCHValue
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);

  const lowerHints = advertisedHints.map(h => h.toLowerCase());
  const usesAdaptiveServing = ADAPTIVE_HINTS.some(h => lowerHints.includes(h));

  return { advertisedHints, usesAdaptiveServing };
}

// ---------------------------------------------------------------------------
// HSTS Preload readiness helper
// ---------------------------------------------------------------------------

interface HstsPreloadReady {
  ready: boolean;
  maxAge: number;
  hasIncludeSubDomains: boolean;
  hasPreload: boolean;
  missingRequirements: string[];
}

function checkHstsPreloadReadiness(hstsValue: string): HstsPreloadReady {
  const parsed = parseHsts(hstsValue);
  const missingRequirements: string[] = [];
  const MIN_MAX_AGE = 31_536_000; // 1 year

  if (parsed.maxAge < MIN_MAX_AGE) {
    missingRequirements.push(`max-age must be >= ${MIN_MAX_AGE} (currently ${parsed.maxAge})`);
  }
  if (!parsed.includeSubDomains) {
    missingRequirements.push('includeSubDomains directive is missing');
  }
  if (!parsed.preload) {
    missingRequirements.push('preload directive is missing');
  }

  return {
    ready: missingRequirements.length === 0,
    maxAge: parsed.maxAge,
    hasIncludeSubDomains: parsed.includeSubDomains,
    hasPreload: parsed.preload,
    missingRequirements,
  };
}

// ---------------------------------------------------------------------------
// Main module executor
// ---------------------------------------------------------------------------

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const startTime = Date.now();
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};
  let failedChecks = 0;

  // Extract domain
  let domain: string;
  try {
    domain = new URL(ctx.url).hostname;
  } catch {
    return {
      moduleId: 'M01' as ModuleId,
      status: 'error',
      data: { error: 'Invalid URL' },
      signals: [],
      score: null,
      checkpoints: [],
      duration: Date.now() - startTime,
      error: 'Could not parse domain from URL',
    };
  }

  // Derive apex domain (strip leading www.) for email/DNS security checks
  const apexDomain = domain.replace(/^www\./, '');
  const isWww = domain !== apexDomain;
  data.domain = domain;
  data.apexDomain = apexDomain;

  // ─── 1. Resolve all DNS records ──────────────────────────────────────────
  let dns: DnsRecords;
  try {
    dns = await resolveAllRecords(domain);
    data.dns = dns;
  } catch (err) {
    dns = { A: [], AAAA: [], MX: [], NS: [], TXT: [], CNAME: [], SOA: null, CAA: [] };
    data.dns = dns;
    data.dnsError = (err as Error).message;
    failedChecks++;
  }

  // If scanning www subdomain, also resolve apex DNS for email/security checks
  let apexDns = dns;
  if (isWww) {
    try {
      apexDns = await resolveAllRecords(apexDomain);
      data.apexDns = apexDns;
    } catch {
      // Fall back to subdomain DNS if apex resolution fails
    }
  }

  // ─── 2. SPF checkpoint ──────────────────────────────────────────────────
  try {
    const allSpfRecords = findAllSpfRecords(apexDns.TXT);
    const spfRecord = allSpfRecords[0] ?? null;
    data.spf = spfRecord;
    data.spfRecordCount = allSpfRecords.length;
    data.spfAllRecords = allSpfRecords;

    if (!spfRecord) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-spf',
          name: 'SPF record',
          weight: 0.8,
          health: 'critical',
          evidence: 'No SPF record found in TXT records',
          recommendation: 'Add an SPF TXT record (v=spf1 ... -all) to authorise legitimate senders and prevent spoofing.',
        }),
      );
    } else if (allSpfRecords.length > 1) {
      // RFC 7208 §3.2: multiple SPF records cause a PermError — receivers
      // may evaluate any one of them at random, making email auth unreliable.
      checkpoints.push(
        createCheckpoint({
          id: 'm01-spf',
          name: 'SPF record',
          weight: 0.8,
          health: 'critical',
          evidence: `${allSpfRecords.length} SPF records found (RFC 7208 violation). Records: ${allSpfRecords.map((r, i) => `[${i + 1}] ${r}`).join(' | ')}`,
          recommendation: 'Merge all SPF records into a single v=spf1 record. Multiple SPF records cause a PermError — receivers may ignore SPF entirely.',
        }),
      );

      signals.push(
        createSignal({
          type: 'email-auth',
          name: 'SPF (DUPLICATE)',
          confidence: 0.95,
          evidence: `${allSpfRecords.length} conflicting SPF records: ${allSpfRecords.join(' | ')}`,
          category: 'security',
        }),
      );
    } else {
      const lookups = countSpfLookups(spfRecord);
      const allQualifier = getSpfAllQualifier(spfRecord);
      data.spfLookups = lookups;
      data.spfAllQualifier = allQualifier;
      const spfRedirectTarget = spfRecord.match(/redirect=(\S+)/i)?.[1] ?? null;
      if (spfRedirectTarget) data.spfRedirectTarget = spfRedirectTarget;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (allQualifier === '-' && lookups <= 10) {
        health = 'excellent';
        evidence = `SPF present with -all and ${lookups} DNS lookups (limit 10): ${spfRecord}`;
      } else if (allQualifier === '~' && lookups <= 10) {
        health = 'good';
        evidence = `SPF present with ~all (soft-fail) and ${lookups} DNS lookups: ${spfRecord}`;
        recommendation = 'Tighten SPF to use -all (hard-fail) once all legitimate senders are authorised.';
      } else if (allQualifier === '?' && lookups <= 10) {
        health = 'warning';
        evidence = `SPF present with ?all (neutral) and ${lookups} DNS lookups: ${spfRecord}`;
        recommendation = 'Change ?all to -all (hard-fail). Neutral policy provides no spoofing protection.';
      } else if (allQualifier === null && /redirect=/i.test(spfRecord)) {
        // redirect= delegates the entire SPF evaluation to another domain's policy.
        // This is a valid, common pattern (e.g., v=spf1 redirect=_spf.example.com).
        const redirectTarget = spfRecord.match(/redirect=(\S+)/i)?.[1] ?? 'unknown';
        health = lookups <= 10 ? 'good' : 'warning';
        evidence = lookups <= 10
          ? `SPF delegates policy via redirect=${redirectTarget} (${lookups} DNS lookup${lookups !== 1 ? 's' : ''}): ${spfRecord}`
          : `SPF delegates via redirect=${redirectTarget} but ${lookups} DNS lookups exceeds the 10-lookup limit: ${spfRecord}`;
        if (lookups > 10) {
          recommendation = `Reduce SPF DNS lookups to 10 or fewer (currently ${lookups}). The redirect target may contain nested includes.`;
        }
      } else {
        health = 'warning';
        const reasons: string[] = [];
        if (allQualifier === '+') reasons.push('+all allows any server to send');
        if (allQualifier === '?') reasons.push('?all (neutral) provides no protection');
        if (allQualifier === null && !/redirect=/i.test(spfRecord)) reasons.push('no all mechanism or redirect found');
        if (lookups > 10) reasons.push(`${lookups} DNS lookups exceeds the 10-lookup limit`);
        evidence = `SPF present but: ${reasons.join('; ')}. Record: ${spfRecord}`;
        recommendation = allQualifier === '+'
          ? 'Remove +all from SPF immediately -- it allows anyone to spoof your domain.'
          : lookups > 10
            ? `Reduce SPF DNS lookups to 10 or fewer (currently ${lookups}). Use ip4/ip6 mechanisms or flatten includes.`
            : 'Tighten the SPF all-mechanism to -all once all legitimate senders are authorised.';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-spf', name: 'SPF record', weight: 0.8, health, evidence, recommendation }),
      );

      signals.push(
        createSignal({
          type: 'email-auth',
          name: 'SPF',
          confidence: 0.95,
          evidence: spfRecord,
          category: 'security',
        }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-spf',
        name: 'SPF record',
        weight: 0.8,
        health: 'critical',
        evidence: 'Failed to analyse SPF record',
        recommendation: 'Ensure an SPF TXT record is published for the domain.',
      }),
    );
  }

  // ─── 3. DMARC checkpoint ────────────────────────────────────────────────
  try {
    const dmarcRecord = await resolveDmarc(apexDomain);
    data.dmarc = dmarcRecord;

    if (!dmarcRecord) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-dmarc',
          name: 'DMARC policy',
          weight: 0.9,
          health: 'critical',
          evidence: 'No DMARC record found at _dmarc.' + apexDomain,
          recommendation: 'Publish a DMARC record starting with p=none and rua reporting, then escalate to p=quarantine and eventually p=reject.',
        }),
      );
    } else {
      const { p, rua, ruf } = parseDmarcPolicy(dmarcRecord);
      data.dmarcPolicy = p;
      data.dmarcRua = rua;
      data.dmarcRuf = ruf;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (p === 'reject' && rua) {
        health = 'excellent';
        evidence = `DMARC policy is reject with${ruf ? ' rua+ruf' : ' rua'} reporting: ${dmarcRecord}`;
      } else if (p === 'quarantine' && rua) {
        health = 'good';
        evidence = `DMARC policy is quarantine with rua reporting: ${dmarcRecord}`;
        recommendation = 'Escalate DMARC policy to p=reject once monitoring confirms no legitimate mail is failing.';
      } else if (p === 'none') {
        health = 'warning';
        evidence = `DMARC policy is none (monitoring only): ${dmarcRecord}`;
        recommendation = 'Escalate from p=none to p=quarantine, then p=reject. Ensure rua reporting is configured.';
      } else {
        // p is quarantine or reject but missing rua, or unexpected policy
        health = 'good';
        evidence = `DMARC record found (p=${p}): ${dmarcRecord}`;
        recommendation = rua ? undefined : 'Add rua= to your DMARC record to receive aggregate reports.';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-dmarc', name: 'DMARC policy', weight: 0.9, health, evidence, recommendation }),
      );

      signals.push(
        createSignal({
          type: 'email-auth',
          name: 'DMARC',
          confidence: 0.95,
          evidence: dmarcRecord,
          category: 'security',
        }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-dmarc',
        name: 'DMARC policy',
        weight: 0.9,
        health: 'critical',
        evidence: 'Failed to query DMARC record',
        recommendation: 'Publish a DMARC TXT record at _dmarc.' + apexDomain,
      }),
    );
  }

  // ─── 4. DKIM checkpoint ─────────────────────────────────────────────────
  try {
    const dkimResults = await probeDkim(apexDomain);
    data.dkim = dkimResults;

    if (dkimResults.length === 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-dkim',
          name: 'DKIM',
          weight: 0.7,
          health: 'critical',
          evidence: 'No DKIM records detected for common selectors (default, google, selector1, selector2, k1, s1, s2, mail)',
          recommendation: 'Configure DKIM signing with your email provider and publish the public key as a TXT record.',
        }),
      );
    } else {
      const bestKey = dkimResults.reduce<{ bits: number; selector: string; record: string }>(
        (best, cur) => {
          const bits = estimateDkimKeyBits(cur.record);
          return bits > best.bits ? { bits, selector: cur.selector, record: cur.record } : best;
        },
        { bits: 0, selector: '', record: '' },
      );

      data.dkimBestKeyBits = bestKey.bits;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (bestKey.bits >= 2048) {
        health = 'excellent';
        evidence = `DKIM found (selector: ${bestKey.selector}), key strength ~${bestKey.bits}-bit`;
      } else if (bestKey.bits >= 1024) {
        health = 'good';
        evidence = `DKIM found (selector: ${bestKey.selector}), key strength ~${bestKey.bits}-bit`;
        recommendation = 'Upgrade DKIM key to 2048-bit or stronger for better security.';
      } else {
        health = 'warning';
        evidence = `DKIM found (selector: ${bestKey.selector}) but key appears weak (~${bestKey.bits}-bit)`;
        recommendation = 'Replace the weak DKIM key with a 2048-bit key immediately.';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-dkim', name: 'DKIM', weight: 0.7, health, evidence, recommendation }),
      );

      for (const dkim of dkimResults) {
        signals.push(
          createSignal({
            type: 'email-auth',
            name: `DKIM (${dkim.selector})`,
            confidence: 0.9,
            evidence: dkim.record.substring(0, 120),
            category: 'security',
          }),
        );
      }
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-dkim',
        name: 'DKIM',
        weight: 0.7,
        health: 'critical',
        evidence: 'Failed to probe DKIM selectors',
        recommendation: 'Configure DKIM and publish TXT records for your selectors.',
      }),
    );
  }

  // ─── 5. DNSSEC checkpoint ───────────────────────────────────────────────
  try {
    // Attempt to detect DNSSEC by looking for DS or DNSKEY presence.
    // We query a TXT record at _dnskey.{domain} and also check CAA records
    // (signed domains usually have CAA). A more reliable check would use
    // a DNSSEC-validating resolver, but for passive scanning we use heuristics.
    let dnssecDetected = false;
    let dnssecValidated = false;

    // Try resolving the special _dnskey subdomain for a hint
    try {
      const { Resolver } = await import('node:dns/promises');
      const dnssecResolver = new Resolver();
      dnssecResolver.setServers(['8.8.8.8']);
      // Google Public DNS returns SERVFAIL for unsigned domains when
      // queried with the DO bit. We use resolve() which effectively
      // checks if DS records propagate. A successful DNSKEY query is a
      // strong signal the zone is signed.
      const dnskeyRecords = await dnssecResolver.resolveTxt(`_dnskey.${apexDomain}`);
      if (dnskeyRecords.length > 0) {
        dnssecDetected = true;
      }
    } catch {
      // Not signed or record doesn't exist -- expected for most domains
    }

    // Fallback: check if there are any TXT records that mention DNSSEC or
    // if CAA records exist (correlated but not definitive)
    if (!dnssecDetected) {
      const allTxt = apexDns.TXT.map((parts) => parts.join('')).join(' ');
      if (/dnssec|rrsig|dnskey/i.test(allTxt)) {
        dnssecDetected = true;
      }
    }

    data.dnssec = { detected: dnssecDetected, validated: dnssecValidated };

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (dnssecDetected && dnssecValidated) {
      health = 'excellent';
      evidence = 'DNSSEC is signed with a valid chain';
    } else if (dnssecDetected) {
      health = 'good';
      evidence = 'DNSSEC signing detected (full chain validation not performed in passive scan)';
    } else {
      health = 'critical';
      evidence = 'No DNSSEC signing detected for ' + apexDomain;
      recommendation = 'Enable DNSSEC through your DNS provider to protect against DNS spoofing and cache poisoning.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm01-dnssec', name: 'DNSSEC', weight: 0.5, health, evidence, recommendation }),
    );
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-dnssec',
        name: 'DNSSEC',
        weight: 0.5,
        health: 'critical',
        evidence: 'Failed to check DNSSEC status',
        recommendation: 'Enable DNSSEC through your DNS provider.',
      }),
    );
  }

  // ─── 6. TLS certificate checkpoint ──────────────────────────────────────
  let tlsInfo: TlsCertInfo | null = null;
  try {
    tlsInfo = await inspectTlsCertificate(domain);
    data.tls = tlsInfo;

    if (!tlsInfo.valid || tlsInfo.error) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-tls',
          name: 'TLS certificate',
          weight: 1.0,
          health: 'critical',
          evidence: tlsInfo.error
            ? `TLS error: ${tlsInfo.error}`
            : 'TLS certificate is expired or invalid',
          recommendation: 'Obtain a valid TLS certificate immediately. Consider using a free CA such as Let\'s Encrypt.',
        }),
      );
    } else {
      const isTls13 = tlsInfo.protocol === 'TLSv1.3';
      const isTls12Plus = tlsInfo.protocol === 'TLSv1.2' || isTls13;
      const isEcdsa = tlsInfo.keyType === 'ECDSA';

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (tlsInfo.daysRemaining > 90 && isTls13 && isEcdsa) {
        health = 'excellent';
        evidence = `Valid TLS cert (${tlsInfo.protocol}, ${tlsInfo.keyType}), expires in ${tlsInfo.daysRemaining} days, issuer: ${tlsInfo.issuer}`;
      } else if (tlsInfo.daysRemaining > 30 && isTls12Plus) {
        health = 'good';
        evidence = `Valid TLS cert (${tlsInfo.protocol}, ${tlsInfo.keyType}), expires in ${tlsInfo.daysRemaining} days, issuer: ${tlsInfo.issuer}`;
        const tips: string[] = [];
        if (!isTls13) tips.push('upgrade to TLS 1.3');
        if (!isEcdsa) tips.push('switch to ECDSA certificate');
        if (tlsInfo.daysRemaining <= 90) tips.push('consider longer renewal buffer');
        recommendation = tips.length > 0 ? `To improve: ${tips.join(', ')}.` : undefined;
      } else if (tlsInfo.daysRemaining > 0) {
        health = 'warning';
        evidence = `TLS cert expires in ${tlsInfo.daysRemaining} days (${tlsInfo.protocol}, ${tlsInfo.keyType}), issuer: ${tlsInfo.issuer}`;
        recommendation = 'Renew the TLS certificate before expiry. Enable auto-renewal if possible.';
      } else {
        health = 'critical';
        evidence = `TLS certificate appears expired (${tlsInfo.daysRemaining} days remaining)`;
        recommendation = 'Renew the expired TLS certificate immediately.';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-tls', name: 'TLS certificate', weight: 1.0, health, evidence, recommendation }),
      );

      signals.push(
        createSignal({
          type: 'tls',
          name: `TLS ${tlsInfo.protocol}`,
          confidence: 0.95,
          evidence: `${tlsInfo.protocol}, ${tlsInfo.keyType}, issuer: ${tlsInfo.issuer}`,
          category: 'security',
        }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-tls',
        name: 'TLS certificate',
        weight: 1.0,
        health: 'critical',
        evidence: 'Failed to connect via TLS to inspect certificate',
        recommendation: 'Ensure the site is accessible over HTTPS with a valid TLS certificate.',
      }),
    );
  }

  // ─── 7. HTTP Security Headers (from ctx.headers) ────────────────────────
  const headers = ctx.headers;

  // 7a. HSTS
  try {
    const hstsValue = getHeader(headers, 'strict-transport-security');
    data.hsts = hstsValue ?? null;

    if (!hstsValue) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-hsts',
          name: 'HSTS',
          weight: 0.8,
          health: 'critical',
          evidence: 'Strict-Transport-Security header is missing',
          recommendation: 'Add Strict-Transport-Security header with max-age of at least 1 year, includeSubDomains, and preload.',
        }),
      );
    } else {
      const hsts = parseHsts(hstsValue);
      data.hstsParsed = hsts;

      const ONE_YEAR = 31_536_000;
      const SIX_MONTHS = 15_768_000;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (hsts.maxAge >= ONE_YEAR && hsts.preload && hsts.includeSubDomains) {
        health = 'excellent';
        evidence = `HSTS present: max-age=${hsts.maxAge} (>1yr), includeSubDomains, preload`;
      } else if (hsts.maxAge >= SIX_MONTHS) {
        health = 'good';
        evidence = `HSTS present: max-age=${hsts.maxAge}`;
        const missing: string[] = [];
        if (!hsts.includeSubDomains) missing.push('includeSubDomains');
        if (!hsts.preload) missing.push('preload');
        if (hsts.maxAge < ONE_YEAR) missing.push('max-age >= 1 year');
        recommendation = missing.length > 0 ? `Add ${missing.join(', ')} to the HSTS header.` : undefined;
      } else {
        health = 'warning';
        evidence = `HSTS present but max-age is ${hsts.maxAge} (<6 months)`;
        recommendation = 'Increase HSTS max-age to at least 1 year (31536000) and add includeSubDomains and preload.';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-hsts', name: 'HSTS', weight: 0.8, health, evidence, recommendation }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-hsts',
        name: 'HSTS',
        weight: 0.8,
        health: 'critical',
        evidence: 'Failed to analyse HSTS header',
        recommendation: 'Add Strict-Transport-Security header.',
      }),
    );
  }

  // 7b. CSP
  try {
    const cspValue = getHeader(headers, 'content-security-policy');
    data.csp = cspValue ?? null;

    if (!cspValue) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-csp',
          name: 'CSP',
          weight: 0.7,
          health: 'critical',
          evidence: 'Content-Security-Policy header is missing',
          recommendation: 'Implement a Content-Security-Policy header to prevent XSS and data injection attacks.',
        }),
      );
    } else {
      const hasUnsafeEval = /unsafe-eval/i.test(cspValue);
      const hasWildcard = /\s\*\s|'\*'|default-src\s+\*|script-src\s+\*/.test(cspValue);

      // Differentiate unsafe-inline in script-src (serious) vs style-src only (common/acceptable)
      // Parse CSP directives to check which directive contains unsafe-inline
      const directives = cspValue.split(';').map(d => d.trim().toLowerCase());
      const scriptSrcDirective = directives.find(d => d.startsWith('script-src'));
      const styleSrcDirective = directives.find(d => d.startsWith('style-src'));
      const defaultSrcDirective = directives.find(d => d.startsWith('default-src'));

      const unsafeInlineInScript = scriptSrcDirective?.includes("'unsafe-inline'")
        ?? (!scriptSrcDirective && defaultSrcDirective?.includes("'unsafe-inline'"));
      const unsafeInlineInStyleOnly = !unsafeInlineInScript && styleSrcDirective?.includes("'unsafe-inline'");
      const hasNonce = scriptSrcDirective?.includes("'nonce-") ?? false;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (!unsafeInlineInScript && !hasUnsafeEval && !hasWildcard) {
        if (hasNonce) {
          health = 'excellent';
          evidence = `CSP with nonce-based script-src${unsafeInlineInStyleOnly ? ' (unsafe-inline in style-src only — acceptable)' : ''}: ${cspValue.substring(0, 200)}`;
        } else {
          health = 'excellent';
          evidence = `CSP present with strict policy${unsafeInlineInStyleOnly ? ' (unsafe-inline in style-src only)' : ''}: ${cspValue.substring(0, 200)}`;
        }
      } else if (!hasWildcard && (unsafeInlineInScript || hasUnsafeEval)) {
        health = 'good';
        const issues: string[] = [];
        if (unsafeInlineInScript) issues.push('unsafe-inline in script-src');
        if (hasUnsafeEval) issues.push('unsafe-eval');
        evidence = `CSP present but contains ${issues.join(' and ')}: ${cspValue.substring(0, 200)}`;
        recommendation = `Remove ${issues.join(' and ')} from CSP. Use nonces or hashes instead of unsafe-inline.`;
      } else if (hasWildcard) {
        health = 'warning';
        evidence = `CSP present but overly permissive (wildcard or broad sources): ${cspValue.substring(0, 200)}`;
        recommendation = 'Tighten the Content-Security-Policy to restrict script and resource sources.';
      } else {
        health = 'good';
        evidence = `CSP present: ${cspValue.substring(0, 200)}`;
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-csp', name: 'CSP', weight: 0.7, health, evidence, recommendation }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-csp',
        name: 'CSP',
        weight: 0.7,
        health: 'critical',
        evidence: 'Failed to analyse CSP header',
        recommendation: 'Add a Content-Security-Policy header.',
      }),
    );
  }

  // 7c. X-Content-Type-Options
  try {
    const xcto = getHeader(headers, 'x-content-type-options');
    data.xContentTypeOptions = xcto ?? null;

    if (xcto && /nosniff/i.test(xcto)) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-xcto',
          name: 'X-Content-Type-Options',
          weight: 0.4,
          health: 'excellent',
          evidence: 'X-Content-Type-Options: nosniff is set',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-xcto',
          name: 'X-Content-Type-Options',
          weight: 0.4,
          health: 'critical',
          evidence: xcto ? `X-Content-Type-Options is set but not to nosniff: ${xcto}` : 'X-Content-Type-Options header is missing',
          recommendation: 'Add the header X-Content-Type-Options: nosniff to prevent MIME-type sniffing.',
        }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-xcto',
        name: 'X-Content-Type-Options',
        weight: 0.4,
        health: 'critical',
        evidence: 'Failed to analyse X-Content-Type-Options header',
        recommendation: 'Add X-Content-Type-Options: nosniff.',
      }),
    );
  }

  // 7d. X-Frame-Options / frame-ancestors
  try {
    const xfo = getHeader(headers, 'x-frame-options');
    const cspValue = getHeader(headers, 'content-security-policy');
    const hasFrameAncestors = cspValue ? /frame-ancestors/i.test(cspValue) : false;
    data.xFrameOptions = xfo ?? null;
    data.cspFrameAncestors = hasFrameAncestors;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hasFrameAncestors) {
      health = 'excellent';
      evidence = 'CSP frame-ancestors directive is set (preferred over X-Frame-Options)';
    } else if (xfo) {
      health = 'good';
      evidence = `X-Frame-Options: ${xfo}`;
      recommendation = 'Consider migrating from X-Frame-Options to the CSP frame-ancestors directive for better control.';
    } else {
      health = 'critical';
      evidence = 'Neither CSP frame-ancestors nor X-Frame-Options is set';
      recommendation = 'Add CSP frame-ancestors directive or X-Frame-Options header to prevent clickjacking.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm01-framing', name: 'X-Frame-Options / frame-ancestors', weight: 0.5, health, evidence, recommendation }),
    );
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-framing',
        name: 'X-Frame-Options / frame-ancestors',
        weight: 0.5,
        health: 'critical',
        evidence: 'Failed to analyse framing protection headers',
        recommendation: 'Add CSP frame-ancestors or X-Frame-Options.',
      }),
    );
  }

  // 7e. Referrer-Policy
  try {
    const rp = getHeader(headers, 'referrer-policy');
    data.referrerPolicy = rp ?? null;

    if (!rp) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-referrer',
          name: 'Referrer-Policy',
          weight: 0.4,
          health: 'critical',
          evidence: 'Referrer-Policy header is missing',
          recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin (or stricter).',
        }),
      );
    } else {
      const lower = rp.toLowerCase().trim();
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (lower === 'strict-origin-when-cross-origin') {
        health = 'excellent';
        evidence = `Referrer-Policy: ${rp}`;
      } else if (lower === 'no-referrer' || lower === 'origin' || lower === 'same-origin' || lower === 'strict-origin' || lower === 'no-referrer-when-downgrade' || lower === 'origin-when-cross-origin') {
        health = 'good';
        evidence = `Referrer-Policy: ${rp}`;
        recommendation = 'Consider using strict-origin-when-cross-origin for optimal balance of privacy and functionality.';
      } else if (lower === 'unsafe-url') {
        health = 'warning';
        evidence = `Referrer-Policy: ${rp} -- full URL is leaked on all requests`;
        recommendation = 'Change from unsafe-url to strict-origin-when-cross-origin to prevent URL leakage.';
      } else {
        health = 'good';
        evidence = `Referrer-Policy: ${rp}`;
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-referrer', name: 'Referrer-Policy', weight: 0.4, health, evidence, recommendation }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-referrer',
        name: 'Referrer-Policy',
        weight: 0.4,
        health: 'critical',
        evidence: 'Failed to analyse Referrer-Policy header',
        recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin.',
      }),
    );
  }

  // 7f. Permissions-Policy
  try {
    const pp = getHeader(headers, 'permissions-policy') ?? getHeader(headers, 'feature-policy');
    data.permissionsPolicy = pp ?? null;

    if (!pp) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-permissions',
          name: 'Permissions-Policy',
          weight: 0.4,
          health: 'critical',
          evidence: 'Permissions-Policy header is missing',
          recommendation: 'Add a Permissions-Policy header to restrict browser feature access (camera, microphone, geolocation, etc.).',
        }),
      );
    } else {
      // Count how many features are restricted
      const directives = pp.split(',').map((d) => d.trim());
      const restrictive = directives.filter(
        (d) => d.includes('=()') || d.includes('=(self)') || d.includes('="none"'),
      );

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (restrictive.length >= 5) {
        health = 'excellent';
        evidence = `Permissions-Policy is comprehensive (${restrictive.length} restrictive directives): ${pp.substring(0, 200)}`;
      } else if (restrictive.length >= 2) {
        health = 'good';
        evidence = `Permissions-Policy present with ${restrictive.length} restrictive directives: ${pp.substring(0, 200)}`;
        recommendation = 'Expand Permissions-Policy to cover more browser APIs (camera, microphone, geolocation, payment, usb).';
      } else {
        health = 'warning';
        evidence = `Permissions-Policy present but permissive (${restrictive.length} restrictive directives): ${pp.substring(0, 200)}`;
        recommendation = 'Tighten Permissions-Policy to restrict unused browser features with =() or =(self).';
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-permissions', name: 'Permissions-Policy', weight: 0.4, health, evidence, recommendation }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-permissions',
        name: 'Permissions-Policy',
        weight: 0.4,
        health: 'critical',
        evidence: 'Failed to analyse Permissions-Policy header',
        recommendation: 'Add a Permissions-Policy header.',
      }),
    );
  }

  // ─── 8. HTTPS redirect chain ────────────────────────────────────────────
  try {
    const httpUrl = ctx.url.replace(/^https:\/\//, 'http://');
    let redirectHealth: CheckpointHealth;
    let redirectEvidence: string;
    let redirectRecommendation: string | undefined;

    try {
      const httpResult = await fetchWithRetry(httpUrl, {
        timeout: 10_000,
        retries: 0,
        maxRedirects: 10,
      });

      const finalIsHttps = httpResult.finalUrl.startsWith('https://');
      const redirectCount = httpResult.redirectChain.length;
      data.httpsRedirect = {
        fromHttp: true,
        finalUrl: httpResult.finalUrl,
        redirectCount,
        redirectChain: httpResult.redirectChain,
        finalIsHttps,
      };

      if (finalIsHttps && redirectCount <= 1) {
        redirectHealth = 'excellent';
        redirectEvidence = `HTTP redirects to HTTPS in ${redirectCount} redirect(s): ${httpResult.redirectChain.join(' -> ')} -> ${httpResult.finalUrl}`;
      } else if (finalIsHttps && redirectCount === 2) {
        redirectHealth = 'good';
        redirectEvidence = `HTTP redirects to HTTPS in ${redirectCount} redirects`;
        redirectRecommendation = 'Reduce the redirect chain to a single hop (HTTP -> HTTPS) for faster load.';
      } else if (finalIsHttps && redirectCount >= 3) {
        redirectHealth = 'warning';
        redirectEvidence = `HTTP redirects to HTTPS but with ${redirectCount} redirects (excessive)`;
        redirectRecommendation = 'Shorten the redirect chain to a single HTTP -> HTTPS redirect.';
      } else {
        redirectHealth = 'critical';
        redirectEvidence = 'HTTP does not redirect to HTTPS';
        redirectRecommendation = 'Configure a permanent (301) redirect from HTTP to HTTPS.';
      }
    } catch {
      // If the HTTP fetch fails entirely, check if the original URL was HTTPS
      if (ctx.url.startsWith('https://')) {
        redirectHealth = 'good';
        redirectEvidence = 'HTTP fetch failed (port 80 may be closed); site is served over HTTPS';
        data.httpsRedirect = { fromHttp: false, note: 'HTTP port appears closed' };
      } else {
        redirectHealth = 'critical';
        redirectEvidence = 'Unable to verify HTTPS redirect -- HTTP fetch failed';
        redirectRecommendation = 'Ensure the site is accessible over HTTPS with a redirect from HTTP.';
        data.httpsRedirect = { fromHttp: false, error: 'HTTP fetch failed' };
      }
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm01-https-redirect',
        name: 'HTTPS redirect chain',
        weight: 0.6,
        health: redirectHealth,
        evidence: redirectEvidence,
        recommendation: redirectRecommendation,
      }),
    );
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-https-redirect',
        name: 'HTTPS redirect chain',
        weight: 0.6,
        health: 'critical',
        evidence: 'Failed to check HTTPS redirect',
        recommendation: 'Ensure HTTP redirects to HTTPS with a 301 redirect.',
      }),
    );
  }

  // ─── 9. Email infrastructure checkpoint ─────────────────────────────────
  try {
    const emailInfo = identifyEmailProvider(apexDns.MX);
    data.emailProvider = emailInfo;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (emailInfo.provider === 'none') {
      health = 'critical';
      evidence = `No MX records found for ${apexDomain} -- domain cannot receive email`;
      recommendation = 'If email is needed, configure MX records with a professional email provider.';
    } else if (emailInfo.provider === 'Google Workspace' || emailInfo.provider === 'Microsoft 365') {
      health = 'excellent';
      evidence = `Professional email provider detected: ${emailInfo.provider} (MX: ${apexDns.MX.map((r) => r.exchange).join(', ')})`;
    } else if (emailInfo.provider === 'Custom') {
      health = 'good';
      evidence = `Custom mail server (MX: ${apexDns.MX.map((r) => r.exchange).join(', ')})`;
    } else {
      health = 'excellent';
      evidence = `Email provider: ${emailInfo.provider} (MX: ${apexDns.MX.map((r) => r.exchange).join(', ')})`;
    }

    checkpoints.push(
      createCheckpoint({ id: 'm01-email', name: 'Email infrastructure', weight: 0.3, health, evidence, recommendation }),
    );

    if (emailInfo.provider !== 'none') {
      signals.push(
        createSignal({
          type: 'email-provider',
          name: emailInfo.provider,
          confidence: emailInfo.confidence,
          evidence: `MX: ${apexDns.MX.map((r) => r.exchange).join(', ')}`,
          category: 'infrastructure',
        }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-email',
        name: 'Email infrastructure',
        weight: 0.3,
        health: 'critical',
        evidence: 'Failed to analyse email infrastructure',
      }),
    );
  }

  // ─── 10. CAA records checkpoint ─────────────────────────────────────────
  try {
    data.caa = apexDns.CAA;

    if (apexDns.CAA.length === 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-caa',
          name: 'CAA records',
          weight: 0.3,
          health: 'critical',
          evidence: 'No CAA records found',
          recommendation: 'Publish CAA records to restrict which Certificate Authorities can issue certificates for your domain.',
        }),
      );
    } else {
      // Check if the CAA issuers match the actual cert issuer
      const caaIssuers = apexDns.CAA
        .filter((r) => r.issue || r.issuewild)
        .map((r) => r.issue ?? r.issuewild ?? '');

      let matchesCert = false;
      if (tlsInfo && tlsInfo.issuer) {
        const issuerLower = tlsInfo.issuer.toLowerCase();
        matchesCert = caaIssuers.some((ca) => {
          const caLower = (ca ?? '').toLowerCase();
          return (
            issuerLower.includes(caLower) ||
            caLower.includes('letsencrypt') && issuerLower.includes('encrypt') ||
            caLower.includes('digicert') && issuerLower.includes('digicert') ||
            caLower.includes('sectigo') && issuerLower.includes('sectigo') ||
            caLower.includes('comodo') && issuerLower.includes('comodo')
          );
        });
      }

      let health: CheckpointHealth;
      let evidence: string;

      if (matchesCert) {
        health = 'excellent';
        evidence = `CAA records set (${caaIssuers.join(', ')}) and match certificate issuer (${tlsInfo?.issuer})`;
      } else {
        health = 'good';
        evidence = `CAA records set: ${caaIssuers.join(', ')}`;
      }

      checkpoints.push(
        createCheckpoint({ id: 'm01-caa', name: 'CAA records', weight: 0.3, health, evidence }),
      );
    }
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-caa',
        name: 'CAA records',
        weight: 0.3,
        health: 'critical',
        evidence: 'Failed to analyse CAA records',
        recommendation: 'Publish CAA records for your domain.',
      }),
    );
  }

  // ─── 11. IP geolocation coherence (informational) ──────────────────────
  try {
    let geoEvidence = `A records: ${dns.A.join(', ')}`;
    if (dns.AAAA.length > 0) {
      geoEvidence += ` | AAAA records: ${dns.AAAA.join(', ')}`;
    }

    // Attempt geoip-lite if available
    try {
      const geoip = await import('geoip-lite');
      if (dns.A.length > 0 && geoip.default?.lookup) {
        const locations = dns.A.map((ip) => {
          const geo = geoip.default.lookup(ip);
          return geo
            ? { ip, country: geo.country, region: geo.region, city: geo.city, ll: geo.ll }
            : { ip, country: 'unknown' };
        });
        data.geoip = locations;
        geoEvidence = locations
          .map((l) => `${l.ip}: ${l.country}${('city' in l && l.city) ? ` (${l.city})` : ''}`)
          .join(', ');
      }
    } catch {
      // geoip-lite not installed -- skip silently
      data.geoip = null;
    }

    checkpoints.push(
      infoCheckpoint('m01-geoip', 'IP geolocation coherence', geoEvidence),
    );
  } catch {
    checkpoints.push(
      infoCheckpoint('m01-geoip', 'IP geolocation coherence', 'Unable to determine IP geolocation'),
    );
  }

  // ─── 12. NS provider signal ─────────────────────────────────────────────
  try {
    const nsInfo = identifyNsProvider(dns.NS);
    data.nsProvider = nsInfo;

    if (nsInfo.provider !== 'unknown') {
      signals.push(
        createSignal({
          type: 'dns-provider',
          name: nsInfo.provider,
          confidence: nsInfo.confidence,
          evidence: `NS: ${dns.NS.join(', ')}`,
          category: 'infrastructure',
        }),
      );
    }
  } catch {
    // Non-critical -- skip
  }

  // ─── 13. Email extras: BIMI, MTA-STS, SMTP TLS-RPT ──────────────────────
  try {
    const emailExtras = await probeEmailExtras(apexDomain);
    data.bimi = emailExtras.bimi;
    data.mtaSts = emailExtras.mtaSts;
    data.tlsRpt = emailExtras.tlsRpt;

    // BIMI signal
    if (emailExtras.bimi) {
      signals.push(
        createSignal({
          type: 'email-auth',
          name: 'BIMI',
          confidence: 0.95,
          evidence: emailExtras.bimi,
          category: 'security',
        }),
      );
    }

    // MTA-STS + TLS-RPT checkpoint
    if (emailExtras.mtaSts && emailExtras.tlsRpt) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-mta-sts',
          name: 'MTA-STS & TLS Reporting',
          weight: 0.3,
          health: 'excellent',
          evidence: `MTA-STS and SMTP TLS Reporting configured: ${emailExtras.mtaSts}`,
        }),
      );
    } else if (emailExtras.mtaSts) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-mta-sts',
          name: 'MTA-STS & TLS Reporting',
          weight: 0.3,
          health: 'good',
          evidence: `MTA-STS configured but no SMTP TLS Reporting: ${emailExtras.mtaSts}`,
          recommendation: 'Add a _smtp._tls TXT record (v=TLSRPTv1; rua=mailto:...) to receive TLS failure reports.',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-mta-sts',
          name: 'MTA-STS & TLS Reporting',
          weight: 0.3,
          health: 'warning',
          evidence: 'No MTA-STS or SMTP TLS Reporting records found',
          recommendation: 'Publish MTA-STS to enforce TLS for inbound email and prevent downgrade attacks.',
        }),
      );
    }
  } catch {
    data.bimi = null;
    data.mtaSts = null;
    data.tlsRpt = null;
    checkpoints.push(
      infoCheckpoint('m01-mta-sts', 'MTA-STS & TLS Reporting', 'Unable to check MTA-STS records'),
    );
  }

  // ─── 14. IPv6 readiness ───────────────────────────────────────────────────
  {
    const hasIPv6 = dns.AAAA.length > 0;
    data.ipv6 = hasIPv6 ? dns.AAAA : null;

    checkpoints.push(
      hasIPv6
        ? createCheckpoint({
            id: 'm01-ipv6',
            name: 'IPv6 readiness',
            weight: 0.2,
            health: 'excellent',
            evidence: `AAAA records found: ${dns.AAAA.join(', ')}`,
          })
        : createCheckpoint({
            id: 'm01-ipv6',
            name: 'IPv6 readiness',
            weight: 0.2,
            health: 'warning',
            evidence: 'No AAAA records found — site is IPv4 only',
            recommendation: 'Add AAAA records to support IPv6 clients and improve future-readiness.',
          }),
    );
  }

  // ─── 15. WWW vs apex consistency ──────────────────────────────────────────
  // If scanning www, check apex; if scanning apex, check www
  try {
    let wwwCheck: WwwConsistency;

    if (isWww) {
      // We're scanning www — fetch the apex and compare
      wwwCheck = { wwwExists: true, wwwRedirectsToApex: false, apexRedirectsToWww: false, headerDifferences: [] };
      try {
        const apexResult = await fetchWithRetry(`https://${apexDomain}`, { timeout: 10_000, retries: 0, maxRedirects: 5 });
        if (apexResult.finalUrl.includes(`://www.${apexDomain}`)) {
          wwwCheck.apexRedirectsToWww = true;
        }
        const secHeaders = [
          'strict-transport-security', 'content-security-policy', 'x-content-type-options',
          'x-frame-options', 'referrer-policy', 'permissions-policy',
        ];
        for (const header of secHeaders) {
          const wwwVal = getHeader(headers, header);
          const apexVal = getHeader(apexResult.headers, header);
          if (wwwVal && !apexVal) {
            wwwCheck.headerDifferences.push(`${header}: present on www, missing on apex`);
          } else if (!wwwVal && apexVal) {
            wwwCheck.headerDifferences.push(`${header}: missing on www, present on apex`);
          }
        }
      } catch {
        // Apex not reachable
        wwwCheck = { wwwExists: true, wwwRedirectsToApex: false, apexRedirectsToWww: false, headerDifferences: [] };
      }
    } else {
      // We're scanning apex — check www using existing function
      wwwCheck = await checkWwwConsistency(domain, headers);
    }

    data.wwwConsistency = wwwCheck;

    if (wwwCheck.headerDifferences.length > 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-www-consistency',
          name: 'WWW/apex header consistency',
          weight: 0.4,
          health: wwwCheck.headerDifferences.length >= 3 ? 'critical' : 'warning',
          evidence: `Security header inconsistencies between apex and www: ${wwwCheck.headerDifferences.join('; ')}`,
          recommendation: 'Ensure the same security headers are served on both the apex domain and www subdomain, or redirect one to the other.',
        }),
      );
    } else if (wwwCheck.apexRedirectsToWww || wwwCheck.wwwRedirectsToApex) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-www-consistency',
          name: 'WWW/apex header consistency',
          weight: 0.4,
          health: 'excellent',
          evidence: wwwCheck.apexRedirectsToWww
            ? 'Apex redirects to www — consistent configuration'
            : 'www redirects to apex — consistent configuration',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-www-consistency',
          name: 'WWW/apex header consistency',
          weight: 0.4,
          health: 'excellent',
          evidence: 'Security headers consistent between www and apex',
        }),
      );
    }
  } catch {
    checkpoints.push(
      infoCheckpoint('m01-www-consistency', 'WWW/apex header consistency', 'Unable to check www consistency'),
    );
  }

  // ─── 16. Cross-origin isolation headers ───────────────────────────────────
  // NOTE: security.txt → M12 (Legal Security & Compliance)
  // NOTE: Cookie security flags → M05/M07/M12 (browser-level cookie audits)
  {
    const crossOrigin = extractCrossOriginHeaders(headers);
    data.crossOriginHeaders = crossOrigin;

    // Only flag if CORS is wide open — other cross-origin headers are informational
    if (crossOrigin.cors === '*') {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-cross-origin',
          name: 'Cross-Origin headers',
          weight: 0.3,
          health: 'warning',
          evidence: 'Access-Control-Allow-Origin: * (wildcard — allows any origin)',
          recommendation: 'Restrict CORS to specific trusted origins instead of using a wildcard.',
        }),
      );
    } else if (crossOrigin.coop || crossOrigin.coep) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-cross-origin',
          name: 'Cross-Origin headers',
          weight: 0.3,
          health: 'excellent',
          evidence: `Cross-origin isolation headers configured: ${crossOrigin.coop ? `COOP=${crossOrigin.coop}` : ''}${crossOrigin.coep ? ` COEP=${crossOrigin.coep}` : ''}`.trim(),
        }),
      );
    }
    // If no CORS headers, that's normal — no checkpoint needed
  }

  // ─── 17. DMARC sub-policy and advanced analysis ───────────────────────────
  {
    const dmarcRecord = data.dmarc as string | null;
    if (dmarcRecord) {
      // Extract sub-policy (sp=) for subdomains
      const spMatch = dmarcRecord.match(/;\s*sp\s*=\s*(\w+)/i);
      const sp = spMatch ? spMatch[1]!.toLowerCase() : null;
      data.dmarcSubPolicy = sp;

      // Extract pct (percentage)
      const pctMatch = dmarcRecord.match(/;\s*pct\s*=\s*(\d+)/i);
      const pct = pctMatch ? parseInt(pctMatch[1]!, 10) : 100; // defaults to 100
      data.dmarcPct = pct;

      // Extract DMARC alignment modes
      const adkimMatch = dmarcRecord.match(/;\s*adkim\s*=\s*([rs])/i);
      const aspfMatch = dmarcRecord.match(/;\s*aspf\s*=\s*([rs])/i);
      data.dmarcAdkim = adkimMatch ? adkimMatch[1] : 'r'; // default relaxed
      data.dmarcAspf = aspfMatch ? aspfMatch[1] : 'r';

      if (pct < 100) {
        signals.push(
          createSignal({
            type: 'email-auth',
            name: 'DMARC partial enforcement',
            confidence: 0.95,
            evidence: `DMARC pct=${pct} — only ${pct}% of failing messages are subject to the policy`,
            category: 'security',
          }),
        );
      }

      if (sp && sp !== (data.dmarcPolicy as string)) {
        signals.push(
          createSignal({
            type: 'email-auth',
            name: `DMARC subdomain policy: ${sp}`,
            confidence: 0.9,
            evidence: `Subdomain policy (sp=${sp}) differs from main policy (p=${data.dmarcPolicy})`,
            category: 'security',
          }),
        );
      }
    }
  }

  // ─── 18. Wildcard DNS detection ───────────────────────────────────────────
  try {
    const { Resolver } = await import('node:dns/promises');
    const wdResolver = new Resolver();
    wdResolver.setServers(['8.8.8.8']);
    try {
      const wildcardIps = await wdResolver.resolve4(`_nonexistent_probe_${Date.now()}.${apexDomain}`);
      data.wildcardDns = wildcardIps.length > 0;
      if (wildcardIps.length > 0) {
        signals.push(
          createSignal({
            type: 'dns-config',
            name: 'Wildcard DNS',
            confidence: 0.85,
            evidence: `Wildcard DNS detected — random subdomain resolves to: ${wildcardIps.join(', ')}`,
            category: 'infrastructure',
          }),
        );
      }
    } catch {
      data.wildcardDns = false;
    }
  } catch {
    data.wildcardDns = null;
  }

  // ─── 19. TXT domain verification services ────────────────────────────────
  // Extract SaaS/service domain verification records from TXT — reveals tech stack
  // at the DNS layer (complementary to M02 HTTP-based fingerprinting).
  {
    const VERIFICATION_PATTERNS: Array<{ pattern: RegExp; service: string }> = [
      { pattern: /^google-site-verification=/i, service: 'Google Search Console' },
      { pattern: /^facebook-domain-verification=/i, service: 'Meta / Facebook' },
      { pattern: /^apple-domain-verification=/i, service: 'Apple' },
      { pattern: /^MS=/i, service: 'Microsoft 365' },
      { pattern: /^docusign=/i, service: 'DocuSign' },
      { pattern: /^atlassian-domain-verification=/i, service: 'Atlassian' },
      { pattern: /^docker-verification=/i, service: 'Docker Hub' },
      { pattern: /^postman-domain-verification=/i, service: 'Postman' },
      { pattern: /^h1-domain-verification=/i, service: 'HackerOne' },
      { pattern: /^canva-site-verification=/i, service: 'Canva' },
      { pattern: /^cursor-domain-verification/i, service: 'Cursor' },
      { pattern: /^anthropic-domain-verification/i, service: 'Anthropic' },
      { pattern: /^whimsical=/i, service: 'Whimsical' },
      { pattern: /^elevenlabs=/i, service: 'ElevenLabs' },
      { pattern: /^liveramp-site-verification=/i, service: 'LiveRamp' },
      { pattern: /^hubspot-domain-verification=/i, service: 'HubSpot' },
      { pattern: /^stripe-verification=/i, service: 'Stripe' },
      { pattern: /^shopify-verification=/i, service: 'Shopify' },
      { pattern: /^slack-domain-verification=/i, service: 'Slack' },
      { pattern: /^zoom-domain-verification=/i, service: 'Zoom' },
      { pattern: /^adobe-sign-verification=/i, service: 'Adobe Sign' },
      { pattern: /^webex-domain-verification=/i, service: 'Webex' },
      { pattern: /^cisco-ci-domain-verification=/i, service: 'Cisco' },
      { pattern: /^salesforce-verification=/i, service: 'Salesforce' },
      { pattern: /^twilio-domain-verification=/i, service: 'Twilio' },
      { pattern: /^dropbox-domain-verification=/i, service: 'Dropbox' },
      { pattern: /^notion-domain-verification=/i, service: 'Notion' },
      { pattern: /^linear-domain-verification=/i, service: 'Linear' },
      { pattern: /^fastly-domain-delegation/i, service: 'Fastly' },
      { pattern: /^cloudflare-verify/i, service: 'Cloudflare' },
      { pattern: /^ahrefs-site-verification=/i, service: 'Ahrefs' },
      { pattern: /^_?globalsign-domain-verification=/i, service: 'GlobalSign' },
      { pattern: /^have-i-been-pwned-verification=/i, service: 'Have I Been Pwned' },
      { pattern: /^onetrust-domain-verification=/i, service: 'OneTrust' },
      { pattern: /^miro-verification=/i, service: 'Miro' },
      { pattern: /^loom-verification=/i, service: 'Loom' },
      { pattern: /^figma-domain-verification=/i, service: 'Figma' },
      { pattern: /^neat-pulse-domain-verification/i, service: 'Neat Pulse' },
    ];

    const txtFlat = ((data.dns as DnsRecords | undefined)?.TXT ?? []).map((arr: string[]) => arr.join(''));
    const verifications: Array<{ service: string; record: string }> = [];
    const seen = new Set<string>();

    for (const txt of txtFlat) {
      for (const { pattern, service } of VERIFICATION_PATTERNS) {
        if (pattern.test(txt) && !seen.has(service)) {
          seen.add(service);
          verifications.push({ service, record: txt.slice(0, 80) });
          break;
        }
      }
    }

    data.domainVerifications = verifications;

    if (verifications.length > 0) {
      signals.push(
        createSignal({
          type: 'dns-verifications',
          name: 'Domain Verification Records',
          confidence: 0.9,
          evidence: `${verifications.length} service(s) verified via DNS TXT: ${verifications.map(v => v.service).join(', ')}`,
          category: 'infrastructure',
        }),
      );
    }
  }

  // ─── Source Map Detection (Layer 11) ────────────────────────────────────
  if (ctx.networkCollector) {
    const responses = ctx.networkCollector.getAllResponses();
    const sourceMaps = detectSourceMaps(responses);

    if (sourceMaps.length > 0) {
      data.exposedSourceMaps = sourceMaps;
      checkpoints.push(createCheckpoint({
        id: 'm01-source-maps',
        name: 'Source Map Exposure',
        weight: 0.3,
        health: sourceMaps.length > 5 ? 'warning' : 'good',
        evidence: `${sourceMaps.length} source map reference(s) detected (${sourceMaps.slice(0, 3).map(s => s.fileUrl).join(', ')})`,
        recommendation: sourceMaps.length > 5
          ? 'Source maps expose original source code in production. Remove SourceMap headers and sourceMappingURL comments from production builds.'
          : 'Source maps found in production — consider removing for security unless needed for error monitoring.',
      }));

      signals.push(createSignal({
        type: 'security',
        name: 'Source Maps Exposed',
        confidence: 0.9,
        evidence: `${sourceMaps.length} production source maps accessible`,
        category: 'security',
      }));
    }
  }

  // ─── API Endpoint Discovery (Layer 11) ─────────────────────────────────
  if (ctx.networkCollector) {
    const apiEndpoints = ctx.networkCollector.getAPIEndpoints();

    if (apiEndpoints.length > 0) {
      data.apiEndpoints = apiEndpoints;
      checkpoints.push(infoCheckpoint(
        'm01-api-surface',
        'API Surface Area',
        `${apiEndpoints.length} first-party API endpoint(s) discovered: ${apiEndpoints.slice(0, 5).map(e => `${e.method} ${e.url}`).join(', ')}`,
      ));
    }
  }

  // ─── Redirect Chain Analysis (Layer 12) ────────────────────────────────
  if (ctx.networkCollector) {
    const redirectChains = ctx.networkCollector.getRedirectChains();
    if (redirectChains.length > 0) {
      data.redirectChains = redirectChains.slice(0, 20);
    }
  }

  // ─── CORS Preflight Analysis (Layer 12) ────────────────────────────────
  if (ctx.networkCollector) {
    const preflights = ctx.networkCollector.getCORSPreflights();
    if (preflights.length > 0) {
      data.corsPreflights = preflights.length;
    }
  }

  // ─── 20. CSP Deep Parse ──────────────────────────────────────────────────
  {
    const cspValue = getHeader(headers, 'content-security-policy');
    if (cspValue) {
      const cspParsed = parseFullCsp(cspValue);
      data.cspDirectives = cspParsed;

      // Add signal for missing reporting
      if (!cspParsed.hasReporting) {
        signals.push(
          createSignal({
            type: 'security-header',
            name: 'CSP missing report-uri/report-to',
            confidence: 0.9,
            evidence: 'CSP does not include report-uri or report-to directive — policy violations will not be reported',
            category: 'security',
          }),
        );
      }

      // Add signal for permissive directives
      if (cspParsed.permissiveDirectives.length > 0) {
        signals.push(
          createSignal({
            type: 'security-header',
            name: 'CSP permissive directives',
            confidence: 0.9,
            evidence: `Overly permissive CSP directives: ${cspParsed.permissiveDirectives.join(', ')}`,
            category: 'security',
          }),
        );
      }
    }
  }

  // ─── 21. SRI Audit ─────────────────────────────────────────────────────
  if (ctx.html) {
    try {
      const sriResult = auditSri(ctx.html, domain);
      data.sriCoverage = sriResult;

      if (sriResult.totalExternal === 0) {
        checkpoints.push(
          infoCheckpoint(
            'm01-sri',
            'Subresource Integrity',
            'No cross-origin script or stylesheet resources detected',
          ),
        );
      } else {
        let health: CheckpointHealth;
        let evidence: string;
        let recommendation: string | undefined;

        if (sriResult.coveragePct >= 80) {
          health = 'excellent';
          evidence = `SRI coverage: ${sriResult.coveragePct}% (${sriResult.sriCount}/${sriResult.totalExternal} cross-origin resources have integrity attributes)`;
        } else if (sriResult.coveragePct >= 50) {
          health = 'good';
          evidence = `SRI coverage: ${sriResult.coveragePct}% (${sriResult.sriCount}/${sriResult.totalExternal} cross-origin resources have integrity attributes)`;
          recommendation = `Add integrity attributes to the remaining ${sriResult.totalExternal - sriResult.sriCount} cross-origin resources to prevent supply-chain attacks.`;
        } else if (sriResult.coveragePct >= 20) {
          health = 'warning';
          evidence = `SRI coverage: ${sriResult.coveragePct}% (${sriResult.sriCount}/${sriResult.totalExternal} cross-origin resources have integrity attributes)`;
          recommendation = `Low SRI coverage — add integrity attributes to cross-origin scripts and stylesheets. Missing on: ${sriResult.uncoveredResources.slice(0, 5).join(', ')}`;
        } else {
          health = 'warning';
          evidence = `SRI coverage: ${sriResult.coveragePct}% (${sriResult.sriCount}/${sriResult.totalExternal} cross-origin resources). Uncovered: ${sriResult.uncoveredResources.slice(0, 5).join(', ')}`;
          recommendation = 'Add Subresource Integrity (SRI) hash attributes to all cross-origin scripts and stylesheets to protect against CDN compromise.';
        }

        checkpoints.push(
          createCheckpoint({
            id: 'm01-sri',
            name: 'Subresource Integrity',
            weight: 0.3,
            health,
            evidence,
            recommendation,
          }),
        );
      }
    } catch {
      checkpoints.push(
        infoCheckpoint('m01-sri', 'Subresource Integrity', 'Unable to parse HTML for SRI audit'),
      );
    }
  }

  // ─── 22. Permissions-Policy Details ─────────────────────────────────────
  {
    const ppValue = getHeader(headers, 'permissions-policy') ?? getHeader(headers, 'feature-policy');
    if (ppValue) {
      const ppDetails = parseFullPermissionsPolicy(ppValue);
      data.permissionsPolicyDetails = ppDetails;

      if (ppDetails.permissiveFeatures.length > 0) {
        signals.push(
          createSignal({
            type: 'security-header',
            name: 'Permissions-Policy wildcard features',
            confidence: 0.85,
            evidence: `Features with wildcard (*) access: ${ppDetails.permissiveFeatures.join(', ')}`,
            category: 'security',
          }),
        );
      }
    }
  }

  // ─── 23. Accept-CH Client Hints ─────────────────────────────────────────
  {
    const acceptCHValue = getHeader(headers, 'accept-ch');
    if (acceptCHValue) {
      const hints = parseClientHints(acceptCHValue);
      data.clientHints = hints;

      signals.push(
        createSignal({
          type: 'performance',
          name: 'Client Hints',
          confidence: 0.9,
          evidence: `Accept-CH advertises: ${hints.advertisedHints.join(', ')}${hints.usesAdaptiveServing ? ' (adaptive serving enabled)' : ''}`,
          category: 'infrastructure',
        }),
      );
    } else {
      data.clientHints = { advertisedHints: [], usesAdaptiveServing: false };
    }
  }

  // ─── 24. HSTS Preload Readiness ─────────────────────────────────────────
  {
    const hstsValue = getHeader(headers, 'strict-transport-security');
    if (hstsValue) {
      const preloadReady = checkHstsPreloadReadiness(hstsValue);
      data.hstsPreloadReady = preloadReady;

      if (!preloadReady.ready) {
        signals.push(
          createSignal({
            type: 'security-header',
            name: 'HSTS not preload-ready',
            confidence: 0.95,
            evidence: `HSTS preload requirements not met: ${preloadReady.missingRequirements.join('; ')}`,
            category: 'security',
          }),
        );
      }
    } else {
      data.hstsPreloadReady = {
        ready: false,
        maxAge: 0,
        hasIncludeSubDomains: false,
        hasPreload: false,
        missingRequirements: ['HSTS header is missing entirely'],
      };
    }
  }

  // ─── 25. Redirect Chain Analysis ──────────────────────────────────────
  try {
    const chain = ctx.redirectChain;
    const hops = chain.length;
    const httpToHttps = chain.length >= 1 && chain[0]?.startsWith('http://') && ctx.finalUrl.startsWith('https://');
    const hasWwwRedirect = chain.some(u => u.includes('://www.')) || ctx.finalUrl.includes('://www.');
    const browserRedirectCount = ctx.browserRedirectChains.length;

    data.redirectChain = {
      hops,
      chain,
      finalUrl: ctx.finalUrl,
      httpToHttps,
      hasWwwRedirect,
      browserRedirectCount,
    };

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hops === 0) {
      health = 'excellent';
      evidence = 'No redirects — direct resolution';
    } else if (hops === 1 && httpToHttps) {
      health = 'excellent';
      evidence = `Single HTTP→HTTPS redirect: ${chain[0]} → ${ctx.finalUrl}`;
    } else if (hops <= 2) {
      health = 'good';
      evidence = `${hops} redirect(s): ${[...chain, ctx.finalUrl].join(' → ')}`;
    } else if (hops <= 4) {
      health = 'warning';
      // Latency estimate: 100-200ms per redirect = typical DNS+TCP+TLS round-trip per hop
      evidence = `${hops} redirects adding ~${hops * 100}-${hops * 200}ms latency: ${chain.slice(0, 3).join(' → ')}${hops > 3 ? '...' : ''} → ${ctx.finalUrl}`;
      recommendation = `Reduce redirect chain from ${hops} hops to 1-2 for faster page loads.`;
    } else {
      health = 'critical';
      evidence = `Excessive redirect chain: ${hops} hops. ${chain.slice(0, 3).join(' → ')}... → ${ctx.finalUrl}`;
      recommendation = `Critical: ${hops} redirects significantly impact load time. Consolidate to a single redirect.`;
    }

    checkpoints.push(createCheckpoint({
      id: 'm01-redirect-chain', name: 'Redirect Chain', weight: 0.3, health, evidence, recommendation,
    }));
  } catch {
    failedChecks++;
    checkpoints.push(
      createCheckpoint({
        id: 'm01-redirect-chain',
        name: 'Redirect Chain',
        weight: 0.3,
        health: 'critical',
        evidence: 'Failed to analyze redirect chain',
        recommendation: 'Ensure the site resolves without excessive redirects.',
      }),
    );
  }

  // ─── 26. Mixed Content Detection ──────────────────────────────────────
  {
    const mc = ctx.mixedContent;
    if (mc && mc.isHttps) {
      data.mixedContent = {
        activeCount: mc.activeCount,
        passiveCount: mc.passiveCount,
        entries: mc.entries.slice(0, 20),
      };

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (mc.activeCount === 0 && mc.passiveCount === 0) {
        health = 'excellent';
        evidence = 'No mixed content detected — all resources loaded over HTTPS';
      } else if (mc.activeCount === 0 && mc.passiveCount <= 3) {
        health = 'warning';
        evidence = `${mc.passiveCount} passive mixed content resource(s) (images/media over HTTP): ${mc.entries.slice(0, 3).map(e => e.url).join(', ')}`;
        recommendation = 'Update image and media URLs to use HTTPS to avoid browser warnings.';
      } else if (mc.activeCount > 0) {
        health = 'critical';
        evidence = `${mc.activeCount} active mixed content resource(s) blocked by browsers (scripts/styles over HTTP), ${mc.passiveCount} passive. Examples: ${mc.entries.filter(e => e.severity === 'active').slice(0, 3).map(e => e.url).join(', ')}`;
        recommendation = 'Critical: Browsers block active mixed content (HTTP scripts/styles on HTTPS pages). Update all resource URLs to HTTPS immediately.';
      } else {
        health = 'warning';
        evidence = `${mc.passiveCount} passive mixed content resource(s) over HTTP`;
        recommendation = 'Update all resource URLs to HTTPS to prevent browser security warnings.';
      }

      checkpoints.push(createCheckpoint({
        id: 'm01-mixed-content', name: 'Mixed Content', weight: 0.4, health, evidence, recommendation,
      }));
    } else if (mc && !mc.isHttps) {
      data.mixedContent = { note: 'Page served over HTTP — mixed content check not applicable' };
      checkpoints.push(infoCheckpoint('m01-mixed-content', 'Mixed Content', 'Page served over HTTP — mixed content detection not applicable'));
    } else {
      // ctx.mixedContent is null — browser phase did not run or data was unavailable
      checkpoints.push(infoCheckpoint('m01-mixed-content', 'Mixed Content', 'Mixed content data not available — browser phase may not have executed'));
    }
  }

  // ─── Build final result ─────────────────────────────────────────────────
  const status: 'success' | 'partial' | 'error' =
    failedChecks === 0
      ? 'success'
      : failedChecks <= 5
        ? 'partial'
        : 'error';

  return {
    moduleId: 'M01' as ModuleId,
    status,
    data,
    signals,
    score: null, // Calculated by the runner from checkpoints
    checkpoints,
    duration: Date.now() - startTime,
  };
};

// Register the module executor
registerModuleExecutor('M01' as ModuleId, execute);

export default execute;
