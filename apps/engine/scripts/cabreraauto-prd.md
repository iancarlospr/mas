# Remediation Plan: Cabrera Auto Group

**Business:** Cabrera Auto Group (cabreraauto.com)
**Scan Date:** April 2, 2026
**Prepared By:** AlphaScan Marketing Intelligence Engine
**Classification:** Confidential — Internal Use Only

---

## Executive Summary

Cabrera Auto Group — Puerto Rico's largest multi-brand dealership with 10 brands across 4 locations (Arecibo, Bayamon, Hatillo) — has built its digital presence on a solid technical foundation that most competing dealers would envy: an industry-specific CMS (Dealer eProcess Everest), enterprise-grade infrastructure (Cloudflare CDN + WAF, Cloudinary image optimization, TLS 1.3, HTTP/2), and the best structured data markup we've seen in the automotive vertical (4 AutoDealer JSON-LD entities with complete location, department, and SearchAction schema).

However, the marketing technology layer built on top of this foundation is significantly underdeveloped for a dealership of this scale. The scan identified **38 findings** across **4 priority tiers**: critical email authentication gaps (no DKIM), fragmented advertising governance (4 Google Ads accounts and 2 Facebook Pixels on a single domain), zero marketing automation or CRM integration, no live chat, no consent management, and minimal conversion tracking beyond phone clicks. The site also lacks Open Graph meta tags — a particularly impactful gap in Puerto Rico's Facebook and WhatsApp-dominated digital ecosystem.

The good news: most P0 and P1 fixes are configuration changes (Cloudflare settings, GTM tags, meta tag additions) that don't require developer resources or platform migrations. The estimated timeline for all four priority tiers is **8 weeks**, with the most impactful wins achievable in the first 2 weeks.

**Finding Breakdown:**
| Priority | Count | Description |
|----------|-------|-------------|
| P0 (Immediate) | 8 | Security, compliance, and social sharing fixes |
| P1 (This Week) | 12 | Advertising governance, conversion tracking, lead capture |
| P2 (This Month) | 12 | Analytics depth, behavioral tools, UX optimization |
| P3 (Backlog) | 6 | Advanced capabilities and future improvements |

---

## P0 — Immediate Actions (Do Today)

### 1. Configure DKIM Email Authentication

**Context:** Cabrera Auto Group uses Microsoft 365 (via Trend Micro Email Security) for business email. SPF is properly configured with a strict -all policy, and DMARC is set to quarantine mode. However, DKIM — the cryptographic proof that emails actually originated from your domain — is completely absent. No DKIM records were found for any of 10 common selectors.

**Current State:** DNS queries for default._domainkey.cabreraauto.com, google._domainkey.cabreraauto.com, selector1._domainkey.cabreraauto.com, and 7 other selectors returned no records.

**Implementation:**
1. Access Microsoft 365 admin center (admin.microsoft.com) → Settings → Domains → cabreraauto.com
2. Navigate to email authentication settings → DKIM
3. Generate DKIM signing keys (Microsoft provides selector1 and selector2 automatically)
4. Copy the provided CNAME records
5. Add these CNAME records in Cloudflare DNS dashboard
6. Return to Microsoft 365 admin and enable DKIM signing
7. Wait 15-30 minutes for DNS propagation

**Verification:**
- Run: dig selector1._domainkey.cabreraauto.com CNAME — should return Microsoft's DKIM endpoint
- Send a test email to a Gmail address → check headers for dkim=pass
- Use mail-tester.com to score email authentication

**Expected Impact:** Improved email deliverability for appointment confirmations, service reminders, and promotional emails. Protection against domain spoofing attacks.

**Effort:** S (Small) — 30 minutes, no developer needed

---

### 2. Enable HSTS via Cloudflare

**Context:** The site uses TLS 1.3 with HTTPS everywhere, but the Strict-Transport-Security header is missing. Without HSTS, browsers will attempt an HTTP connection on the first visit, creating a window for SSL-stripping man-in-the-middle attacks. For a site that collects customer PII through lead forms and credit applications, this is a security concern.

**Current State:** HTTP response headers do not include Strict-Transport-Security. Cloudflare provides TLS termination but HSTS must be explicitly enabled.

**Implementation:**
1. Log into Cloudflare dashboard for cabreraauto.com
2. Navigate to SSL/TLS → Edge Certificates
3. Find HTTP Strict Transport Security (HSTS) section → Enable
4. Set max-age to 31536000 (1 year)
5. Enable "Include Subdomains" (verify all subdomains support HTTPS first)
6. Enable "No-Sniff Header" (if not already enabled)
7. After 1 month of successful operation, consider enabling "Preload"

