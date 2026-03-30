/**
 * StealthProfile Generator
 *
 * Generates per-scan randomized but internally-consistent browser profiles
 * to avoid bot detection by Akamai Bot Manager, Cloudflare Bot Management,
 * PerimeterX/HUMAN, and DataDome.
 *
 * Each profile maintains consistency between UA, sec-ch-ua headers, viewport,
 * timezone, WebGL renderer, and hardware properties so that no single
 * inconsistency can flag the session.
 */

export interface StealthProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  timezoneId: string;
  locale: string;
  platform: 'macOS' | 'Windows' | 'Android';
  secChUa: string;
  secChUaPlatform: string;
  secChUaPlatformVersion: string;
  webglVendor: string;
  webglRenderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
}

// ── UA pools ─────────────────────────────────────────────────────────────

interface UATemplate {
  chromeVersion: number;
  chromeFull: string;
  platform: 'macOS' | 'Windows' | 'Android';
  osUA: string;
  secChUaPlatform: string;
  secChUaPlatformVersion: string;
}

const UA_TEMPLATES: UATemplate[] = [
  // Chrome 130 – macOS
  { chromeVersion: 130, chromeFull: '130.0.6723.117', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"14.5.0"' },
  { chromeVersion: 130, chromeFull: '130.0.6723.117', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.0.0"' },
  // Chrome 131 – macOS
  { chromeVersion: 131, chromeFull: '131.0.6778.86', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"14.7.0"' },
  { chromeVersion: 131, chromeFull: '131.0.6778.140', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.1.0"' },
  // Chrome 132 – macOS
  { chromeVersion: 132, chromeFull: '132.0.6834.83', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.2.0"' },
  { chromeVersion: 132, chromeFull: '132.0.6834.110', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"14.6.0"' },
  // Chrome 133 – macOS
  { chromeVersion: 133, chromeFull: '133.0.6917.58', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.3.0"' },
  { chromeVersion: 133, chromeFull: '133.0.6917.92', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.2.0"' },
  // Chrome 134 – macOS
  { chromeVersion: 134, chromeFull: '134.0.6998.35', platform: 'macOS', osUA: 'Macintosh; Intel Mac OS X 10_15_7', secChUaPlatform: '"macOS"', secChUaPlatformVersion: '"15.3.0"' },

  // Chrome 130 – Windows
  { chromeVersion: 130, chromeFull: '130.0.6723.117', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"10.0.0"' },
  { chromeVersion: 130, chromeFull: '130.0.6723.117', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"15.0.0"' },
  // Chrome 131 – Windows
  { chromeVersion: 131, chromeFull: '131.0.6778.86', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"10.0.0"' },
  { chromeVersion: 131, chromeFull: '131.0.6778.140', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"15.0.0"' },
  // Chrome 132 – Windows
  { chromeVersion: 132, chromeFull: '132.0.6834.83', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"10.0.0"' },
  { chromeVersion: 132, chromeFull: '132.0.6834.110', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"15.0.0"' },
  // Chrome 133 – Windows
  { chromeVersion: 133, chromeFull: '133.0.6917.58', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"15.0.0"' },
  { chromeVersion: 133, chromeFull: '133.0.6917.92', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"10.0.0"' },
  // Chrome 134 – Windows
  { chromeVersion: 134, chromeFull: '134.0.6998.35', platform: 'Windows', osUA: 'Windows NT 10.0; Win64; x64', secChUaPlatform: '"Windows"', secChUaPlatformVersion: '"15.0.0"' },
];

// ── Viewport pool (common desktop resolutions) ──────────────────────────

const BASE_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1680, height: 1050 },
  { width: 1600, height: 900 },
];

// ── Timezone pools ──────────────────────────────────────────────────────

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

const INTERNATIONAL_TIMEZONE_MAP: Record<string, string[]> = {
  uk: ['Europe/London'],
  de: ['Europe/Berlin'],
  fr: ['Europe/Paris'],
  jp: ['Asia/Tokyo'],
  kr: ['Asia/Seoul'],
  cn: ['Asia/Shanghai'],
  au: ['Australia/Sydney'],
  br: ['America/Sao_Paulo'],
  in: ['Asia/Kolkata'],
  mx: ['America/Mexico_City'],
  pr: ['America/Puerto_Rico'],
};

// ── WebGL GPU strings ───────────────────────────────────────────────────

interface GPUProfile {
  vendor: string;
  renderer: string;
  platforms: Array<'macOS' | 'Windows' | 'Android'>;
}

const GPU_PROFILES: GPUProfile[] = [
  // NVIDIA (Windows)
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  // AMD (Windows)
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  // Intel (Windows + macOS)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', platforms: ['Windows'] },
  // Apple (macOS)
  { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)', platforms: ['macOS'] },
  { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)', platforms: ['macOS'] },
  { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M3, OpenGL 4.1)', platforms: ['macOS'] },
  { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)', platforms: ['macOS'] },
  { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)', platforms: ['macOS'] },
  // Intel Iris (macOS)
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel Inc., Intel Iris Plus Graphics, OpenGL 4.1)', platforms: ['macOS'] },
];

// ── Hardware property pools ─────────────────────────────────────────────

const HARDWARE_CONCURRENCY_OPTIONS = [4, 8, 12, 16];
const DEVICE_MEMORY_OPTIONS = [4, 8, 16];

// ── Utility ─────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function jitter(value: number, maxDelta: number): number {
  return value + Math.floor(Math.random() * (maxDelta * 2 + 1)) - maxDelta;
}

/**
 * Detect geo region from a URL's TLD for timezone selection.
 */
function detectRegion(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const tld = hostname.split('.').pop()?.toLowerCase();
    if (!tld) return null;

    const TLD_TO_REGION: Record<string, string> = {
      uk: 'uk', 'co.uk': 'uk',
      de: 'de',
      fr: 'fr',
      jp: 'jp', 'co.jp': 'jp',
      kr: 'kr', 'co.kr': 'kr',
      cn: 'cn',
      au: 'au', 'com.au': 'au',
      br: 'br', 'com.br': 'br',
      in: 'in', 'co.in': 'in',
      mx: 'mx', 'com.mx': 'mx',
      pr: 'pr',
    };

    // Check compound TLDs first
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const compound = parts.slice(-2).join('.');
      if (TLD_TO_REGION[compound]) return TLD_TO_REGION[compound]!;
    }

    return TLD_TO_REGION[tld] ?? null;
  } catch {
    return null;
  }
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate a randomized but internally-consistent browser profile.
 * All properties are cross-validated so no single mismatch flags detection.
 *
 * @param targetUrl - Optional URL to select geo-appropriate timezone
 */
export function generateStealthProfile(targetUrl?: string): StealthProfile {
  // 1. Pick a UA template (determines platform + Chrome version)
  const template = pick(UA_TEMPLATES);

  // 2. Build User-Agent string
  const userAgent = `Mozilla/5.0 (${template.osUA}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${template.chromeFull} Safari/537.36`;

  // 3. Build sec-ch-ua header (must match Chrome version)
  const secChUa = `"Chromium";v="${template.chromeVersion}", "Google Chrome";v="${template.chromeVersion}", "Not-A.Brand";v="99"`;

  // 4. Viewport with ±10px jitter
  const base = pick(BASE_VIEWPORTS);
  const viewport = {
    width: jitter(base.width, 10),
    height: jitter(base.height, 10),
  };

  // 5. Timezone — geo-appropriate if URL has international TLD
  let timezoneId: string;
  const region = targetUrl ? detectRegion(targetUrl) : null;
  if (region && INTERNATIONAL_TIMEZONE_MAP[region]) {
    timezoneId = pick(INTERNATIONAL_TIMEZONE_MAP[region]!);
  } else {
    timezoneId = pick(US_TIMEZONES);
  }

  // 6. WebGL GPU — must match platform
  const compatibleGPUs = GPU_PROFILES.filter(g => g.platforms.includes(template.platform));
  const gpu = pick(compatibleGPUs);

  // 7. Hardware properties
  const hardwareConcurrency = pick(HARDWARE_CONCURRENCY_OPTIONS);
  const deviceMemory = pick(DEVICE_MEMORY_OPTIONS);

  return {
    userAgent,
    viewport,
    timezoneId,
    locale: 'en-US',
    platform: template.platform,
    secChUa,
    secChUaPlatform: template.secChUaPlatform,
    secChUaPlatformVersion: template.secChUaPlatformVersion,
    webglVendor: gpu.vendor,
    webglRenderer: gpu.renderer,
    hardwareConcurrency,
    deviceMemory,
  };
}
