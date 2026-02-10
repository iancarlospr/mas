# MarketingAlphaScan — Email System & Lifecycle Specification

---

## Section 1: Email Infrastructure Setup

### Sender Identity

| Role | Address | Purpose |
|------|---------|---------|
| Envelope Sender (Return-Path / Bounce) | `send.marketingalphascan.com` | Subdomain used for bounce handling and SPF/DKIM alignment |
| From | `alpha@marketingalphascan.com` | Display sender on all outbound emails |
| Reply-To | `support@marketingalphascan.com` | Human-monitored inbox for customer replies |

### DNS Records in Cloudflare

All four records must be configured in the Cloudflare dashboard under the `marketingalphascan.com` zone.

| # | Type | Name | Value | Proxy | TTL | Notes |
|---|------|------|-------|-------|-----|-------|
| 1 | MX | `send.marketingalphascan.com` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) | OFF (grey cloud) | Auto | Resend routes through AWS SES; MX records must never be proxied |
| 2 | TXT | `send.marketingalphascan.com` | `v=spf1 include:amazonses.com ~all` | N/A (TXT never proxied) | Auto | Authorizes SES to send on behalf of the subdomain |
| 3 | TXT | `resend._domainkey.marketingalphascan.com` | *(~256-char DKIM public key from Resend dashboard)* | N/A | Auto | DKIM signing key; copy exact value from Resend domain verification page |
| 4 | TXT | `_dmarc.marketingalphascan.com` | `v=DMARC1; p=none; rua=mailto:dmarc@marketingalphascan.com; pct=100; adkim=s; aspf=s` | N/A | Auto | Strict alignment for both DKIM and SPF; aggregate reports sent to dmarc@ |

**Cloudflare notes:**
- MX records **must** have proxy OFF (grey cloud icon). Proxied MX records break mail delivery.
- TXT records are never proxied by Cloudflare regardless of the toggle.
- Propagation typically takes 5-30 minutes within Cloudflare's network, but external resolvers may cache for up to the previous TTL.

### Deliverability Warmup Plan

| Week | Daily Volume Cap | Cumulative Goal | Notes |
|------|-----------------|-----------------|-------|
| Week 1 | < 50/day | Build initial reputation | Send only auth + welcome emails |
| Week 2 | < 200/day | Establish pattern | Add scan notification emails |
| Week 3 | < 500/day | Expand | Add all transactional templates |
| Week 4+ | Unrestricted | Maintain | Monitor metrics below |

**Ongoing thresholds:**
- Bounce rate: keep below **2%** (hard bounces)
- Spam complaint rate: keep below **0.1%** (1 per 1,000 emails)
- If either threshold is exceeded, pause non-critical emails and investigate immediately.

### Resend Setup Steps

1. **Create account** at resend.com (free tier: 3,000 emails/month)
2. **Add domain**: Settings > Domains > Add Domain > enter `marketingalphascan.com`
3. **Add DNS records**: Copy the 4 records shown by Resend into Cloudflare (as detailed above)
4. **Verify domain**: Click "Verify DNS" in Resend dashboard; wait for all records to show green
5. **Create API key**: Settings > API Keys > Create API Key > name it `production` > copy the `re_` prefixed key
6. **Test send**: Use Resend dashboard "Send Test Email" or the API to send a test to a personal address; confirm delivery and check SPF/DKIM/DMARC pass in email headers

### DMARC Graduation Schedule

| Phase | Weeks | Policy | Purpose |
|-------|-------|--------|---------|
| Monitor | 1-4 | `p=none` | Collect aggregate reports, identify any alignment failures, no emails rejected |
| Quarantine | 5-12 | `p=quarantine` | Failing emails sent to spam; validates that all legitimate sends pass |
| Reject | 13+ | `p=reject` | Full protection; unauthorized senders are rejected outright |

Update the DMARC TXT record in Cloudflare at each phase transition. Review `rua` aggregate reports (sent to `dmarc@marketingalphascan.com`) weekly during the first 12 weeks.

---

## Section 2: Transactional Email Templates

All templates share the following defaults unless otherwise noted:
- **From:** `MarketingAlphaScan <alpha@marketingalphascan.com>`
- **Reply-To:** `support@marketingalphascan.com`

---

### Template 1: Email Verification

| Field | Value |
|-------|-------|
| **Trigger** | Supabase `auth.signup` Send Email Hook (`email_action_type: 'signup'`) |
| **Subject** | `Verify your email to unlock Full Scan access` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | None (critical auth flow) |