**Verification:**
- Check response headers: curl -I https://www.cabreraauto.com | grep strict
- Should see: strict-transport-security: max-age=31536000; includeSubDomains

**Expected Impact:** Eliminates SSL-stripping attack vector for all returning visitors. Improves security posture for PII-handling forms.

**Effort:** S (Small) — 10 minutes, Cloudflare dashboard only

---

### 3. Add Open Graph Meta Tags

**Context:** Zero Open Graph tags were detected on the homepage. In Puerto Rico, Facebook is the dominant social platform and WhatsApp is the primary messaging app. When anyone shares a link to cabreraauto.com on either platform, the preview is auto-generated — typically showing a random image (or none), a truncated title, and no description. For a dealership that promotes inventory, specials, and events on social media, this directly undermines every social post.

**Current State:** No og:title, og:description, og:image, og:url, or og:type meta tags in page source.

**Implementation:**
1. Contact Dealer eProcess (DEP) support to request platform-level Open Graph tag configuration
2. Provide the following tag specifications for the homepage:
   - og:title: "Cabrera Auto Group | Concesionario en Arecibo, PR"
   - og:description: "10 marcas, 4 ubicaciones en Puerto Rico. Chevrolet, Nissan, Hyundai, Ford, Jeep y mas. Vehiculos nuevos y usados, servicio, piezas y carroceria."
   - og:image: URL of a branded 1200x630 image (create one showing the dealership or logo)
   - og:url: "https://www.cabreraauto.com/"
   - og:type: "website"
   - og:locale: "es_PR"
3. Request OG tags also be added to VDP (Vehicle Detail Page) templates dynamically
4. Request OG tags for specials/promotions pages

**Verification:**
- Use Facebook Sharing Debugger (developers.facebook.com/tools/debug/) to check preview
- Share a test link on WhatsApp to verify preview renders correctly

**Expected Impact:** Dramatically improved social media engagement. Every link share becomes a branded, visual call-to-action instead of a generic placeholder. Estimated 2-3x improvement in social click-through rates.

**Effort:** S (Small) — depends on DEP support response time (typically 24-48 hours)

---

### 4. Implement Consent Management Platform

**Context:** No consent management platform (CMP) was detected. Analytics cookies (_ga, _gid, _gcl_au) and advertising cookies (_fbp) are set without explicit user consent. While Puerto Rico is a US territory and GDPR doesn't apply, CCPA may affect California-based visitors. More critically, Google requires Consent Mode v2 for continued access to ads personalization features — without it, remarketing audiences and conversion modeling in GA4 and Google Ads will progressively degrade.

**Current State:** No CMP banner, no consent-related JavaScript, no Google Consent Mode API calls detected.

**Implementation:**
1. Sign up for Cookiebot (cookiebot.com) — free tier covers up to 1 domain/100 pages
2. Create configuration for cabreraauto.com:
   - Set language: Spanish
   - Set region: US (for CCPA compliance mode)
   - Enable Google Consent Mode v2 integration
3. Deploy via Google Tag Manager:
   - Add Cookiebot as a GTM template tag
   - Configure consent initialization tag (fires before all other tags)
   - Map consent categories: Necessary, Statistics, Marketing, Preferences
4. Update GA4 and Google Ads tags in GTM to respect consent state
5. Test with Google Tag Assistant to verify consent signals

**Verification:**
- Load site in incognito → consent banner should appear
- Check GA4 real-time → events should fire with consent parameters
- Verify in Google Ads → audience signals should show consent mode integration

**Expected Impact:** CCPA compliance, maintained Google Ads personalization features, improved user trust.

**Effort:** M (Medium) — 2-4 hours for initial setup

---

### 5. Add DMARC Reporting URIs

**Context:** DMARC is set to quarantine mode (p=quarantine) but has no reporting URIs. This means Cabrera Auto has zero visibility into email authentication failures.

**Current State:** DMARC record: v=dmarc1; p=quarantine — no rua or ruf URIs.

**Implementation:**
1. Choose a DMARC reporting service (DMARCian, Valimail, or Postmark DMARC — all have free tiers)
2. Sign up and get your reporting email address
3. Update the DMARC TXT record in Cloudflare DNS with rua and ruf fields
4. Wait 24-48 hours for first reports to arrive

