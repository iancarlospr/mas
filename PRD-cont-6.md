# PRD-cont-6: Launch Readiness Execution Plan

**Project:** MarketingAlphaScan
**Author:** L10 Principal Engineer
**Date:** 2026-02-10
**Status:** EXECUTION READY
**Priority Legend:** P0 = ship-blocker | P1 = launch week | P2 = fast-follow

---

## Executive Summary

MarketingAlphaScan is ~95% built across 5 PRD cycles: 46 engine modules, 26 chart components, 26 report components, email system, Stripe integration, AI chat, Docker deployment, and CI/CD. A production readiness audit revealed **4 critical**, **11 high**, and **11 medium** severity issues. This document is the definitive execution plan to resolve every finding and ship.

**Severity breakdown:**

| Priority | Count | Theme |
|----------|-------|-------|
| P0 | 7 | Security, authorization, error boundaries |
| P1 | 10 | PDF download, rate limiting, error handling |
| P1 Gate | — | Module testing & edge case review (Section 6) |
| P2 | 9 | Missing pages, observability, data integrity, config |

**Estimated effort:** 2-3 focused engineering days.

---

## Section 1: Critical Security Fixes (P0 — Must Fix Before Any Deployment)

### 1.1 Stripe Webhook Using Anon Key

**File:** `apps/web/app/api/webhooks/stripe/route.ts:9-20`
**Severity:** CRITICAL
**Finding:** The `createAdminClient()` function uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key) instead of the service role key. The Stripe webhook has no user session — it arrives from Stripe's servers. With the anon key + empty cookies, the client operates as an unauthenticated user, meaning all database writes are subject to RLS policies. This means the `payments.update`, `scans.update`, `chat_credits.upsert`, and `audit_log.insert` calls may silently fail or be blocked by RLS.

**Current code:**
```typescript
// apps/web/app/api/webhooks/stripe/route.ts:8-20
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Replace with service role in production
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
```

**Fixed code:**
```typescript
// apps/web/app/api/webhooks/stripe/route.ts
// Replace import + createAdminClient with:
import { createServiceClient } from '@/lib/supabase/server';

// Then at line 49, replace:
//   const supabase = createAdminClient();
// with:
//   const supabase = createServiceClient();
```

**Rationale:** `createServiceClient()` (defined at `apps/web/lib/supabase/server.ts:31-37`) uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS — exactly what a webhook handler needs. The Resend webhook (`apps/web/app/api/webhooks/resend/route.ts:55`) already uses this correct pattern.

**Verification:** After fix, trigger a test Stripe webhook via `stripe trigger checkout.session.completed` and confirm the `payments` row updates to `status = 'completed'`.

---

### 1.2 GET `/api/scans/[id]` Missing Auth Check

**File:** `apps/web/app/api/scans/[id]/route.ts:4-58`
**Severity:** CRITICAL
**Finding:** The scan detail endpoint returns full scan data (including `ipAddress`, `countryCode`, and all `moduleResults`) to any caller — no authentication or ownership check. Any user who guesses or enumerates a UUID can read another user's scan data.

**Current code:**
```typescript
// apps/web/app/api/scans/[id]/route.ts:4-16
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: scan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single();
  // ... returns all data with no ownership check
```

**Fixed code:**
```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: scan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Ownership check: allow owner, or anonymous peek scans (user_id IS NULL)
  if (scan.user_id && scan.user_id !== user?.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Strip sensitive fields for non-owners
  const { ip_address, country_code, ...safeScan } = scan;

  // ... rest of handler using safeScan
```

**Rationale:** Users should only see their own scans. Anonymous peek scans (`user_id IS NULL`) remain publicly accessible since they have no owner. The `ip_address` and `country_code` fields should never be returned in the API response — they're internal metadata. Note: RLS on the `scans` table (`"Users see own scans"` policy) already provides a database-level guard, but the API should enforce this explicitly and strip PII.

---

### 1.3 `INTERNAL_API_SECRET` Undefined Bypass

**File:** `apps/web/app/api/email/send/route.ts:18-20`
**Severity:** CRITICAL
**Finding:** If `INTERNAL_API_SECRET` is not set in the environment, the comparison `secret !== process.env.INTERNAL_API_SECRET` becomes `undefined !== undefined` which is `false` — meaning the check passes and the endpoint is wide open. Any external caller can trigger arbitrary email sends.