**TypeScript data interface:**
```typescript
interface VerificationEmailData {
  email: string;
  confirmationUrl: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Confirm your email" |
| Body | Short paragraph: "Click the button below to verify your email and unlock Full Scan access — our comprehensive 45-module marketing technology audit." |
| CTA | Large button: **"Verify Email"** (links to `confirmationUrl`) |
| Note | "This link expires in 24 hours. If you didn't create an account, you can safely ignore this email." |
| Footer | Standard footer (no unsubscribe — transactional) |

---

### Template 2: Magic Link Login

| Field | Value |
|-------|-------|
| **Trigger** | Supabase `auth.magiclink` Send Email Hook (`email_action_type: 'magiclink'`) |
| **Subject** | `Your login link for MarketingAlphaScan` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | None (critical auth flow) |

**TypeScript data interface:**
```typescript
interface MagicLinkEmailData {
  email: string;
  magicLinkUrl: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Sign in to MarketingAlphaScan" |
| Body | "Click the button below to sign in to your account." |
| CTA | Large button: **"Sign In"** (links to `magicLinkUrl`) |
| Note | "This link expires in 10 minutes." |
| Safety | "If you didn't request this login link, you can safely ignore this email. Your account is secure." |
| Footer | Standard footer |

---

### Template 3: Welcome Email

| Field | Value |
|-------|-------|
| **Trigger** | After `email_confirmed_at` is set in Supabase (app logic, not hook) |
| **Subject** | `Welcome to MarketingAlphaScan — run your first Full Scan` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Delay** | 30 seconds after email verification |
| **Suppression** | 1 per user lifetime |

**TypeScript data interface:**
```typescript
interface WelcomeEmailData {
  email: string;
  scanUrl: string;
}
```

**Full draft copy:**

```
Welcome to MarketingAlphaScan

Your email is verified. You now have access to Full Scan — our comprehensive
45-module marketing technology audit.

What Full Scan reveals:
  - Every analytics tool, ad pixel, and MarTech platform on any website
  - Core Web Vitals, performance bottlenecks, and mobile readiness
  - Compliance gaps (GDPR, CCPA, PCI DSS) with specific remediation steps
  - AI-powered insights with actionable recommendations

Your MarketingIQ score benchmarks the site against 250+ checkpoints
across 8 categories.

[Run Your First Full Scan ->]  (CTA button linking to homepage with autofocus on URL input)

Have questions? Reply to this email — a human reads every message.

— The MarketingAlphaScan Team
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Welcome to MarketingAlphaScan" |
| Body | Verification confirmation + Full Scan description |
| Feature List | 4 bullet points (analytics, performance, compliance, AI insights) |
| Score Note | MarketingIQ benchmarking explanation |
| CTA | Large button: **"Run Your First Full Scan"** (links to `scanUrl`) |
| Sign-off | Human reply encouragement + team signature |
| Footer | Standard footer |

---

### Template 4: Scan Started

| Field | Value |
|-------|-------|
| **Trigger** | Scan status changes to `'passive'` (app logic: engine -> Supabase -> app) |
| **Subject** | `Scanning {{targetDomain}} — results in ~3 minutes` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | Suppress if user has active SSE connection to scan progress page; max 3/user/hour |

**TypeScript data interface:**
```typescript
interface ScanStartedEmailData {
  targetDomain: string;
  scanId: string;
  scanUrl: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Your scan is underway" |
| Domain | `{{targetDomain}}` displayed prominently (large, bold, JetBrains Mono) |
| Progress | Static progress bar graphic showing Phase 1 (Passive Recon) active |
| Body | "We're running 45 modules across analytics, performance, compliance, and more. Results typically arrive in about 3 minutes." |
| CTA | Large button: **"Watch Live Progress"** (links to `scanUrl`) |
| Footer | Standard footer |

---

### Template 5: Scan Complete

| Field | Value |
|-------|-------|
| **Trigger** | Scan status changes to `'complete'` (app logic) |
| **Subject** | `{{targetDomain}} scored {{marketingIQ}}/100 — your Full Scan is ready` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | 1 per scan; suppress if user viewed dashboard within last 5 minutes |

**TypeScript data interface:**
```typescript
interface ScanCompleteEmailData {
  targetDomain: string;
  scanId: string;
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: Array<{
    name: string;
    score: number;
    light: 'green' | 'yellow' | 'red';
  }>;
  topFinding: string;
  scanUrl: string;
  reportUrl: string;
}
```

**Full draft copy:**

```
Your Full Scan results are ready

{{targetDomain}}
MarketingIQ: {{marketingIQ}}/100 — {{marketingIQLabel}}

[Score gauge graphic]

Category Breakdown:
  [green]  Analytics & Data: 78/100
  [yellow] Paid Media: 54/100
  [green]  Performance: 82/100
  [red]    Compliance: 31/100
  ... (all 8 categories with traffic lights)

Top Finding:
"{{topFinding}}"

[View Full Dashboard ->]

---

Unlock the Executive Report

Get the Alpha Brief — a McKinsey-style deep dive with:
  [check] ROI impact analysis with dollar estimates
  [check] Prioritized remediation roadmap
  [check] Downloadable PDF report
  [check] 50 AI Chat messages to explore findings

~~$29.99~~ $9.99 — Launch Price

[Get Alpha Brief ->]

— The MarketingAlphaScan Team
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Your Full Scan results are ready" |
| Domain | `{{targetDomain}}` displayed prominently |
| Score | MarketingIQ score gauge graphic with numerical score and label |
| Categories | 8 rows, each with traffic light dot (green/yellow/red), category name, score |
| Top Finding | Blockquote with the AI-generated top finding |
| CTA Primary | Large button: **"View Full Dashboard"** (links to `scanUrl`) |
| Divider | Horizontal rule separator |
| Upsell Heading | "Unlock the Executive Report" |
| Upsell Body | Alpha Brief feature list with checkmarks |
| Upsell Price | Strikethrough $29.99, bold $9.99 launch price |
| CTA Secondary | Button: **"Get Alpha Brief"** (links to `reportUrl`) |
| Sign-off | Team signature |
| Footer | Standard footer |

---

### Template 6: Payment Receipt

| Field | Value |
|-------|-------|
| **Trigger** | Stripe webhook `checkout.session.completed` |
| **Subject** | `Receipt: {{productName}} — MarketingAlphaScan` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | None (legally required) |

**TypeScript data interface:**
```typescript
interface PaymentReceiptEmailData {
  productName: string;
  amount: string;
  currency: string;
  receiptDate: string;
  stripeReceiptUrl: string;
  scanUrl?: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Payment confirmed" |
| Receipt Table | Product name, Amount (formatted with currency), Date, Payment method (last 4 digits) |
| CTA Primary | Button: **"View Receipt on Stripe"** (links to `stripeReceiptUrl`) |
| Conditional | If Alpha Brief purchase: "Your report is being generated and will be ready shortly." |
| CTA Secondary | If `scanUrl` provided: **"View Scan Dashboard"** link |
| Footer | Standard footer |

---

### Template 7: Report Ready

| Field | Value |
|-------|-------|
| **Trigger** | M42-M46 synthesis complete for paid scan |
| **Subject** | `Your Alpha Brief for {{targetDomain}} is ready` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | 1 per scan |

**TypeScript data interface:**
```typescript
interface ReportReadyEmailData {
  targetDomain: string;
  reportUrl: string;
  pdfUrl: string;
  chatUrl: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Your Alpha Brief is ready" |
| Domain | `{{targetDomain}}` displayed prominently |
| CTA Primary | Large button: **"View Report"** (links to `reportUrl`) |
| PDF Link | Secondary text link: "Download PDF" (links to `pdfUrl`) |
| Chat Note | "You also have 50 AI Chat messages to explore your findings in depth." |
| CTA Secondary | Button: **"Start Chat"** (links to `chatUrl`) |
| Footer | Standard footer |

---

### Template 8: Scan Failed

| Field | Value |
|-------|-------|
| **Trigger** | Scan status changes to `'failed'` after all retries exhausted |
| **Subject** | `Scan could not complete for {{targetDomain}}` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | 1 per scan |

**TypeScript data interface:**
```typescript
interface ScanFailedEmailData {
  targetDomain: string;
  failureReason: 'unreachable' | 'blocked' | 'timeout' | 'error';
  scanUrl: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "We hit a snag" |
| Domain | `{{targetDomain}}` displayed prominently |
| Reason | Reason-specific message (see below) |
| CTA | Button: **"Try Again"** (links to `scanUrl`) |
| Reassurance | "This scan doesn't count against your daily limit." |
| Footer | Standard footer |

**Failure reason messages:**

| Reason | Message |
|--------|---------|
| `unreachable` | "The site appears to be down or unreachable. It may be experiencing an outage — try again later." |
| `blocked` | "The site is actively blocking automated requests. Some sites use aggressive bot protection that prevents scanning." |
| `timeout` | "The scan took too long to complete. This usually happens with very large or slow-loading sites." |
| `error` | "An unexpected error occurred during the scan. Our team has been notified and is looking into it." |

---

### Template 9: Account Deletion

| Field | Value |
|-------|-------|
| **Trigger** | Account deletion completed (GDPR erasure) |
| **Subject** | `Your MarketingAlphaScan account has been deleted` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | None — but this is the final email ever sent to this address |

**TypeScript data interface:**
```typescript
interface AccountDeletionEmailData {
  email: string;
  deletionDate: string;
}
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Heading | "Account deleted" |
| Body | "All your data has been permanently removed, including scan results, chat history, and payment records. Stripe retains its own records per their privacy policy." |
| Sign-off | "We're sorry to see you go." |
| CTA | **None** (intentional — no reason to drive the user back) |
| Footer | Standard footer |

---

### Template 10: Re-engagement

| Field | Value |
|-------|-------|
| **Trigger** | Cron job, 7 days after `email_confirmed_at` with zero completed scans |
| **Subject** | `Your first scan is waiting — pick any URL` |
| **From** | `alpha@marketingalphascan.com` |
| **Reply-To** | `support@marketingalphascan.com` |
| **Suppression** | Max 1 per user LIFETIME; only for users with `marketing_opt_in=true`; `List-Unsubscribe` header required |

> **This is the ONLY marketing email. All other templates (1-9) are transactional.**

**TypeScript data interface:**
```typescript
interface ReEngagementEmailData {
  email: string;
  firstName?: string;
  scanUrl: string;
  unsubscribeUrl: string;
}
```

**Full draft copy:**

```
{{firstName || "Hey"}},

You verified your email a week ago but haven't run a scan yet.

Here's what you're missing: paste any URL and in 3 minutes you'll see
exactly what marketing technology they're running — every analytics tool,
ad pixel, consent configuration, and performance metric.

Try scanning a competitor. Or your own site. The results might surprise you.

[Scan Any URL ->]

Popular first scans:
  - Your company's website
  - Your top competitor
  - A brand you admire (try hubspot.com or stripe.com)

— The MarketingAlphaScan Team

---
You're receiving this because you signed up for MarketingAlphaScan.
[Unsubscribe] | MarketingAlphaScan, [Physical Address]
```

**Content structure:**

| Section | Content |
|---------|---------|
| Header | Logo (white variant on #1A1A2E background) |
| Greeting | Personalized: `{{firstName}}` or fallback "Hey" |
| Body | Reminder + value proposition (what they will discover) |
| CTA | Large button: **"Scan Any URL"** (links to `scanUrl`) |
| Suggestions | Bulleted list of popular first scan ideas |
| Sign-off | Team signature |
| Divider | Horizontal rule |
| Compliance Footer | "You're receiving this because you signed up..." + Unsubscribe link + Physical address |
| Footer | Standard footer with unsubscribe |

---

## Section 3: Email Timing & Lifecycle Triggers

### Lifecycle State Diagram

```
Anonymous Visitor
  |
  |-- URL Submit (Peek scan) --- no email
  |
  +-- Register --> Unverified User
                      |
                      |-- Email Verification sent (Template 1)
                      |
                      +-- Clicks verify --> Verified User
                                              |
                                              |-- Welcome Email (Template 3, 30s delay)
                                              |
                                              |-- First Full Scan --> Active User
                                              |     |-- Scan Started (Template 4)
                                              |     |-- Scan Complete (Template 5)
                                              |     +-- Scan Failed (Template 8, if applicable)
                                              |
                                              |-- No scan after 7 days --> Re-engagement (Template 10)
                                              |
                                              |-- Pays for Alpha Brief --> Paid User
                                              |     |-- Payment Receipt (Template 6)
                                              |     +-- Report Ready (Template 7)
                                              |
                                              +-- Deletes Account --> Account Deletion (Template 9)

OAuth Users:
  Google/Apple OAuth --> Verified User (skip Template 1, go straight to Template 3)
```

### Trigger Event Mapping

| # | Template | Event | Source | Delay | Per-User Cap |
|---|----------|-------|--------|-------|--------------|
| 1 | Verification | `auth.signup` hook | Supabase | 0s | 3/hour |
| 2 | Magic Link | `auth.magiclink` hook | Supabase | 0s | 3/hour |
| 3 | Welcome | `email_confirmed_at` updated | App logic | 30s | 1/lifetime |
| 4 | Scan Started | `scan.status = 'passive'` | App logic | 0s | 3/hour |
| 5 | Scan Complete | `scan.status = 'complete'` | App logic | 0s | 5/hour |
| 6 | Payment Receipt | `checkout.session.completed` | Stripe webhook | 0s | unlimited |
| 7 | Report Ready | scan.tier upgraded + synthesis complete | App logic | 0s | 1/scan |
| 8 | Scan Failed | `scan.status = 'failed'` | App logic | 0s | 1/scan |
| 9 | Account Deletion | account deletion complete | App logic | 0s | 1/lifetime |
| 10 | Re-engagement | cron (daily at 10am UTC) | Cron job | 7 days after verify | 1/lifetime |

### Rate Limiting

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Global per-user | 10 emails / 24h rolling window | Prevents runaway email volume from any single user |
| Auth emails (Templates 1, 2) | 3 / hour | Prevents abuse of magic link and verification endpoints |
| Scan emails (Templates 4, 5) | 5 / hour | Allows power users running multiple scans while preventing floods |

**Deduplication key:** `hash(user_id + template_id + reference_id)`
- Prevents duplicate sends for the same trigger event (e.g., webhook retry sending scan complete twice for the same scan)
- Implementation: check `email_log` table before sending; reject if dedup key exists within the `dedup_window` for that template

### Suppression Rules

| Condition | Effect |
|-----------|--------|
| User has active SSE connection to scan progress page | Suppress Templates 4 and 5 (user is watching live progress) |
| User viewed scan dashboard in last 5 minutes | Suppress Template 5 (user already saw results) |
| Hard bounce on file (in `email_suppression_list`) | Suppress **ALL** emails to that address |
| Spam complaint on file (in `email_suppression_list`) | Suppress **ALL** emails to that address |
| Unsubscribed from marketing (`marketing_opt_in = false`) | Suppress Template 10 only |
| Account deleted | Suppress **ALL** (should never reach this state — deletion email sent before erasure) |

---

## Section 4: Email Design System

### Color Palette

Aligned with the MarketingAlphaScan application design system:

| Token | Hex | Usage in Emails |
|-------|-----|-----------------|
| Primary | `#1A1A2E` | Email header background, heading text color |
| Accent | `#0F3460` | Links, secondary button backgrounds |
| Highlight | `#E94560` | Primary CTA button background, important badges |
| Success | `#06D6A0` | Green traffic light dots, positive score indicators |
| Warning | `#FFD166` | Yellow traffic light dots, medium score indicators |
| Error | `#EF476F` | Red traffic light dots, low scores, alert callouts |
| Background | `#FAFBFC` | Email outer wrapper / body background |
| Surface | `#FFFFFF` | Content card background |
| Text Primary | `#1A1A2E` | Body text |
| Text Secondary | `#64748B` | Secondary text, labels, timestamps, footer text |
| Border | `#E2E8F0` | Dividers, card borders, table borders |

### Typography

```css
font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

| Element | Font | Weight | Size | Color | Line Height |
|---------|------|--------|------|-------|-------------|
| H1 headings | Plus Jakarta Sans | 800 | 28px (desktop), 24px (mobile) | `#1A1A2E` | 1.3 |
| H2 headings | Plus Jakarta Sans | 700 | 22px (desktop), 20px (mobile) | `#1A1A2E` | 1.3 |
| Body text | Inter | 400 | 16px | `#1A1A2E` | 1.6 |
| Data / scores | JetBrains Mono (fallback: monospace) | 600 | 16px | `#1A1A2E` | 1.4 |
| Secondary text | Inter | 400 | 14px | `#64748B` | 1.5 |
| Button text | Inter | 700 | 16px | `#FFFFFF` | 1.0 |
| Min font size | — | — | 14px | — | — |

> **Note on web fonts in email:** Most email clients do not load custom web fonts. The font stack above ensures graceful fallback to system fonts. Plus Jakarta Sans, Inter, and JetBrains Mono are used as first-choice for clients that support `@import` or `<link>` (Apple Mail, iOS Mail, Thunderbird).

### Layout Structure

```
+--------------------------------------------------------- 100% width --+
| Background: #FAFBFC                                                    |
|  +-------------------------------- 600px max ----------------------+  |
|  | Header: Deep Navy #1A1A2E background                            |  |
|  |   Logo (white variant) left-aligned, 120px wide                 |  |
|  +------------------------------------------------------------------+  |
|  | Content Card: #FFFFFF background                                 |  |
|  |   border-radius: 12px                                           |  |
|  |   padding: 32px (desktop) / 20px (mobile)                       |  |
|  |   margin-top: -8px (overlaps header slightly)                   |  |
|  |                                                                  |  |
|  |   [Content sections with 24px vertical spacing]                 |  |
|  |                                                                  |  |
|  |   +-- CTA Button ------------------------------------+          |  |
|  |   | #E94560 bg, white text, 16px bold                |          |  |
|  |   | padding: 14px 32px, border-radius: 8px           |          |  |
|  |   | min-width: 200px, center-aligned                 |          |  |
|  |   +--------------------------------------------------+          |  |
|  |                                                                  |  |
|  +------------------------------------------------------------------+  |
|  | Footer: #64748B text on #FAFBFC background                       |  |
|  |   Logo small (40px) + company name                               |  |
|  |   Unsubscribe link (Template 10 only)                            |  |
|  |   "(c) 2026 MarketingAlphaScan"                                  |  |
|  |   Physical address (Template 10 only)                            |  |
|  +------------------------------------------------------------------+  |
+------------------------------------------------------------------------+
```

### CTA Button VML Fallback for Outlook

Outlook on Windows does not support CSS `border-radius` or `background-color` on `<a>` tags. Use VML (Vector Markup Language) conditional comments:

```html
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{url}}"
  style="height:48px;v-text-anchor:middle;width:200px;"
  arcsize="17%" strokecolor="#E94560" fillcolor="#E94560">
<w:anchorlock/>
<center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">
  {{buttonText}}
</center>
</v:roundrect>
<![endif]-->
```

### Mobile Responsive Styles

```css
@media only screen and (max-width: 480px) {
  .content-card { padding: 20px !important; }
  .cta-button { width: 100% !important; }
  h1 { font-size: 24px !important; }
  h2 { font-size: 20px !important; }
  .score-badge { font-size: 14px !important; }
}
```

### React Email Component Inventory

| Component | Purpose | Props |
|-----------|---------|-------|
| `EmailLayout` | Outer wrapper + header + footer | `{ children, showUnsubscribe?: boolean }` |
| `ContentCard` | White card container | `{ children, padding?: string }` |
| `CTAButton` | Primary action button (#E94560) | `{ href: string, children: ReactNode, variant?: 'primary' \| 'secondary' }` |
| `SecondaryLink` | Text link (#0F3460) | `{ href: string, children: ReactNode }` |
| `ScoreBadge` | MarketingIQ score pill | `{ score: number, label: string, size?: 'sm' \| 'md' \| 'lg' }` |
| `TrafficLightRow` | Category score row with colored dot | `{ name: string, score: number, light: 'green' \| 'yellow' \| 'red' }` |
| `TechStackList` | Technology list display | `{ tools: Array<{ name: string, icon?: string }> }` |
| `ProgressBar` | Static scan progress indicator | `{ phase: number, percentage: number }` |
| `Divider` | Horizontal rule separator | `{ spacing?: number }` |
| `HeaderLogo` | Logo in header bar | `{ variant: 'dark' \| 'light' }` |
| `FooterLinks` | Footer navigation links | `{ links: Array<{ text: string, href: string }>, showAddress?: boolean }` |
| `AlertBox` | Highlighted callout box | `{ type: 'info' \| 'warning' \| 'success', children: ReactNode }` |

---

## Section 5: Supabase Auth Email Integration

### Architecture Decision: Send Email Hook

**Decision:** Use Supabase **Send Email Hook** (not custom SMTP, not Supabase template override).

| Option | Why Not |
|--------|---------|
| Custom SMTP | Supabase SMTP only allows customizing HTML within Supabase's template system. No access to React Email components, no dynamic data injection beyond basic auth tokens. |
| Template Override | Supabase templates use a limited variable set (`{{ .ConfirmationURL }}`, `{{ .Token }}`). Cannot inject custom data like scan scores or domain names. |
| **Send Email Hook** | Supabase calls YOUR endpoint instead of sending email itself. Full control over template rendering, data injection, and sending provider (Resend). **This is the chosen approach.** |

### Hook Configuration in Supabase Dashboard

1. Navigate to: **Auth > Hooks > Send Email Hook > Enable**
2. Set URL: `https://marketingalphascan.com/api/auth/send-email`
3. Set Secret: stored as `SUPABASE_SEND_EMAIL_HOOK_SECRET` (generated by Supabase, used for HMAC signature verification)

### Supabase Hook Payload

```typescript
interface SendEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  };
  email_data: {
    token: string;            // OTP token (6 digits for verify, or hash for link)
    token_hash: string;       // URL-safe token hash
    redirect_to: string;      // redirect URL after confirmation
    email_action_type: 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite';
    site_url: string;         // configured site URL
    token_new?: string;       // for email_change: new email token
    token_hash_new?: string;  // for email_change: new email token hash
  };
}
```

### Hook Endpoint Implementation

```typescript
// apps/web/app/api/auth/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { VerificationEmail } from '@marketingalphascan/email-templates/verification';
import { MagicLinkEmail } from '@marketingalphascan/email-templates/magic-link';
import { RecoveryEmail } from '@marketingalphascan/email-templates/recovery';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  // 1. Verify webhook signature
  const signature = request.headers.get('x-supabase-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const body = await request.text();
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET!)
    .update(body)
    .digest('base64');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload: SendEmailHookPayload = JSON.parse(body);
  const { user, email_data } = payload;

  // 2. Select template and build confirmation URL
  let subject: string;
  let html: string;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marketingalphascan.com';

  switch (email_data.email_action_type) {
    case 'signup': {
      const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=signup&redirect_to=/dashboard`;
      subject = 'Verify your email to unlock Full Scan access';
      html = await render(VerificationEmail({
        email: user.email,
        confirmationUrl: confirmUrl,
      }));
      break;
    }
    case 'magiclink': {
      const magicUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=magiclink&redirect_to=/dashboard`;
      subject = 'Your login link for MarketingAlphaScan';
      html = await render(MagicLinkEmail({
        email: user.email,
        magicLinkUrl: magicUrl,
      }));
      break;
    }
    case 'recovery': {
      const recoveryUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=recovery&redirect_to=/auth/reset-password`;
      subject = 'Reset your MarketingAlphaScan password';
      html = await render(RecoveryEmail({
        email: user.email,
        recoveryUrl: recoveryUrl,
      }));
      break;
    }
    default:
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  // 3. Send via Resend
  try {
    await resend.emails.send({
      from: 'MarketingAlphaScan <alpha@marketingalphascan.com>',
      replyTo: 'support@marketingalphascan.com',
      to: user.email,
      subject,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send failed:', error);
    // Return 500 so Supabase retries the hook
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
```

### Confirmation Page Implementation

```typescript
// apps/web/app/auth/confirm/page.tsx

import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash: string; type: string; redirect_to?: string };
}) {
  const supabase = await createServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: searchParams.token_hash,
    type: searchParams.type as 'signup' | 'magiclink' | 'recovery',
  });