**Verification:**
- dig TXT _dmarc.cabreraauto.com should show updated record with rua/ruf
- After 48 hours, check reporting dashboard for authentication data

**Expected Impact:** Visibility into email authentication status. Data needed to safely upgrade from p=quarantine to p=reject.

**Effort:** S (Small) — 15 minutes

---

### 6. Optimize Title Tag

**Context:** The current title tag is 152 characters — roughly 3x the recommended 50-60 character length. It attempts to list all 10 brands, both locations, and the business name. Google truncates this at ~60 characters, cutting off before the business name appears.

**Current State:** "Concesionario Chevrolet, Chrysler, Dodge, Ford, GMC, Hyundai, Jeep, Nissan, Ram y Wagoneer en Arecibo PR Autos Nuevo y Usado en Utuado en Cabrera Auto"

**Implementation:**
1. Request title tag change through Dealer eProcess support or CMS admin
2. Suggested title: "Cabrera Auto Group | Concesionario en Arecibo, PR" (49 characters)
3. Brand names are already comprehensively covered in JSON-LD structured data

**Verification:**
- Check page source for updated title tag
- After Google re-crawls, verify in Search Console

**Expected Impact:** Cleaner search result appearance, better brand recognition, avoid potential keyword-stuffing penalties.

**Effort:** S (Small) — 5 minutes if admin access, or 24-48 hours via DEP support

---

### 7. Add Canonical Tag

**Context:** No canonical tag was found on the homepage. The site is accessible at both cabreraauto.com and www.cabreraauto.com (with redirect), but without a canonical tag, search engines must infer the preferred URL.

**Implementation:**
1. Add to homepage template: link rel="canonical" href="https://www.cabreraauto.com/"
2. Request DEP support add self-referencing canonical tags to all page templates

**Verification:**
- View page source → search for rel="canonical"
- Use Google Search Console URL Inspection to verify

**Expected Impact:** Clear URL preference signal to search engines. Prevents duplicate content dilution.

**Effort:** S (Small) — via DEP support request

---

### 8. Enable DNSSEC via Cloudflare

**Context:** DNSSEC is not enabled. Cloudflare offers one-click enablement.

**Implementation:**
1. Cloudflare dashboard → DNS → DNSSEC → Enable
2. If domain registered elsewhere, add the DS record to registrar

**Verification:**
- Use dnssec-analyzer.verisignlabs.com to check DNSSEC chain

**Expected Impact:** Protection against DNS cache poisoning. Improved trust signals.

**Effort:** S (Small) — 5 minutes

---

## P1 — This Week

### 9. Audit and Consolidate Google Ads Accounts

**Context:** 4 separate Google Ads accounts are actively firing on cabreraauto.com: AW-597584798, AW-16950946914, AW-16979056415, AW-16978571371. This fragmentation prevents unified audience management, frequency capping, and cross-campaign attribution.

**Implementation:**
1. Identify account ownership: which agencies, teams, or brand managers control each?
2. Determine which accounts have active campaigns vs. legacy/inactive
3. Select a primary account (likely AW-597584798 based on tag order)
4. Migrate active campaigns from secondary accounts to the primary
5. Update GTM to remove conversion tags for deprecated accounts
6. Set up proper campaign structure: New Vehicles, Used Vehicles, Service, Parts, Brand

**Effort:** M (Medium) — 1-2 weeks for full audit and migration

**Expected Impact:** Unified ROAS visibility, proper frequency capping, eliminated self-competition. Potential 15-25% reduction in wasted ad spend.

---

### 10. Consolidate Facebook Pixels

**Context:** 2 Facebook Pixels detected: 777931221222497 and 1143908714142200. Dual pixels split audience data.

**Implementation:**
1. Identify which pixel is primary (check Meta Business Manager)
2. Migrate events to the primary pixel
3. Remove secondary pixel from GTM
4. Update Custom Audiences

**Effort:** S (Small) — 2-4 hours

**Expected Impact:** Unified Meta audience data, better lookalike audiences.

---

### 11. Expand GA4 Event Tracking

**Context:** Currently, only phone click conversions are tracked. For a dealership, this captures only one of 8+ recommended conversion types.

**Implementation:**
1. Configure in GTM:
   - Form Submissions: Trigger on /leadform/ POST → GA4 event "generate_lead"
   - VDP Views: Fire "view_item" when vehicle detail pages load
   - Inventory Search: Track "search" on /buscar/
   - Credit Application Start: Track when credit app page loads
   - Price Alert Subscription: Track custom "price_alert_signup"
   - Coupon Print/Save: Track "coupon_interaction"