**Current code:**
```typescript
// apps/web/app/api/email/send/route.ts:18-20
const secret = request.headers.get('x-internal-secret');
if (secret !== process.env.INTERNAL_API_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Fixed code:**
```typescript
const secret = request.headers.get('x-internal-secret');
const expectedSecret = process.env.INTERNAL_API_SECRET;
if (!expectedSecret || secret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Additionally:**
- Add `INTERNAL_API_SECRET` to `.env.example` (see Section 9.2)
- Add a startup check that logs a warning if `INTERNAL_API_SECRET` is not set in production

**Rationale:** Defense-in-depth — the null check ensures an unconfigured secret always denies access rather than silently granting it.

---

### 1.4 No Error/404 Pages

**Files to create:**
- `apps/web/app/error.tsx` (root error boundary)
- `apps/web/app/not-found.tsx` (root 404)
- `apps/web/app/(dashboard)/error.tsx` (dashboard error boundary)

**Severity:** CRITICAL (UX + information leak)
**Finding:** Without custom error pages, Next.js serves its default error UI which exposes stack traces in development and shows a generic, unbranded page in production. Users who hit a bad route or encounter a server error see no way to recover.

**`apps/web/app/not-found.tsx`:**
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
      <div className="text-center max-w-md px-6">
        <h1 className="font-heading font-700 text-6xl text-[#1A1A2E]">404</h1>
        <p className="mt-4 text-lg text-[#64748B]">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block bg-[#0F3460] text-white rounded-lg px-6 py-3 font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
```

**`apps/web/app/error.tsx`:**
```tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
      <div className="text-center max-w-md px-6">
        <h1 className="font-heading font-700 text-4xl text-[#1A1A2E]">
          Something went wrong
        </h1>
        <p className="mt-4 text-[#64748B]">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-[#94A3B8] font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-8 bg-[#0F3460] text-white rounded-lg px-6 py-3 font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

**`apps/web/app/(dashboard)/error.tsx`:** Same structure as root error.tsx but with dashboard layout context (sidebar remains visible, error replaces main content area).

---

## Section 2: Authorization & Access Control Fixes (P0)

### 2.1 Chat Endpoint Cross-User Access

**File:** `apps/web/app/api/chat/[scanId]/route.ts:76-89`
**Severity:** HIGH
**Finding:** The POST handler verifies the user is authenticated and that the scan exists, but never checks that `scan.user_id === user.id`. Any authenticated user with chat credits can chat against any other user's paid scan — reading their full M46 knowledge base in the process.

**Current code:**
```typescript
// apps/web/app/api/chat/[scanId]/route.ts:76-89
const { data: scan } = await supabase
  .from('scans')
  .select('id, tier, domain')
  .eq('id', scanId)
  .single();

if (!scan) {
  return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
}

if (scan.tier !== 'paid') {
  return NextResponse.json({ error: 'Alpha Brief required for chat' }, { status: 403 });
}
```

**Fixed code:**
```typescript
const { data: scan } = await supabase
  .from('scans')
  .select('id, tier, domain, user_id')
  .eq('id', scanId)
  .single();

if (!scan) {
  return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
}

if (scan.user_id !== user.id) {
  return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
}

if (scan.tier !== 'paid') {
  return NextResponse.json({ error: 'Alpha Brief required for chat' }, { status: 403 });
}
```

**Also fix the GET handler** at line 176-205: same issue — add `user_id` to the select and verify ownership. The GET already filters `chat_messages` by `user_id`, but the scan lookup itself needs the ownership check.

**Rationale:** Return 404 (not 403) for scans the user doesn't own to avoid leaking scan existence.

---

### 2.2 Checkout Endpoint Scan Ownership

**File:** `apps/web/app/api/checkout/route.ts:30`
**Severity:** HIGH
**Finding:** The checkout endpoint creates a Stripe payment session for any `scanId` passed in the request body without verifying the authenticated user owns that scan. An attacker could create a payment session for someone else's scan, and if completed, the webhook would upgrade that scan and grant chat credits.

**Current code:**
```typescript
// apps/web/app/api/checkout/route.ts:30-35
const { product, scanId } = parsed.data;
const priceId = PRICE_MAP[product];
// Directly creates Stripe session — no scan ownership check
```

**Fixed code:**
```typescript
const { product, scanId } = parsed.data;
const priceId = PRICE_MAP[product];

if (!priceId) {
  return NextResponse.json({ error: 'Product not configured' }, { status: 500 });
}

// Verify scan ownership
const { data: scan } = await supabase
  .from('scans')
  .select('id, user_id, tier, status')
  .eq('id', scanId)
  .single();

if (!scan || (scan.user_id && scan.user_id !== user.id)) {
  return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
}

if (product === 'alpha_brief' && scan.tier === 'paid') {
  return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
}

if (scan.status === 'failed' || scan.status === 'cancelled') {
  return NextResponse.json({ error: 'Cannot purchase for a failed scan' }, { status: 400 });
}
```

**Rationale:** Payment flows must verify ownership. Also reject purchases for already-upgraded or failed scans.

---

### 2.3 Scan Upgrade Status Validation

**File:** `apps/web/app/api/scans/[id]/upgrade/route.ts:29-32`
**Severity:** HIGH
**Finding:** The upgrade endpoint allows upgrading peek → full even for failed/cancelled scans. While it conditionally skips the engine call for terminal states (line 41), it still mutates the `scans` row to set `tier: 'full'` and `user_id`, leaving a dangling "full" scan that will never complete.

Additionally, there is no ownership check — any authenticated user can claim and upgrade any peek scan.

**Current code:**
```typescript
// apps/web/app/api/scans/[id]/upgrade/route.ts:29-46
if (scan.tier !== 'peek') {
  return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
}

// Associate scan with user and upgrade tier
await supabase
  .from('scans')
  .update({ user_id: user.id, tier: 'full' })
  .eq('id', scanId);

if (scan.status !== 'failed' && scan.status !== 'cancelled') {
  await engineFetch(/* ... */);
}
```

**Fixed code:**
```typescript
if (scan.tier !== 'peek') {
  return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
}

// Reject failed/cancelled scans
if (scan.status === 'failed' || scan.status === 'cancelled') {
  return NextResponse.json({ error: 'Cannot upgrade a failed scan' }, { status: 400 });
}

// If scan already has an owner and it's not this user, reject
if (scan.user_id && scan.user_id !== user.id) {
  return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
}

// Associate scan with user and upgrade tier
await supabase
  .from('scans')
  .update({ user_id: user.id, tier: 'full' })
  .eq('id', scanId);

await engineFetch(`/engine/scans/${scanId}/upgrade`, {
  method: 'POST',
  body: JSON.stringify({ tier: 'full' }),
});
```

**Rationale:** Don't allow upgrades on terminal-state scans. Don't allow user A to claim user B's scan.

---

## Section 3: Missing Feature — PDF Download Endpoint (P1)

### 3.1 Create PDF API Route

**File to create:** `apps/web/app/api/reports/[id]/pdf/route.ts`
**Severity:** HIGH
**Finding:** The email system already references `/api/reports/${scanId}/pdf` (see `apps/web/app/api/email/send/route.ts:124`), the report top bar has a "Download PDF" button, and the engine has a full Playwright-based PDF generator (`apps/engine/src/services/pdf-generator.ts`). But no web API route exists to serve the PDF.

**Implementation:**
```typescript
// apps/web/app/api/reports/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { engineFetch } from '@/lib/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;

  // Auth: either logged-in owner OR valid share token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const shareToken = request.nextUrl.searchParams.get('share');

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status, domain')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid' || scan.status !== 'complete') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Verify access: owner or valid share token
  const isOwner = user && scan.user_id === user.id;
  let isSharedAccess = false;
  if (shareToken) {
    const { data: share } = await serviceClient
      .from('report_shares')
      .select('id')
      .eq('scan_id', scanId)
      .eq('token', shareToken)
      .single();
    isSharedAccess = !!share;
  }

  if (!isOwner && !isSharedAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for cached PDF in Supabase Storage
  const pdfPath = `reports/${scanId}/MarketingAlphaScan-Report.pdf`;
  const { data: existing } = await serviceClient.storage
    .from('reports')
    .createSignedUrl(pdfPath, 60 * 60); // 1h

  if (existing?.signedUrl) {
    // Redirect to signed URL
    return NextResponse.redirect(existing.signedUrl);
  }

  // Generate via engine
  const res = await engineFetch(`/engine/reports/${scanId}/pdf`, {
    method: 'POST',
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 502 },
    );
  }

  const { signedUrl } = await res.json();
  return NextResponse.redirect(signedUrl);
}
```

**Engine side:** Add a `/engine/reports/:scanId/pdf` route in the Fastify server that calls `generateReportPDF()` + `uploadReportPDF()` and returns the signed URL.

### 3.2 Update Report Top Bar Download Button

**File:** `apps/web/components/report/report-top-bar.tsx:73-79`
**Current:** `onClick={() => window.print()}`

**Fixed code:**
```tsx
<a
  href={`/api/reports/${scanId}/pdf${isShared ? `?share=${new URLSearchParams(window.location.search).get('share')}` : ''}`}
  download
  className="download-button inline-flex items-center gap-2 bg-[#0F3460] text-white rounded-lg px-4 py-2 text-sm font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
>
  <Download size={16} />
  Download PDF
</a>
```

**Fallback:** If PDF generation is slow, use a loading state and fetch the URL via JS instead of a direct `<a>` tag.

---

## Section 4: Rate Limiting & Abuse Prevention (P1)

### 4.1 Rate Limit on `/api/auth/send-email`

**File:** `apps/web/app/api/auth/send-email/route.ts`
**Severity:** HIGH
**Finding:** The Supabase Send Email Hook handler has no rate limiting. An attacker who discovers the HMAC secret (or if Supabase invokes the hook repeatedly) could send unlimited emails. While Resend has account-level rate limits, abuse could exhaust the monthly quota or get the sending domain blocklisted.

**Fix:** This endpoint is called by Supabase itself (not user-facing), so the primary defense is the HMAC signature verification (already present). However, add a defensive in-memory rate limit of 3 calls per email address per hour as a safety net.

### 4.2 Rate Limit on `/api/chat/[scanId]`

**File:** `apps/web/app/api/chat/[scanId]/route.ts`
**Severity:** HIGH
**Finding:** The chat endpoint deducts credits but has no requests-per-minute limit. A malicious user could burn through all 50 credits in seconds, hammering the Gemini API and potentially hitting Google's rate limits.

**Fix:** Add 10 messages/minute per user rate limit.

### 4.3 Make Turnstile Required in Production

**File:** `apps/web/app/api/scans/route.ts:21-34`
**Severity:** HIGH
**Finding:** Turnstile verification is skipped when `TURNSTILE_SECRET_KEY` is not set (the `if` condition at line 21). This makes sense in development but is a security gap if the env var is accidentally omitted in production.

**Current code:**
```typescript
if (process.env.TURNSTILE_SECRET_KEY && turnstileToken) {
  // ... verify
}
```

**Fixed code:**
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
  console.error('[scans] TURNSTILE_SECRET_KEY not set in production');
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}

if (process.env.TURNSTILE_SECRET_KEY) {
  if (!turnstileToken) {
    return NextResponse.json({ error: 'Security verification required' }, { status: 403 });
  }
  const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });
  const turnstileData = await turnstileRes.json();
  if (!turnstileData.success) {
    return NextResponse.json({ error: 'Security verification failed' }, { status: 403 });
  }
}
```

### 4.4 Fix Scan Rate Limit Bypass

**File:** `apps/web/app/api/scans/route.ts:52-57`
**Severity:** MEDIUM
**Finding:** The rate limit query excludes cached scans (`.is('cache_source', null)`). This means a user scanning the same domain repeatedly generates cached results without counting toward their limit. While cached scans are cheap, they still consume database writes (a new row in `scans` each time) and could be used for domain enumeration.

**Current code:**
```typescript
const { count } = await supabase
  .from('scans')
  .select('id', { count: 'exact', head: true })
  .eq(user ? 'user_id' : 'ip_address', user ? user.id : ip)
  .gte('created_at', dayStart.toISOString())
  .is('cache_source', null);
