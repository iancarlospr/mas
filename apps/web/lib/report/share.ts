/**
 * Report sharing — JWT-based read-only share tokens.
 * PRD-cont-4 Section 1.5
 */
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.REPORT_SHARE_SECRET ?? process.env.ENGINE_HMAC_SECRET ?? 'dev-share-secret',
);

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
    .sign(SECRET);
}

/** Verify a share token and return the scanId if valid. */
export async function verifyShareToken(
  token: string | undefined | null,
  expectedScanId: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as unknown as SharePayload & { exp?: number };
    return p.scanId === expectedScanId && p.permissions === 'read-only';
  } catch {
    return false;
  }
}