2. Mark form submissions and phone clicks as GA4 conversions
3. Import key events into Google Ads for campaign optimization

**Effort:** M (Medium) — 1-2 days for GTM configuration

**Expected Impact:** Full-funnel visibility. Google Ads can optimize for lead events, not just clicks.

---

### 12. Deploy Live Chat

**Context:** No live chat widget is active. The DEP chat module exists but no customer-facing widget is visible.

**Implementation:**
1. Evaluate: Podium (recommended), CarChat24, or Dealer.com LiveChat
2. Key requirements: 24/7 AI after-hours, SMS integration, CRM routing, GA4 tracking
3. Deploy via GTM or direct embed
4. Configure auto-greetings for VDP pages
5. Fire GA4 events on chat interactions

**Effort:** M (Medium) — 1 week for vendor selection and deployment

**Expected Impact:** 24/7 lead capture. Automotive benchmarks show chat leads convert 3-5x faster than form leads. Estimated 20-30% increase in lead volume.

> **Want to explore which chat solution fits your specific brand mix?** Ask the AI Assistant: "What's the best chat platform for a 10-brand dealership in Puerto Rico?"

---

### 13. Fix Cloudflare WAF Bot Whitelisting

**Context:** Aggressive bot protection may be blocking legitimate search engine bots and marketing integrations.

**Implementation:**
1. Cloudflare → Security → WAF → Custom Rules
2. Add rule: If cf.client.bot = true → Skip challenge
3. Test with Google Search Console URL Inspection
4. Monitor Security Events for false positives

**Effort:** S (Small) — 30 minutes

**Expected Impact:** Improved search engine crawling and indexing.

---

### 14. Add Twitter Card Meta Tags

**Context:** No Twitter Card meta tags detected. These are also used by LinkedIn.

**Implementation:**
1. Add to page head (via DEP support):
   - twitter:card: "summary_large_image"
   - twitter:title: "Cabrera Auto Group | Concesionario en Arecibo, PR"
   - twitter:description and twitter:image

**Effort:** S (Small) — bundled with OG tag request

---

### 15. Implement Content Security Policy (CSP)

**Context:** No CSP header. Site loads scripts from multiple third-party domains without enforcement.

**Implementation:**
1. Start with report-only mode via Cloudflare Transform Rules
2. Whitelist: cdn.dealereprocess.org, googletagmanager.com, google-analytics.com, connect.facebook.net, fonts.googleapis.com, res.cloudinary.com, doubleclick.net
3. Monitor violations for 2 weeks
4. Switch to enforcing mode

**Effort:** M (Medium) — 2-3 weeks including monitoring

**Expected Impact:** XSS protection for customer-facing pages handling PII.

---

### 16. Add Subresource Integrity (SRI) Hashes

**Context:** 0 of 3 cross-origin scripts have SRI integrity attributes.

**Implementation:**
1. Generate SRI hashes (use srihash.org)
2. Add integrity and crossorigin attributes to external scripts/links
3. Note: GTM script cannot use SRI (dynamic content)

**Effort:** S (Small) — 1 hour

---

### 17. Configure Cross-Domain Tracking

**Context:** No cross-domain tracking detected. If external domains are used for financing or scheduling, user journeys will be fragmented.

**Implementation:**
1. Identify external domains in the customer journey
2. Configure GA4 cross-domain measurement in GTM
3. Verify with GA4 DebugView

**Effort:** S (Small) — 1-2 hours

---

### 18. Add Hreflang Self-Reference Tag

**Context:** Site is Spanish-only (es-US) with no hreflang tags.

**Implementation:**
1. Add hreflang="es-US" self-reference and x-default to head

**Effort:** S (Small) — via DEP support

---

### 19. Improve Favicon Coverage

**Context:** Only ICO format. Missing Apple touch icon and modern formats.

**Implementation:**
1. Create apple-touch-icon.png (180x180), favicon-32x32.png, favicon-16x16.png
2. Add link tags to head
3. Use realfavicongenerator.net

**Effort:** S (Small) — 30 minutes

---

### 20. Phone Conversion Tracking for All Departments

**Context:** Only the primary sales number (787-333-8410) has tracking. 3 other department numbers are untracked.

**Implementation:**
1. Add gtag_report_conversion for: Body Shop (787-333-8416), Service (787-333-8417), Parts (787-333-8418)
2. Use different conversion labels per department
3. Import all as Google Ads conversions

