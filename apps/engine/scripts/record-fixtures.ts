#!/usr/bin/env npx tsx
/**
 * Record DNS fixtures from live domains for test data.
 *
 * Usage:
 *   npx tsx scripts/record-fixtures.ts --domain=hubspot.com
 *   npx tsx scripts/record-fixtures.ts --domain=shopify.com
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../test/fixtures');

async function recordDnsFixture(domain: string) {
  const fixtureDir = join(FIXTURES_DIR, 'dns');
  await mkdir(fixtureDir, { recursive: true });

  const fixture = {
    domain,
    recordedAt: new Date().toISOString(),
    txt: await dns.resolveTxt(domain).catch(() => []),
    mx: await dns.resolveMx(domain).catch(() => []),
    ns: await dns.resolveNs(domain).catch(() => []),
    a: await dns.resolve4(domain).catch(() => []),
    aaaa: await dns.resolve6(domain).catch(() => []),
    cname: await dns.resolveCname(domain).catch(() => []),
    dmarcTxt: await dns.resolveTxt(`_dmarc.${domain}`).catch(() => []),
  };

  const filePath = join(fixtureDir, `${domain}.json`);
  await writeFile(filePath, JSON.stringify(fixture, null, 2));
  console.log(`Recorded DNS fixture for ${domain} -> ${filePath}`);
}

async function recordHttpFixture(domain: string) {
  const fixtureDir = join(FIXTURES_DIR, 'http', 'headers');
  await mkdir(fixtureDir, { recursive: true });

  try {
    const response = await fetch(`https://${domain}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const fixture = {
      domain,
      recordedAt: new Date().toISOString(),
      status: response.status,
      url: response.url,
      headers,
    };

    const filePath = join(fixtureDir, `${domain}.json`);
    await writeFile(filePath, JSON.stringify(fixture, null, 2));
    console.log(`Recorded HTTP headers fixture for ${domain} -> ${filePath}`);
  } catch (error) {
    console.error(
      `Failed to record HTTP fixture for ${domain}:`,
      (error as Error).message,
    );
  }
}

// Main
const domainArg = process.argv.find((a) => a.startsWith('--domain='));
const domain = domainArg?.split('=')[1] || 'example.com';

console.log(`Recording fixtures for: ${domain}\n`);

await recordDnsFixture(domain);
await recordHttpFixture(domain);

console.log('\nDone!');
