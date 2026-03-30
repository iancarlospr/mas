/**
 * Report sharing — JWT-based read-only share tokens.
 * PRD-cont-4 Section 1.5
 */
import { SignJWT, jwtVerify } from 'jose';

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (_secret) return _secret;
  const shareSecret = process.env.REPORT_SHARE_SECRET ?? process.env.ENGINE_HMAC_SECRET;
  if (!shareSecret) {
    throw new Error('[share] Neither REPORT_SHARE_SECRET nor ENGINE_HMAC_SECRET is set');
  }
  _secret = new TextEncoder().encode(shareSecret);
  return _secret;
}

interface SharePayload {
  scanId: string;
  permissions: 'read-only';
}

/** Generate a signed share URL token (30-day expiry). */
export async function generateShareToken(scanId: string): Promise<string> {
  return new SignJWT({ scanId, permissions: 'read-only' } satisfies SharePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(getSecret());
}

/** Verify a share token and return the scanId if valid. */
export async function verifyShareToken(
  token: string | undefined | null,
  expectedScanId: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as SharePayload & { exp?: number };
    return p.scanId === expectedScanId && p.permissions === 'read-only';
  } catch {
    return false;
  }
}