**Effort:** S (Small) — 1 hour in GTM

**Expected Impact:** Full phone call attribution across all revenue-generating departments.

---

## P2 — This Month

### 21. Deploy Session Recording (Microsoft Clarity)

**Context:** No session recording tools. UX optimization is guesswork.

**Implementation:**
1. Sign up for Microsoft Clarity (free, no limits)
2. Deploy via GTM
3. Review sessions and heatmaps weekly

**Effort:** S (Small) — 30 minutes

---

### 22. Deploy Server-Side Google Tag Manager

**Context:** All analytics is client-side. ~30% data lost to ad blockers.

**Implementation:**
1. Create server-side GTM container
2. Deploy on first-party subdomain: track.cabreraauto.com
3. Route GA4 and Meta Pixel through server-side container
4. Configure consent-aware tags

**Effort:** L (Large) — 1-2 weeks

**Expected Impact:** Recover ~30% lost analytics data. Better ROAS measurement.

---

### 23. Evaluate and Deploy Automotive CRM

**Context:** No CRM integration visible. For 10 brands, 4 locations, automated lead routing is critical.

**Implementation:**
1. Evaluate: VinSolutions, DealerSocket, or Elead
2. Requirements: DEP integration, auto-routing by brand/location, email nurture, lead scoring, mobile app
3. Configure lead flow: DEP form → CRM → auto-acknowledge → assign → follow-up
4. Set up drip campaigns

**Effort:** XL (Extra Large) — 4-6 weeks

**Expected Impact:** Faster lead response, automated follow-up, 20-40% more leads converted.

> **Wondering how to choose between VinSolutions and DealerSocket?** Ask the AI Assistant: "Compare VinSolutions vs DealerSocket for a multi-brand PR dealership"

---

### 24. Deploy A/B Testing Platform

**Context:** No testing tools. Changes are untested assumptions.

**Implementation:**
1. Deploy VWO or similar
2. Start with: lead form field count, VDP CTA copy, homepage variations
3. Run each test minimum 2 weeks or 100 conversions per variant

**Effort:** M (Medium) — 1 week setup

---

### 25. Implement Structured Data for VDPs

**Context:** Homepage JSON-LD is excellent. VDPs need Product schema.

**Implementation:**
1. Work with DEP to add Product schema to VDP templates
2. Include: name, brand, model, vehicleModelDate, mileage, color, offers (price)
3. Test with Google Rich Results Test

**Effort:** M (Medium)

---

### 26. Google Business Profile Review Monitoring

**Context:** Mixed news sentiment. Active review management is critical for automotive.

**Implementation:**
1. Verify Google Business Profiles for all 4 locations
2. Set up review monitoring alerts
3. Respond to all reviews within 24 hours
4. Implement review request automation via CRM

**Effort:** M (Medium) — ongoing

---

### 27. Email Marketing Automation

**Context:** No email marketing beyond transactional M365.

**Implementation:**
1. Select platform (CRM built-in, or Mailchimp/Brevo)
2. Templates: welcome, service reminder, inventory alerts, monthly specials, post-purchase
3. Build segments: new leads, service customers, brand-specific interests
4. Ensure CAN-SPAM compliance

**Effort:** L (Large) — 2-3 weeks

---

### 28. Performance Monitoring (Web Vitals)

**Context:** Core Web Vitals not measured due to WAF interference.

**Implementation:**
1. Set up Search Console CWV monitoring
2. Deploy web-vitals.js via GTM for GA4 tracking
3. Set up regression alerts

**Effort:** S (Small) — 1-2 hours

---

### 29. Landing Pages for Ad Campaigns

**Context:** All ad traffic goes to homepage. Dedicated landing pages improve conversion.

**Implementation:**
1. Work with DEP for landing page templates
2. Single CTA focus, no navigation distractions
3. Track with dedicated GA4 events

**Effort:** M (Medium) — ongoing

---

### 30. Push Notifications

**Context:** No web push capability.

**Implementation:**
1. Evaluate OneSignal (free tier) or PushOwl
2. Non-intrusive opt-in (delayed prompt)
3. Automated flows: price drops, new inventory, promotions

**Effort:** M (Medium) — 1 week

---

### 31. Google Ads Enhanced Conversions

**Context:** Phone tracking configured but no Enhanced Conversions.

**Implementation:**
1. Enable Enhanced Conversions in GTM for Google Ads tag
2. Map form fields (hashed before sending)
3. Verify in Google Ads diagnostics