```

**Fixed code:**
```typescript
const { count } = await supabase
  .from('scans')
  .select('id', { count: 'exact', head: true })
  .eq(user ? 'user_id' : 'ip_address', user ? user.id : ip)
  .gte('created_at', dayStart.toISOString());
  // Count ALL scans — cached and fresh — to prevent abuse
```

### 4.5 In-Memory Rate Limiter Utility

**File to create:** `apps/web/lib/rate-limit.ts`

```typescript
/**
 * Lightweight in-memory rate limiter (no Redis dependency).
 * Suitable for single-instance Next.js deployments.
 * For multi-instance, replace with Redis-backed implementation.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of windows) {
    if (val.resetAt < now) windows.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
```

**Usage in chat endpoint:**
```typescript
import { rateLimit } from '@/lib/rate-limit';

// After auth check, before processing:
const rl = rateLimit(`chat:${user.id}`, 10, 60_000); // 10/min
if (!rl.allowed) {
  return NextResponse.json(
    { error: 'Too many messages. Please wait a moment.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
  );
}
```

---

## Section 5: Error Handling & Resilience (P1)

### 5.1 Replace Silent `.catch(() => {})` in Stripe Webhook

**File:** `apps/web/app/api/webhooks/stripe/route.ts:111`
**Severity:** MEDIUM
**Finding:** The email send call silently swallows all errors. If the email service is misconfigured, there's zero observability.

**Current code:**
```typescript
).catch(() => {}); // non-critical, don't fail webhook
```

**Fixed code:**
```typescript
).catch((err) => {
  console.error('[stripe-webhook] Failed to send receipt email:', err);
});
```

**Rationale:** Non-critical operations should still log errors for debugging. The webhook still returns 200.

### 5.2 Add Structured Error Logging to Email Send Endpoint

**File:** `apps/web/app/api/email/send/route.ts`
**Severity:** MEDIUM
**Finding:** If any `sendEmail()` call throws, the error propagates as an unhandled exception with no structured logging.

**Fix:** Wrap the switch block in try/catch:
```typescript
try {
  switch (template) {
    // ... existing cases
  }
} catch (err) {
  console.error(`[email/send] Failed to send template="${template}" to="${email}":`, err);
  return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
}
```

### 5.3 Add Try/Catch + Logging to SSE Stream Polling

**File:** `apps/web/app/api/scans/[id]/stream/route.ts:104-106`
**Severity:** MEDIUM
**Finding:** The polling interval's catch block at line 104 silently swallows Supabase query errors. If the database is down, the stream stays open doing nothing for up to 10 minutes.

**Current code:**
```typescript
} catch {
  // Supabase query error — skip this tick
}
```

**Fixed code:**
```typescript
} catch (err) {
  console.error(`[stream/${id}] Poll error:`, err);
  // After 3 consecutive failures, close the stream
  consecutiveErrors++;
  if (consecutiveErrors >= 3) {
    send({ type: 'error', scanId: id, error: 'Connection lost. Please refresh.' });
    clearInterval(interval);
    closed = true;
    controller.close();
  }
}
```

Add `let consecutiveErrors = 0;` alongside the existing state variables (line 13), and reset it to 0 on successful polls.

### 5.4 Chat Credit Rollback on AI Failure

**File:** `apps/web/app/api/chat/[scanId]/route.ts:148-168`
**Severity:** MEDIUM
**Finding:** When Gemini fails (catch block at line 148), the handler still saves a fallback message and decrements credits. The user is charged a credit for a non-answer. Additionally, the user message (line 92) is saved before the AI call — if the AI call fails and the user retries, duplicate user messages accumulate.

**Fixed approach:**
1. Move the user message save to AFTER the AI response succeeds
2. In the catch block, do NOT decrement credits and do NOT save the fallback as a message
3. Return a 503 error with a user-friendly message

```typescript
// Move message save + credit decrement into a transaction-like block:
try {
  // ... Gemini call ...
  assistantResponse = result.response.text();

  // Only save messages and decrement credits on success
  await Promise.all([
    supabase.from('chat_messages').insert({
      scan_id: scanId, user_id: user.id, role: 'user', content: parsed.data.message,
    }),
    supabase.from('chat_messages').insert({
      scan_id: scanId, user_id: user.id, role: 'assistant', content: assistantResponse,
    }),
    supabase.from('chat_credits').update({
      remaining: credits.remaining - 1, updated_at: new Date().toISOString(),
    }).eq('user_id', user.id),
  ]);
} catch (err) {
  console.error(`[chat/${scanId}] Gemini error:`, err);
  return NextResponse.json(
    { error: 'AI service temporarily unavailable. No credit was charged.' },
    { status: 503 },
  );
}
```

---

## Section 6: Module Testing & Edge Case Review (P1 Gate — Required Before P2)

> **STOP. Do not proceed to P2 until this section is complete.**
> This is a joint hands-on testing session between the engineer and the product owner.
> All P0 (Sections 1-2) and P1 (Sections 3-5) fixes must be implemented and committed before starting.

### 6.1 Purpose

The 46 engine modules, chart components, and API routes have been built in rapid succession across 5 PRD cycles. While unit-level correctness was verified during implementation, no end-to-end adversarial testing has been done — especially around edge cases that only surface with real-world inputs (malformed domains, sites behind WAFs, empty module results, expired tokens, race conditions in payment flows, etc.).

This section exists to catch those issues **before** they reach production users.

### 6.2 Scope

Test every user-facing flow after P0/P1 fixes are applied. Focus areas:

**A. Scan Creation & Execution**
- [ ] Anonymous peek scan — happy path (well-known domain like `stripe.com`)
- [ ] Anonymous peek scan — edge case: domain behind Cloudflare WAF (e.g., `cloudflare.com`)
- [ ] Anonymous peek scan — edge case: non-existent domain (e.g., `thisdomaindoesnotexist12345.com`)
- [ ] Anonymous peek scan — edge case: IP address instead of domain
- [ ] Anonymous peek scan — edge case: URL with path/query params (should extract domain)
- [ ] Authenticated full scan — verify all 46 modules run
- [ ] Cache hit — scan same domain twice within 24h, verify instant cached result
- [ ] Rate limit — exhaust daily limit (2 anon / 4 auth), verify 429 response
- [ ] Turnstile — verify challenge appears and blocks bots
- [ ] SSE stream — verify real-time progress updates, module-by-module

**B. Module Output Edge Cases**
- [ ] Modules with empty/null data — verify charts and report sections handle gracefully
- [ ] Modules that error — verify partial results display with fallback UI
- [ ] Score edge cases — 0/100, 100/100, null score
- [ ] M46 (knowledge base) — verify synthesis output is coherent for various site types

**C. Payment & Upgrade Flows**
- [ ] Checkout → Stripe → webhook → scan upgrade → synthesis → report ready (full cycle)
- [ ] Webhook idempotency — trigger same event twice, verify no double credits
- [ ] Checkout for a scan the user doesn't own — verify 404 (Section 2.2 fix)
- [ ] Checkout for a failed scan — verify rejection (Section 2.2 fix)
- [ ] Chat credits purchase — verify credits added, not replaced

**D. Report & PDF**
- [ ] Report renders for a completed paid scan
- [ ] All 26 chart components render with real data (no blank panels)
- [ ] PDF download — verify generation, download, and caching
- [ ] Share link — generate, open in incognito, verify report loads
- [ ] PDF via share token — verify shared users can download

**E. AI Chat**
- [ ] Send message on a paid scan — verify cited response
- [ ] Credit decrement — verify credits decrease by 1 per successful message
- [ ] AI failure (simulate by temporarily removing `GOOGLE_AI_API_KEY`) — verify 503, no credit charge
- [ ] Rate limit — send 11 messages in 1 minute, verify 429 on 11th
- [ ] Cross-user access — user A tries to chat on user B's scan — verify 404

**F. Auth & Email**
- [ ] Signup → verification email → confirm → redirect to dashboard
- [ ] Magic link login
- [ ] Password recovery flow
- [ ] Email unsubscribe link — verify token validation
- [ ] Scan completion email — verify it arrives with correct data

**G. Error Pages & Edge Cases**
- [ ] Navigate to `/nonexistent` — verify branded 404
- [ ] Navigate to `/scan/<invalid-uuid>` — verify graceful error
- [ ] Navigate to `/report/<valid-id>` without payment — verify paywall
- [ ] Trigger a server error (e.g., corrupt module data) — verify error boundary

**H. Security Verification (P0 Regression)**
- [ ] Stripe webhook processes correctly with `createServiceClient()` (Section 1.1)
- [ ] GET `/api/scans/[id]` rejects cross-user access (Section 1.2)
- [ ] `/api/email/send` rejects requests when `INTERNAL_API_SECRET` is unset (Section 1.3)
- [ ] Chat endpoint rejects cross-user scan access (Section 2.1)
- [ ] Upgrade endpoint rejects failed scans and cross-user claims (Section 2.3)

### 6.3 Process

1. Engineer spins up local dev environment (`npm run dev` for web + engine)
2. Walk through each checklist item together
3. For each failure: document the issue, file it inline, and fix before continuing
4. Any fix made during this phase gets a commit tagged `[test-fix]` for traceability
5. When all checkboxes pass: sign off and proceed to P2

### 6.4 Exit Criteria

- [ ] All checklist items in 6.2 pass
- [ ] Zero P0/P1 regressions
- [ ] Any new issues discovered are either fixed or documented as P2/P3 with justification
- [ ] Both engineer and product owner sign off

---

## Section 7: Missing Pages & UX (P2)

### 7.1 Dashboard Home Page

**File to create:** `apps/web/app/(dashboard)/page.tsx`
**Severity:** MEDIUM
**Finding:** Navigating to `/` while logged in shows the marketing landing page. There's no dashboard home route — the user must click "Scan History" to see their scans.

**Option A (Recommended):** Redirect authenticated users to `/history`:
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/history');
  redirect('/');
}
```

**Option B:** Build a dashboard home with recent scans + quick scan input. More effort, better UX — defer to v1.1.

### 7.2 Terms of Service Page

**File to create:** `apps/web/app/(marketing)/terms/page.tsx`

Static legal page. Content should cover:
- Service description and acceptable use
- Payment terms ($9.99 Alpha Brief, $4.99 chat credits, no refund policy)
- Data processing: scans are automated, results are cached 24h
- Account deletion (existing feature)
- Limitation of liability

### 7.3 Privacy Policy Page

**File to create:** `apps/web/app/(marketing)/privacy/page.tsx`

Static legal page. Content should cover:
- Data collected: email, IP address, country code, scan URLs
- Third-party processors: Supabase, Stripe, Resend, PostHog, Google Gemini, DataForSEO, Cloudflare
- Email communications (transactional + opt-in marketing)
- Cookie usage (PostHog analytics, Supabase auth)
- Data retention: scans stored indefinitely, email logs 90 days, audit logs indefinitely
- GDPR/CCPA rights: account deletion available in dashboard
- Geo-blocking disclosure (13 countries)

---

## Section 8: Observability & Monitoring (P2)

### 8.1 PostHog Server-Side Event Capture

**Files to modify:** Multiple API routes
**Severity:** MEDIUM
**Finding:** PostHog is configured for client-side analytics but no server-side events are captured. Key business events (scan creation, payment, chat usage, errors) should be tracked server-side for reliability.

**Implementation:**

Create `apps/web/lib/posthog-server.ts`:
```typescript
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
```

**Events to capture:**
| Event | Route | Properties |
|-------|-------|------------|
| `scan_created` | `/api/scans` POST | `domain`, `tier`, `cached` |
| `payment_initiated` | `/api/checkout` POST | `product`, `scanId` |
| `payment_completed` | `/api/webhooks/stripe` POST | `product`, `amount` |
| `chat_message_sent` | `/api/chat/[scanId]` POST | `scanId`, `creditsRemaining` |
| `pdf_downloaded` | `/api/reports/[id]/pdf` GET | `scanId` |
| `report_shared` | `/api/reports/[id]/share` POST | `scanId` |
| `api_error` | All routes (in catch blocks) | `route`, `error`, `statusCode` |

### 8.2 Health Check Monitoring

**File to create:** `apps/web/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
  });
}
```

**External monitoring:** Configure Uptime Robot (or Better Stack / Checkly) to poll:
- `https://marketingalphascan.com/api/health` (web)
- `https://engine.marketingalphascan.com/health` (engine — already exists)
- Alert via Slack / email on downtime

### 8.3 Replace Silent Audit Log Swallows

**File:** `apps/web/app/api/scans/route.ts:141`

**Current code:**
```typescript
}).then(() => {}, () => {}); // non-critical
```

**Fixed code:**
```typescript
}).catch((err) => {
  console.error('[scans] Audit log failed:', err);
});
```

---

## Section 9: Data Integrity (P2)

### 9.1 Migration Idempotency

**Files:** `supabase/migrations/001_scans.sql` through `005_audit_log.sql`
**Severity:** MEDIUM
**Finding:** Migrations 001-005 use bare `CREATE TABLE` and `CREATE INDEX` statements without `IF NOT EXISTS`. Re-running these migrations (e.g., during a Supabase project reset or if the migration tracking table is lost) will fail with "already exists" errors. Migrations 006 and 007 already use `IF NOT EXISTS` correctly.

**Fix for each migration:**

**`001_scans.sql`:** Prefix with `CREATE TABLE IF NOT EXISTS scans (...)`, `CREATE INDEX IF NOT EXISTS idx_scans_user ...`, etc. For RLS policies, wrap in `DO $$ ... END $$` blocks with existence checks.

**`002_module_results.sql`:** Same pattern.

**`003_payments.sql`:** Same pattern.

**`004_chat.sql`:** Same pattern.

**`005_audit_log.sql`:** Same pattern.

**Template for policy idempotency:**
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Users see own scans" ON scans
      FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;
```

### 9.2 Chat Credit Idempotency

**File:** `apps/web/app/api/webhooks/stripe/route.ts:67-73` and `88-100`
**Severity:** MEDIUM
**Finding:** Stripe may send duplicate `checkout.session.completed` events. The credit upsert for `alpha_brief` always sets `remaining: 50` (idempotent), but `chat_credits` adds 100 to the current balance (line 98: `remaining: current + 100`). A duplicate event would grant 200 credits.

**Fix:** Use the `payments` table as a dedup key. Before processing credits, check if this session was already handled:
```typescript
// After the payment status update:
const { data: payment } = await supabase
  .from('payments')
  .select('status')
  .eq('stripe_session_id', session.id)
  .single();

// If already completed, this is a duplicate — skip
if (payment?.status === 'completed') {
  return NextResponse.json({ received: true });
}

// Now update payment status and process...
```

Actually, since the `update` runs first (line 52-58), use a conditional approach: update with a WHERE clause that only matches `status = 'pending'`, and check the returned count.

---

## Section 10: Configuration Hygiene (P2)

### 10.1 Audit Hardcoded URLs

**Finding:** Multiple files use `'https://marketingalphascan.com'` as a fallback:
- `apps/web/app/api/email/send/route.ts:41`
- `apps/web/app/api/auth/send-email/route.ts:38`
- `apps/web/app/api/reports/[id]/share/route.ts:30`

All three use the pattern `process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com'` — this is correct as a fallback. However, `NEXT_PUBLIC_SITE_URL` is not in `.env.example`. Add it.

**Action:** Add `NEXT_PUBLIC_SITE_URL` to `.env.example` with a comment that it must be set in production.

### 10.2 Update `.env.example`

**Current `.env.example` is missing:**
- `INTERNAL_API_SECRET` — used by `/api/email/send` for internal auth
- `UNSUBSCRIBE_JWT_SECRET` — used by email unsubscribe link verification
- `SUPABASE_SERVICE_ROLE_KEY` — used by `createServiceClient()` (web side)
- `SUPABASE_SEND_EMAIL_HOOK_SECRET` — used by `/api/auth/send-email`
- `RESEND_WEBHOOK_SECRET` — used by `/api/webhooks/resend`
- `NEXT_PUBLIC_SITE_URL` — used for email links and share URLs
- `NEXT_PUBLIC_APP_VERSION` — optional, used in health check

**Updated `.env.example` additions:**
```bash
# Internal API authentication
INTERNAL_API_SECRET=replace-with-64-char-hex-secret

# JWT secret for email unsubscribe tokens
UNSUBSCRIBE_JWT_SECRET=replace-with-32-char-secret

# Supabase service role key (bypasses RLS — web API routes + webhooks)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Supabase Send Email Hook (HMAC signature verification)
SUPABASE_SEND_EMAIL_HOOK_SECRET=v1,whsec_...

# Resend webhook signature verification
RESEND_WEBHOOK_SECRET=whsec_...

# Canonical site URL (used in emails, share links, OG tags)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 10.3 Create `.env.production.example`

**File to create:** `.env.production.example`

A production-specific guide with notes about each variable:

```bash
# =============================================
# MarketingAlphaScan — PRODUCTION Environment
# =============================================
# IMPORTANT: All variables marked [REQUIRED] must be set before deployment.
# Generate secrets with: openssl rand -hex 32

# === WEB (apps/web) ===

# [REQUIRED] Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# [REQUIRED] Site URL — must match your production domain
NEXT_PUBLIC_SITE_URL=https://marketingalphascan.com

# [REQUIRED] Engine communication
ENGINE_URL=https://engine.marketingalphascan.com
ENGINE_HMAC_SECRET=<openssl rand -hex 32>

# [REQUIRED] Stripe (LIVE keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_ALPHA_BRIEF_PRICE_ID=price_...
STRIPE_CHAT_CREDITS_PRICE_ID=price_...

# [REQUIRED] Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...

# [REQUIRED] Google Gemini AI
GOOGLE_AI_API_KEY=AI...

# [REQUIRED] Resend (verified domain)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@marketingalphascan.com
RESEND_WEBHOOK_SECRET=whsec_...

# [REQUIRED] Internal secrets
INTERNAL_API_SECRET=<openssl rand -hex 32>
UNSUBSCRIBE_JWT_SECRET=<openssl rand -hex 16>
SUPABASE_SEND_EMAIL_HOOK_SECRET=v1,whsec_...

# [REQUIRED] PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=/ingest

# [OPTIONAL] App version (set during CI/CD build)
NEXT_PUBLIC_APP_VERSION=1.0.0

# === ENGINE (apps/engine) ===

# [REQUIRED]
PORT=3001
ENGINE_HMAC_SECRET=<same as web>
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://...
GOOGLE_AI_API_KEY=AI...
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...

# [REQUIRED] PostHog (server-side)
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://us.i.posthog.com

# [REQUIRED] Admin
ADMIN_TOKEN=<openssl rand -hex 32>
```

---

## Section 11: Launch Checklist

### Pre-Deployment Checklist

- [ ] **Environment variables**: All `[REQUIRED]` vars from `.env.production.example` are set
- [ ] **Stripe**: Switch from test keys (`sk_test_`) to live keys (`sk_live_`). Create live Price IDs for Alpha Brief ($9.99) and Chat Credits ($4.99). Add production webhook endpoint URL.
- [ ] **Supabase**: Service role key is set in web and engine environments
- [ ] **DNS**: `marketingalphascan.com` → web deployment. `engine.marketingalphascan.com` → engine deployment.
- [ ] **Resend**: Production sending domain verified (`marketingalphascan.com`). DKIM, SPF, DMARC records added.
- [ ] **Cloudflare**: Turnstile site key configured for production domain. Geo-blocking rules in Cloudflare firewall (backup to app-level).
- [ ] **Supabase Send Email Hook**: Configured in Supabase dashboard → Authentication → Hooks → Send Email → point to `https://marketingalphascan.com/api/auth/send-email`
- [ ] **PostHog**: Project created, `phc_` key ready, reverse proxy configured at `/ingest`
- [ ] **Security fixes**: All P0 items (Sections 1-2) merged and verified
- [ ] **Module testing gate**: Section 6 checklist fully passed and signed off
- [ ] **Error pages**: `error.tsx` and `not-found.tsx` deployed
- [ ] **Legal pages**: Terms of Service and Privacy Policy reviewed and deployed
- [ ] **INTERNAL_API_SECRET**: Generated and set in both deployment environments
- [ ] **Supabase Storage**: `reports` bucket created for PDF storage

### Deployment Sequence

**Order matters — deploy in this exact sequence:**

1. **Database migrations**
   ```bash
   supabase db push
   ```
   Verify all 7 migrations succeed. If idempotency fixes (Section 9.1) are applied, migrations can be safely re-run.

2. **Engine deploy**
   ```bash
   docker build -t marketingalphascan-engine ./apps/engine
   # Deploy to Railway / Fly.io / ECS
   ```
   Verify health: `curl https://engine.marketingalphascan.com/health`

3. **Web deploy**
   ```bash
   # If Vercel:
   vercel --prod
   # If Docker:
   docker build -t marketingalphascan-web ./apps/web
   ```
   Verify health: `curl https://marketingalphascan.com/api/health`

4. **Post-deploy verification** (see next section)

### Post-Deployment Verification

Run these checks immediately after deployment:

1. **Smoke test — anonymous scan:**
   - Visit `https://marketingalphascan.com`
   - Enter a test domain (e.g., `example.com`)
   - Verify Turnstile challenge appears
   - Verify scan starts and SSE stream shows progress
   - Verify scan completes with score

2. **Auth flow:**
   - Sign up with a test email
   - Verify verification email arrives (via Resend → custom template)
   - Verify login redirects to dashboard

3. **Payment flow:**
   - Trigger a scan as authenticated user
   - Click "Upgrade to Alpha Brief"
   - Complete Stripe checkout with test card `4242 4242 4242 4242`
   - Verify webhook fires (check Stripe dashboard → Webhooks → Events)
   - Verify scan tier updates to `paid`
   - Verify 50 chat credits granted

4. **PDF download:**
   - On a completed paid scan, click "Download PDF"
   - Verify PDF generates and downloads

5. **AI Chat:**
   - On a paid scan, open chat
   - Send a test message
   - Verify response with source citations

6. **Error pages:**
   - Visit `/nonexistent-page` — verify 404 page
   - Visit `/scan/00000000-0000-0000-0000-000000000000` — verify graceful error

7. **Rate limiting:**
   - Exceed daily scan limit (2 for anon, 4 for auth) — verify 429 response

8. **Share flow:**
   - Generate share link for a paid report
   - Open in incognito — verify report loads without auth

### Rollback Procedures

**Web rollback:**
```bash
# Vercel: instant rollback to previous deployment
vercel rollback

# Docker: re-deploy previous image tag
docker pull marketingalphascan-web:previous
```

**Engine rollback:**
```bash
# Same approach — re-deploy previous image
docker pull marketingalphascan-engine:previous
```

**Database rollback:**
- Supabase Point-in-Time Recovery (PITR) if on Pro plan
- Otherwise: manual rollback SQL scripts for each migration
- **IMPORTANT:** Never rollback database without also rolling back the application

**Partial rollback matrix:**

| Issue | Rollback scope |
|-------|---------------|
| Web UI broken | Rollback web only |
| Engine crash | Rollback engine only |
| Payment bug | Disable Stripe webhook endpoint in dashboard → investigate |
| Database corruption | PITR restore → rollback both web + engine |

### Monitoring Dashboard Setup

**Uptime Robot (Free tier):**
1. HTTP monitor: `https://marketingalphascan.com/api/health` — 5 min interval
2. HTTP monitor: `https://engine.marketingalphascan.com/health` — 5 min interval
3. Alert contacts: email + Slack webhook

**PostHog dashboard — "Launch Metrics":**
- Funnel: Landing → Scan Started → Scan Complete → Upgrade → Chat
- Key metrics: daily scans, conversion rate (free → paid), chat usage
- Error tracking: `api_error` events grouped by route

**Stripe dashboard:**
- Monitor successful payments vs. failures
- Watch for dispute rate (keep under 0.75%)

---

## Appendix A: Complete File Change Manifest

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `apps/web/app/api/webhooks/stripe/route.ts` | MODIFY | Replace `createAdminClient()` with `createServiceClient()`, add error logging to `.catch()`, add dedup check for credits |
| 2 | `apps/web/app/api/scans/[id]/route.ts` | MODIFY | Add auth check, ownership verification, strip PII from response |
| 3 | `apps/web/app/api/email/send/route.ts` | MODIFY | Add null check on `INTERNAL_API_SECRET`, wrap in try/catch |
| 4 | `apps/web/app/error.tsx` | CREATE | Root error boundary |
| 5 | `apps/web/app/not-found.tsx` | CREATE | Root 404 page |
| 6 | `apps/web/app/(dashboard)/error.tsx` | CREATE | Dashboard error boundary |
| 7 | `apps/web/app/api/chat/[scanId]/route.ts` | MODIFY | Add `user_id` to scan select, verify ownership, fix credit rollback on AI failure, add rate limit |
| 8 | `apps/web/app/api/checkout/route.ts` | MODIFY | Add scan ownership check, reject failed/upgraded scans |
| 9 | `apps/web/app/api/scans/[id]/upgrade/route.ts` | MODIFY | Reject failed/cancelled scans, add ownership check |
| 10 | `apps/web/app/api/reports/[id]/pdf/route.ts` | CREATE | PDF download endpoint with auth + share token support |
| 11 | `apps/web/components/report/report-top-bar.tsx` | MODIFY | Replace `window.print()` with PDF endpoint link |
| 12 | `apps/web/app/api/scans/route.ts` | MODIFY | Fix Turnstile enforcement in production, fix rate limit bypass, add error logging for audit |
| 13 | `apps/web/lib/rate-limit.ts` | CREATE | In-memory rate limiter utility |
| 14 | `apps/web/app/api/scans/[id]/stream/route.ts` | MODIFY | Add error logging and consecutive failure detection |
| 15 | `apps/web/app/(dashboard)/page.tsx` | CREATE | Dashboard home — redirect to /history |
| 16 | `apps/web/app/(marketing)/terms/page.tsx` | CREATE | Terms of Service |
| 17 | `apps/web/app/(marketing)/privacy/page.tsx` | CREATE | Privacy Policy |
| 18 | `apps/web/lib/posthog-server.ts` | CREATE | Server-side PostHog client |
| 19 | `apps/web/app/api/health/route.ts` | CREATE | Health check endpoint |
| 20 | `supabase/migrations/001_scans.sql` | MODIFY | Add `IF NOT EXISTS` guards |
| 21 | `supabase/migrations/002_module_results.sql` | MODIFY | Add `IF NOT EXISTS` guards |
| 22 | `supabase/migrations/003_payments.sql` | MODIFY | Add `IF NOT EXISTS` guards |
| 23 | `supabase/migrations/004_chat.sql` | MODIFY | Add `IF NOT EXISTS` guards |
| 24 | `supabase/migrations/005_audit_log.sql` | MODIFY | Add `IF NOT EXISTS` guards |
| 25 | `.env.example` | MODIFY | Add missing variables |
| 26 | `.env.production.example` | CREATE | Production env var guide |

**Total: 16 files modified, 10 files created = 26 file operations**

---

## Appendix B: Environment Variables Master List

### Web (`apps/web/.env.local` / `.env.production`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe to expose) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (bypasses RLS) | `eyJ...` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical site URL for emails/share links | `https://marketingalphascan.com` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (legacy, alias for SITE_URL) | `https://marketingalphascan.com` |
| `ENGINE_URL` | Yes | Engine API base URL | `https://engine.marketingalphascan.com` |
| `ENGINE_HMAC_SECRET` | Yes | HMAC secret for engine auth (shared with engine) | 64-char hex |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (safe to expose) | `pk_live_...` |
| `STRIPE_ALPHA_BRIEF_PRICE_ID` | Yes | Stripe Price ID for Alpha Brief ($9.99) | `price_...` |
| `STRIPE_CHAT_CREDITS_PRICE_ID` | Yes | Stripe Price ID for Chat Credits ($4.99) | `price_...` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile site key | `0x...` |
| `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile secret key | `0x...` |
| `GOOGLE_AI_API_KEY` | Yes | Google Gemini API key (for AI chat) | `AI...` |
| `RESEND_API_KEY` | Yes | Resend email API key | `re_...` |
| `RESEND_FROM_EMAIL` | Yes | Verified sender email address | `noreply@marketingalphascan.com` |
| `RESEND_WEBHOOK_SECRET` | Yes | Resend/Svix webhook secret | `whsec_...` |
| `INTERNAL_API_SECRET` | Yes | Secret for internal API auth (email trigger) | 64-char hex |
| `UNSUBSCRIBE_JWT_SECRET` | Yes | JWT secret for email unsubscribe tokens | 32-char hex |
| `SUPABASE_SEND_EMAIL_HOOK_SECRET` | Yes | HMAC secret for Supabase email hook | `v1,whsec_...` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Yes | PostHog project API key | `phc_...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Yes | PostHog ingest proxy path | `/ingest` |
| `NEXT_PUBLIC_APP_VERSION` | No | App version (set in CI/CD) | `1.0.0` |

### Engine (`apps/engine/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | HTTP server port | `3001` |
| `ENGINE_HMAC_SECRET` | Yes | HMAC secret for auth (same as web) | 64-char hex |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key | `eyJ...` |
| `REDIS_URL` | Yes | Redis connection URL (BullMQ) | `redis://...` |
| `GOOGLE_AI_API_KEY` | Yes | Google Gemini API key | `AI...` |
| `DATAFORSEO_LOGIN` | Yes | DataForSEO account login | `your-login` |
| `DATAFORSEO_PASSWORD` | Yes | DataForSEO account password | `your-password` |
| `POSTHOG_API_KEY` | Yes | PostHog project API key (server) | `phc_...` |
| `POSTHOG_HOST` | Yes | PostHog API host | `https://us.i.posthog.com` |
| `ADMIN_TOKEN` | Yes | Admin API authentication token | 64-char hex |

---

*End of PRD-cont-6. Execute sections in priority order: P0 (Sections 1-2) → P1 (Sections 3-5) → Testing Gate (Section 6) → P2 (Sections 7-10). Section 11 (Launch Checklist) runs after all fixes are deployed.*