  if (error) {
    redirect('/auth/error?message=verification_failed');
  }

  // For signup: email_confirmed_at is now set
  // Trigger welcome email (via server action or API call)
  if (searchParams.type === 'signup') {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
      method: 'POST',
      body: JSON.stringify({
        template: 'welcome',
        userId: (await supabase.auth.getUser()).data.user?.id,
      }),
    });
  }

  redirect(searchParams.redirect_to || '/dashboard');
}
```

### OAuth Flow (No Verification Email Needed)

```
User clicks "Sign in with Google"
  -> Supabase OAuth flow
  -> Callback to /auth/callback
  -> email_confirmed_at already set by OAuth provider
  -> Send Welcome email (Template 3)
  -> Redirect to /dashboard
```

OAuth users bypass Template 1 (Email Verification) entirely because the OAuth provider has already verified their email address. The callback handler at `/auth/callback` detects that this is a new user (no prior `email_confirmed_at`) and triggers Template 3 (Welcome Email) with the standard 30-second delay.

---

## Section 6: Email Analytics & Tracking

### Resend Native Analytics

Available in the Resend dashboard without additional configuration:
- **Delivery rate** — percentage of emails successfully delivered to the recipient's mail server
- **Open rate** — *caveat: Apple Mail Privacy Protection (MPP) pre-fetches all tracking pixels, inflating open rates by approximately 30-50%. Treat open rate as directionally useful but not reliable for conversion analysis.*
- **Click rate** — reliable engagement signal; the most trustworthy metric for measuring email effectiveness
- **Bounce rate** — percentage of emails that failed delivery (hard + soft)
- **Complaint rate** — percentage of recipients who marked email as spam

### Resend Webhook Events

Configure webhooks in Resend dashboard: Settings > Webhooks > Add Endpoint > URL: `https://marketingalphascan.com/api/webhooks/resend`

| Event | Payload Key Fields | Action |
|-------|-------------------|--------|
| `email.sent` | id, from, to, subject, created_at | Log to `email_log`, PostHog: `email_sent` |
| `email.delivered` | id, to, delivered_at | Update `email_log` status, PostHog: `email_delivered` |
| `email.opened` | id, to, opened_at | PostHog: `email_opened` (unreliable — Apple MPP) |
| `email.clicked` | id, to, clicked_at, click.url | PostHog: `email_clicked` (reliable engagement signal) |
| `email.bounced` | id, to, bounce.type (hard/soft), bounce.message | Hard: add to `suppression_list`. Soft: Resend auto-retries. PostHog: `email_bounced` |
| `email.complained` | id, to | Add to `suppression_list` (suppress ALL future emails). PostHog: `email_complained` |
| `email.delivery_delayed` | id, to, delayed_until | Log only (informational) |

### Webhook Endpoint Implementation

```typescript
// apps/web/app/api/webhooks/resend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createServiceClient } from '@/lib/supabase/server';

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers = {
    'svix-id': request.headers.get('svix-id') || '',
    'svix-timestamp': request.headers.get('svix-timestamp') || '',
    'svix-signature': request.headers.get('svix-signature') || '',
  };

  const wh = new Webhook(webhookSecret);
  let event: any;
  try {
    event = wh.verify(body, headers);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'email.bounced':
      if (event.data.bounce?.type === 'hard') {
        await supabase.from('email_suppression_list').upsert({
          email: event.data.to[0],
          reason: 'hard_bounce',
          details: event.data.bounce.message,
        }, { onConflict: 'email' });
      }
      break;
    case 'email.complained':
      await supabase.from('email_suppression_list').upsert({
        email: event.data.to[0],
        reason: 'complaint',
      }, { onConflict: 'email' });
      break;
  }

  // PostHog server-side capture (non-blocking)
  captureEmailEvent(event).catch(() => {});

  return NextResponse.json({ received: true });
}
```

### PostHog Event Schema

```typescript
function captureEmailEvent(event: ResendWebhookEvent) {
  const eventMap: Record<string, string> = {
    'email.sent': 'email_sent',
    'email.delivered': 'email_delivered',
    'email.opened': 'email_opened',
    'email.clicked': 'email_clicked',
    'email.bounced': 'email_bounced',
    'email.complained': 'email_complained',
  };

  const posthogEvent = eventMap[event.type];
  if (!posthogEvent) return;

  return posthog.capture({
    distinctId: event.data.to[0], // email as distinct_id
    event: posthogEvent,
    properties: {
      email_id: event.data.id,
      template: event.data.tags?.template || 'unknown',
      subject: event.data.subject,
      ...(event.type === 'email.clicked' && { click_url: event.data.click?.url }),
      ...(event.type === 'email.bounced' && { bounce_type: event.data.bounce?.type }),
    },
  });
}
```

### Bounce Handling

| Type | Behavior | Our Action |
|------|----------|------------|
| **Hard bounce** | Email permanently undeliverable (invalid address, domain doesn't exist) | Add to `email_suppression_list` with `reason='hard_bounce'`. All future sends check this list before sending. |
| **Soft bounce** | Temporary issue (mailbox full, server down, rate limited) | No action needed. Resend auto-retries up to 3 times over 72 hours. |
| **Complaint** | User marked email as spam in their mail client | Add to `email_suppression_list` with `reason='complaint'`. Suppress ALL future emails including transactional (protect domain reputation). |

### Database Tables

```sql
-- Email log (for dedup, analytics, and audit)
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  reference_id TEXT,           -- scan_id or payment_id for dedup
  resend_id TEXT,              -- Resend message ID
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_log_dedup ON email_log(user_id, template_id, reference_id);
CREATE INDEX idx_email_log_user ON email_log(user_id);
CREATE INDEX idx_email_log_created ON email_log(created_at);

-- Email suppression list
CREATE TABLE email_suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email preferences (per user)
CREATE TABLE email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_in BOOLEAN DEFAULT false,
  scan_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own email log" ON email_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own preferences" ON email_preferences
  FOR ALL USING (auth.uid() = user_id);
-- email_suppression_list: NO RLS (service_role only, never exposed to client)
```

---

## Section 7: Compliance

### CAN-SPAM Classification

| Template | Classification | Unsubscribe Required | Physical Address Required | List-Unsubscribe Header |
|----------|---------------|---------------------|--------------------------|------------------------|
| 1 (Verification) | Transactional | No | No | No |
| 2 (Magic Link) | Transactional | No | No | No |
| 3 (Welcome) | Transactional | No | No | No |
| 4 (Scan Started) | Transactional | No | No | No |
| 5 (Scan Complete) | Transactional | No | No | No |
| 6 (Payment Receipt) | Transactional | No | No | No |
| 7 (Report Ready) | Transactional | No | No | No |
| 8 (Scan Failed) | Transactional | No | No | No |
| 9 (Account Deletion) | Transactional | No | No | No |
| 10 (Re-engagement) | **Marketing / Commercial** | **Yes** | **Yes** | **Yes** |

### GDPR Compliance

| Requirement | Implementation |
|-------------|---------------|
| **Legal basis for transactional emails (1-9)** | Legitimate interest (Article 6(1)(f)) — necessary for service delivery the user requested |
| **Legal basis for marketing email (10)** | Consent (Article 6(1)(a)) — explicit opt-in required |
| **Opt-in implementation** | Unchecked checkbox at registration: "Send me occasional marketing emails" — sets `email_preferences.marketing_opt_in = true` |
| **Right to erasure (Article 17)** | `DELETE /api/account` triggers deletion of `email_log`, `email_preferences`, and `email_suppression_list` entries. Template 9 (Account Deletion) is sent BEFORE data erasure. |
| **Data minimization** | `email_log` stores metadata only (template ID, subject, status). Email body content is never stored. |

### RFC 8058 List-Unsubscribe-Post

Required by Gmail and Yahoo since February 2024 for bulk/marketing senders. Applied only to Template 10.

```typescript
// Only added to Template 10 (marketing email)
headers: {
  'List-Unsubscribe': '<https://marketingalphascan.com/api/email/unsubscribe?token={{signedToken}}>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
```

### One-Click Unsubscribe Endpoint

```typescript
// apps/web/app/api/email/unsubscribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // RFC 8058: POST with body "List-Unsubscribe=One-Click"
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    const { userId } = jwt.verify(token, process.env.UNSUBSCRIBE_JWT_SECRET!) as { userId: string };
    const supabase = createServiceClient();
    await supabase.from('email_preferences').upsert({
      user_id: userId,
      marketing_opt_in: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
}

// Also support GET for the in-email link click
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/auth/error?message=invalid_token', request.url));
  }

  try {
    const { userId } = jwt.verify(token, process.env.UNSUBSCRIBE_JWT_SECRET!) as { userId: string };
    const supabase = createServiceClient();
    await supabase.from('email_preferences').upsert({
      user_id: userId,
      marketing_opt_in: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.redirect(new URL('/unsubscribed', request.url));
  } catch {
    return NextResponse.redirect(new URL('/auth/error?message=invalid_token', request.url));
  }
}
```

### Retention Policy

| Data | Retention | Deletion Method |
|------|-----------|----------------|
| `email_log` | 90 days | `pg_cron`: `DELETE FROM email_log WHERE created_at < now() - interval '90 days'` (runs daily at 3am UTC) |
| `email_suppression_list` | Indefinite | Never auto-deleted (must protect deliverability permanently) |
| `email_preferences` | Account lifetime | `CASCADE` on `auth.users` deletion |

---

## Section 8: Code Architecture

### Monorepo Layout

```
MarketingAlphaScan/
+-- packages/
|   +-- email-templates/              # React Email components
|   |   +-- src/
|   |   |   +-- components/           # Shared email components
|   |   |   |   +-- email-layout.tsx
|   |   |   |   +-- content-card.tsx
|   |   |   |   +-- cta-button.tsx
|   |   |   |   +-- score-badge.tsx
|   |   |   |   +-- traffic-light-row.tsx
|   |   |   |   +-- tech-stack-list.tsx
|   |   |   |   +-- progress-bar.tsx
|   |   |   |   +-- divider.tsx
|   |   |   |   +-- header-logo.tsx
|   |   |   |   +-- footer-links.tsx
|   |   |   |   +-- alert-box.tsx
|   |   |   +-- templates/            # Email templates
|   |   |   |   +-- verification.tsx
|   |   |   |   +-- magic-link.tsx
|   |   |   |   +-- welcome.tsx
|   |   |   |   +-- scan-started.tsx
|   |   |   |   +-- scan-complete.tsx
|   |   |   |   +-- payment-receipt.tsx
|   |   |   |   +-- report-ready.tsx
|   |   |   |   +-- scan-failed.tsx
|   |   |   |   +-- account-deletion.tsx
|   |   |   |   +-- re-engagement.tsx
|   |   |   +-- index.ts
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |
|   +-- email-service/                # Email sending logic
|       +-- src/
|       |   +-- send.ts               # Core sendEmail function
|       |   +-- suppression.ts        # Suppression list check
|       |   +-- rate-limit.ts         # Rate limiting check
|       |   +-- dedup.ts              # Deduplication check
|       |   +-- types.ts              # TypeScript interfaces
|       |   +-- index.ts
|       +-- package.json
|       +-- tsconfig.json
|
+-- apps/web/app/api/
    +-- auth/send-email/route.ts      # Supabase Send Email Hook
    +-- email/
    |   +-- send/route.ts             # Internal email trigger endpoint
    |   +-- unsubscribe/route.ts      # One-click unsubscribe
    +-- webhooks/
        +-- resend/route.ts           # Resend webhook handler
```

### Core sendEmail Function

```typescript
// packages/email-service/src/send.ts

import { Resend } from 'resend';
import { render } from '@react-email/render';
import { createServiceClient } from './supabase';
import { checkSuppression } from './suppression';
import { checkRateLimit } from './rate-limit';
import { checkDedup } from './dedup';

interface SendEmailOptions {
  to: string;
  userId?: string;
  template: string;
  subject: string;
  react: React.ReactElement;
  referenceId?: string;          // scan_id, payment_id, etc.
  headers?: Record<string, string>;
  critical?: boolean;            // true = throw on failure, false = log and continue
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  skipped?: 'suppressed' | 'rate_limited' | 'duplicate';
  error?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, userId, template, subject, react, referenceId, headers, critical = false } = options;

  try {
    // 1. Check suppression list
    const suppressed = await checkSuppression(to);
    if (suppressed) {
      return { success: false, skipped: 'suppressed' };
    }

    // 2. Check rate limit
    if (userId) {
      const rateLimited = await checkRateLimit(userId, template);
      if (rateLimited) {
        return { success: false, skipped: 'rate_limited' };
      }
    }

    // 3. Check dedup
    if (userId && referenceId) {
      const duplicate = await checkDedup(userId, template, referenceId);
      if (duplicate) {
        return { success: false, skipped: 'duplicate' };
      }
    }

    // 4. Render and send
    const html = await render(react);
    const { data, error } = await resend.emails.send({
      from: 'MarketingAlphaScan <alpha@marketingalphascan.com>',
      replyTo: 'support@marketingalphascan.com',
      to,
      subject,
      html,
      headers,
      tags: [{ name: 'template', value: template }],
    });

    if (error) throw error;

    // 5. Log to database (non-blocking)
    const supabase = createServiceClient();
    supabase.from('email_log').insert({
      user_id: userId,
      to_email: to,
      template_id: template,
      subject,
      reference_id: referenceId,
      resend_id: data?.id,
      status: 'sent',
    }).then(() => {}).catch(console.error);

    // 6. PostHog capture (non-blocking)
    capturePostHog('email_sent', to, { template, subject }).catch(() => {});

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error(`Email send failed [${template}] to ${to}:`, error);
    if (critical) throw error;
    return { success: false, error: String(error) };
  }
}
```

### Error Handling Philosophy

| Email Type | On Failure | Rationale |
|-----------|-----------|-----------|
| Auth emails (Templates 1, 2) | **THROW** error — Supabase retries hook | User cannot access account without these |
| Welcome (Template 3) | Log, continue | Nice-to-have; user is already verified and on the dashboard |
| Scan notifications (4, 5, 7, 8) | Log, continue | User can check the dashboard directly |
| Payment receipt (6) | Log, **ALERT** (notify team) | Legally required; retry manually if needed |
| Account deletion (9) | Log, continue | Confirmation only; deletion already happened |
| Re-engagement (10) | Log, continue | Marketing email; not critical to operations |

---

## Section 9: Budget Planning

### Volume Projections

| Scale | Monthly Scans | Auth Emails | Scan Emails | Other | Total/Month | Resend Tier | Cost/Month |
|-------|--------------|-------------|-------------|-------|-------------|------------|------------|
| Launch (100 scans) | 100 | ~200 | ~300 | ~10 | ~510 | Free (3K/mo) | $0 |
| Growth (1K scans) | 1,000 | ~800 | ~2,000 | ~100 | ~2,900 | Free (3K/mo) | $0 |
| Traction (5K scans) | 5,000 | ~3,000 | ~8,000 | ~500 | ~11,500 | Pro ($20/mo, 50K/mo) | $20 |
| Scale (20K scans) | 20,000 | ~10,000 | ~30,000 | ~2,000 | ~42,000 | Pro ($20/mo) | $20 |
| Limit | — | — | — | — | 50,000 | Pro upgrade needed | $20 |

**Free tier:** 3,000 emails/month, sufficient through the Growth phase (estimated months 1-4).

**Pro tier:** $20/month for 50,000 emails/month. Upgrade when daily volume consistently exceeds ~80 emails/day.

**Year 1 total email cost: $0-$140** (free for the first ~5 months, then $20/month for the remainder).

### Cost Optimization Strategies

1. **Suppress scan started/complete emails when user is actively on the dashboard** — estimated ~30% reduction in scan notification emails
2. **OAuth users skip verification email** — saves 1 email per OAuth registration (estimated 40-60% of registrations)
3. **Re-engagement capped at 1/lifetime per user** — never accumulates cost over time
4. **Batch re-engagement emails in daily cron** — single database query, efficient Resend API usage (batch endpoint)
5. **Monitor Resend dashboard weekly** — track delivery rates, identify cost-inefficient templates early

### Upgrade Decision Signals

| Signal | Threshold | Action |
|--------|-----------|--------|
| Monthly email volume approaching 2,500 | 83% of free tier | Plan for Pro upgrade within 30 days |
| Daily sends consistently above 80 | Approaching free tier limit | Upgrade to Pro tier |
| Bounce rate above 2% | Deliverability risk | Investigate; may need dedicated IP ($40/mo extra) |
| Need for dedicated IP | > 50,000 emails/month | Upgrade to Resend Enterprise or add dedicated IP |

---

## Appendix A: Environment Variables

```env
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx                    # from Resend dashboard > API Keys
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx           # from Resend dashboard > Webhooks

# Supabase Auth Hook
SUPABASE_SEND_EMAIL_HOOK_SECRET=xxxxxxxxxxxx       # from Supabase dashboard > Auth > Hooks

# Email addresses
RESEND_FROM_EMAIL=alpha@marketingalphascan.com
RESEND_REPLY_TO_EMAIL=support@marketingalphascan.com

# Unsubscribe JWT
UNSUBSCRIBE_JWT_SECRET=xxxxxxxxxxxx                # random 64-char hex (openssl rand -hex 32)

# PostHog (for email event capture)
POSTHOG_API_KEY=phc_xxxxxxxxxxxx
POSTHOG_HOST=https://us.i.posthog.com
```

**Storage locations:**
- Vercel: Project Settings > Environment Variables (encrypted at rest)
- Local development: `.env.local` (gitignored)
- Never commit secrets to the repository

---

## Appendix B: Database Migration SQL

Complete migration for the email system tables. Run via Supabase SQL Editor or as a migration file.

```sql
-- Migration: create_email_system_tables
-- Description: Email log, suppression list, and preferences for the email system

-- 1. Email log (for dedup, analytics, and audit trail)
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  reference_id TEXT,
  resend_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON public.email_log(user_id, template_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_log_resend_id ON public.email_log(resend_id);

-- 2. Email suppression list
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Email preferences (per user)
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_in BOOLEAN DEFAULT false,
  scan_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Row Level Security
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
-- email_suppression_list: NO RLS (service_role access only)

-- Users can view their own email log
CREATE POLICY "Users see own email log" ON public.email_log
  FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own email preferences
CREATE POLICY "Users manage own preferences" ON public.email_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 5. Retention cleanup (requires pg_cron extension enabled in Supabase)
-- Run daily at 3:00 AM UTC to delete email_log entries older than 90 days
-- Enable in Supabase: Database > Extensions > pg_cron
SELECT cron.schedule(
  'cleanup-email-log',
  '0 3 * * *',
  $$DELETE FROM public.email_log WHERE created_at < now() - interval '90 days'$$
);
```

---

## Appendix C: React Email Dev Preview

### Package Configuration

```json
{
  "name": "@marketingalphascan/email-templates",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "email dev --port 3002",
    "build": "tsc",
    "preview": "email export --outDir ./out"
  },
  "dependencies": {
    "@react-email/components": "^0.0.25",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "react-email": "^3.0.0",
    "typescript": "^5.5.0"
  }
}
```

### Running the Preview Server

```bash
# From monorepo root
npm run dev -w packages/email-templates

# Opens at http://localhost:3002
# Hot-reloads on template changes
# Shows all templates in a sidebar for easy navigation
```

The React Email dev server renders each template with mock data, allowing visual QA across all 10 templates without sending actual emails.

---

## Appendix D: Email Launch Checklist

### Infrastructure
- [ ] Resend account created and domain verified (all DNS records green)
- [ ] DMARC policy set to `p=none` (initial monitoring phase)
- [ ] Cloudflare MX record has proxy OFF (grey cloud)
- [ ] SPF, DKIM, and DMARC all passing (verify via test email headers)

### Supabase Integration
- [ ] Supabase Send Email Hook configured and enabled
- [ ] Hook endpoint deployed to Vercel and responding to test payloads
- [ ] Verification flow tested end-to-end (signup -> email -> click -> verified)
- [ ] Magic link flow tested end-to-end
- [ ] OAuth flow triggers Welcome email correctly

### Templates
- [ ] All 10 templates rendering correctly in React Email dev preview
- [ ] Mobile rendering verified in Litmus or Email on Acid
- [ ] Outlook VML fallback buttons rendering correctly
- [ ] Dark mode appearance acceptable (test in Apple Mail, Gmail app)
- [ ] All CTA links pointing to correct URLs
- [ ] Template 5 (Scan Complete) dynamic data rendering correctly with real scan data

### Webhooks & Analytics
- [ ] Resend webhook endpoint deployed and verified (test with Resend dashboard)
- [ ] PostHog email events flowing (check PostHog Events tab)
- [ ] Hard bounce correctly adds to suppression list
- [ ] Complaint correctly adds to suppression list

### Sending Logic
- [ ] Suppression list check working (test with a known bounced address)
- [ ] Rate limiting working (test with rapid sends — should reject after threshold)
- [ ] Dedup check working (trigger same event twice — second should be skipped)
- [ ] `email_log` table populating correctly

### Compliance
- [ ] Template 10 has `List-Unsubscribe` and `List-Unsubscribe-Post` headers
- [ ] One-click unsubscribe endpoint working (both POST and GET)
- [ ] Physical address present in Template 10 footer
- [ ] Marketing opt-in checkbox is unchecked by default on registration form
- [ ] Account deletion sends Template 9 before data erasure

### Go-Live
- [ ] Warmup plan ready (< 50 emails/day for first week)
- [ ] Monitoring dashboard bookmarked (Resend analytics + PostHog)
- [ ] Alerting configured for bounce rate > 2% or complaint rate > 0.1%
- [ ] Team notified of DMARC graduation schedule (weeks 5, 13)