**Effort:** S (Small) — 1-2 hours

---

### 32. Enhanced Service Department Schema

**Context:** AutoRepair schema exists but can be enhanced.

**Implementation:**
1. Add ServiceOffer items, AggregateRating, acceptsReservations
2. Add FAQ schema for common service questions

**Effort:** S (Small) — via DEP support

---

## P3 — Backlog

### 33. Explore BIMI (Brand Indicators for Message Identification)

Once DKIM is configured and DMARC reaches p=reject, implement BIMI to display the Cabrera Auto logo in email clients.

### 34. MTA-STS and SMTP TLS Reporting

Enhance email transport security with MTA-STS policy and TLS reporting.

### 35. Customer Data Platform

Deploy a CDP (Segment, mParticle) for unified customer data across website, CRM, email, and ad platforms. Enables predictive lead scoring.

### 36. AR/VR Vehicle Preview

Emerging technology: AR vehicle previews on mobile for inventory browsing.

### 37. Multi-Language Support (English)

Add English translations for bilingual PR audience and mainland customers.

### 38. Advanced Personalization

Use VWO or Dynamic Yield for personalized homepage experiences based on visitor behavior.

---

## Implementation Timeline

| Week | Focus | Key Milestones |
|------|-------|----------------|
| **Week 1** | P0 Security + Social | DKIM enabled, HSTS on, OG tags added, Cookiebot deployed, canonical tag, title optimized |
| **Week 2** | P1 Advertising Governance | Google Ads audit complete, FB Pixel consolidated, expanded event tracking, live chat vendor selected |
| **Week 3-4** | P1-P2 Conversion Infrastructure | Live chat deployed, session recording active, WAF bots whitelisted, CSP in report-only mode |
| **Week 5-6** | P2 Analytics Depth | Server-side GTM deployed, CRM evaluation complete, A/B testing started |
| **Week 7-8** | P2 CRM + Automation | CRM deployment begins, email automation templates created, VDP structured data added |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DEP platform limits custom meta tag additions | Medium | High | Escalate to DEP enterprise support; OG tags are standard platform feature |
| Google Ads consolidation disrupts active campaigns | Medium | High | Migrate during low-traffic period; run parallel for 1 week |
| CMP banner increases bounce rate | Low | Medium | Non-intrusive design; A/B test |
| Cloudflare WAF whitelist creates security gap | Low | Medium | Only whitelist verified bot signatures (cf.client.bot) |
| CRM deployment requires extensive team training | High | Medium | Phase rollout: start with lead routing, add features incrementally |

---

## Verification Checklist

- [ ] DKIM records resolve for selector1._domainkey.cabreraauto.com
- [ ] HSTS header present in response (max-age >= 31536000)
- [ ] Open Graph preview renders on Facebook Sharing Debugger
- [ ] Cookiebot consent banner appears on first visit
- [ ] GA4 receives consent mode signals
- [ ] DMARC record includes rua reporting URI
- [ ] Title tag is 50-60 characters
- [ ] Canonical tag points to https://www.cabreraauto.com/
- [ ] DNSSEC enabled
- [ ] Google Ads consolidated to 1-2 accounts
- [ ] Facebook Pixel consolidated to 1 pixel
- [ ] GA4 receiving form_submit, view_item, search events
- [ ] Live chat widget active on all pages
- [ ] Cloudflare WAF allows verified bots
- [ ] Twitter Card meta tags present
- [ ] CSP header in report-only mode
- [ ] Session recording collecting data
- [ ] All 4 department phone numbers have conversion tracking

---

## Expected Outcomes

After completing P0-P2 (estimated 6-8 weeks):

- **Security posture:** DKIM + HSTS + CSP + Consent Management = significantly improved
- **Social sharing:** Branded OG previews — estimated 2-3x improvement in CTR
- **Advertising efficiency:** Consolidated accounts = unified ROAS, potential 15-25% savings
- **Lead capture:** Chat + expanded forms = estimated 20-30% increase in lead volume
- **Measurement:** Full-funnel GA4 + server-side + consent = accurate ROI reporting
- **Conversion optimization:** Session recording + A/B testing = data-driven decisions
- **Lead management:** CRM with automation = faster response, higher conversion

The foundation is already excellent. These improvements layer marketing sophistication on top of world-class infrastructure and structured data — matching the digital maturity expected of Puerto Rico's largest automotive dealer group.
