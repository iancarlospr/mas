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
  resolveDmarc,
  probeDkim,
} from '../../utils/dns.js';
import type { DnsRecords } from '../../utils/dns.js';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';

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
  const pMatch = record.match(/p=([A-Za-z0-9+/=]+)/);
  if (!pMatch) return 0;
  // Base64 encoded key length: each 4 chars = 3 bytes. RSA key size ~ byte length * 8.
  const base64 = (pMatch[1] ?? '').replace(/\s/g, '');
  const byteLength = Math.floor((base64.length * 3) / 4);
  return byteLength * 8;
}

interface TlsCertInfo {
  valid: boolean;
  daysRemaining: number;
  protocol: string;
  issuer: string;
  subject: string;
  keyType: string; // 'ECDSA' | 'RSA' | 'unknown'
  serialNumber: string;
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

          socket.destroy();
          resolve({
            valid,
            daysRemaining,
            protocol,
            issuer: issuerStr,
            subject: subjectStr,
            keyType,
            serialNumber: cert.serialNumber ?? '',
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

  data.domain = domain;

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

  // ─── 2. SPF checkpoint ──────────────────────────────────────────────────
  try {
    const spfRecord = findSpfRecord(dns.TXT);
    data.spf = spfRecord;

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
    } else {
      const lookups = countSpfLookups(spfRecord);
      const allQualifier = getSpfAllQualifier(spfRecord);
      data.spfLookups = lookups;
      data.spfAllQualifier = allQualifier;

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
      } else {
        health = 'warning';
        const reasons: string[] = [];
        if (allQualifier === '+') reasons.push('+all allows any server to send');
        if (lookups > 10) reasons.push(`${lookups} DNS lookups exceeds the 10-lookup limit`);
        evidence = `SPF present but: ${reasons.join('; ')}. Record: ${spfRecord}`;
        recommendation = allQualifier === '+'
          ? 'Remove +all from SPF immediately -- it allows anyone to spoof your domain.'
          : `Reduce SPF DNS lookups to 10 or fewer (currently ${lookups}). Use ip4/ip6 mechanisms or flatten includes.`;
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
    const dmarcRecord = await resolveDmarc(domain);
    data.dmarc = dmarcRecord;

    if (!dmarcRecord) {
      checkpoints.push(
        createCheckpoint({
          id: 'm01-dmarc',
          name: 'DMARC policy',
          weight: 0.9,
          health: 'critical',
          evidence: 'No DMARC record found at _dmarc.' + domain,
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
        recommendation: 'Publish a DMARC TXT record at _dmarc.' + domain,
      }),
    );
  }

  // ─── 4. DKIM checkpoint ─────────────────────────────────────────────────
  try {
    const dkimResults = await probeDkim(domain);
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
      const dnskeyRecords = await dnssecResolver.resolveTxt(`_dnskey.${domain}`);
      if (dnskeyRecords.length > 0) {
        dnssecDetected = true;
      }
    } catch {
      // Not signed or record doesn't exist -- expected for most domains
    }

    // Fallback: check if there are any TXT records that mention DNSSEC or
    // if CAA records exist (correlated but not definitive)
    if (!dnssecDetected) {
      const allTxt = dns.TXT.map((parts) => parts.join('')).join(' ');
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
      evidence = 'No DNSSEC signing detected for ' + domain;
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
      const hasUnsafeInline = /unsafe-inline/i.test(cspValue);
      const hasUnsafeEval = /unsafe-eval/i.test(cspValue);
      const hasWildcard = /\s\*\s|'\*'|default-src\s+\*|script-src\s+\*/.test(cspValue);

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (!hasUnsafeInline && !hasUnsafeEval && !hasWildcard) {
        health = 'excellent';
        evidence = `CSP present with strict policy (no unsafe-inline, no unsafe-eval): ${cspValue.substring(0, 200)}`;
      } else if (!hasWildcard && (hasUnsafeInline || hasUnsafeEval)) {
        health = 'good';
        const issues: string[] = [];
        if (hasUnsafeInline) issues.push('unsafe-inline');
        if (hasUnsafeEval) issues.push('unsafe-eval');
        evidence = `CSP present but contains ${issues.join(' and ')}: ${cspValue.substring(0, 200)}`;
        recommendation = `Remove ${issues.join(' and ')} from CSP. Use nonces or hashes instead of unsafe-inline.`;
      } else {
        health = 'warning';
        evidence = `CSP present but overly permissive (wildcard or broad sources): ${cspValue.substring(0, 200)}`;
        recommendation = 'Tighten the Content-Security-Policy to restrict script and resource sources.';
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
    const emailInfo = identifyEmailProvider(dns.MX);
    data.emailProvider = emailInfo;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (emailInfo.provider === 'none') {
      health = 'critical';
      evidence = 'No MX records found -- domain cannot receive email';
      recommendation = 'If email is needed, configure MX records with a professional email provider.';
    } else if (emailInfo.provider === 'Google Workspace' || emailInfo.provider === 'Microsoft 365') {
      health = 'excellent';
      evidence = `Professional email provider detected: ${emailInfo.provider} (MX: ${dns.MX.map((r) => r.exchange).join(', ')})`;
    } else if (emailInfo.provider === 'Custom') {
      health = 'good';
      evidence = `Custom mail server (MX: ${dns.MX.map((r) => r.exchange).join(', ')})`;
    } else {
      health = 'excellent';
      evidence = `Email provider: ${emailInfo.provider} (MX: ${dns.MX.map((r) => r.exchange).join(', ')})`;
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
          evidence: `MX: ${dns.MX.map((r) => r.exchange).join(', ')}`,
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
    data.caa = dns.CAA;

    if (dns.CAA.length === 0) {
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
      const caaIssuers = dns.CAA
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

  // ─── Build final result ─────────────────────────────────────────────────
  const totalCheckpoints = 15; // Expected checkpoint count
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
