import posthog from 'posthog-js';

/** Human-readable names for desktop OS window IDs */
const WINDOW_NAMES: Record<string, string> = {
  'about': 'About AlphaScan',
  'products': 'Products',
  'pricing': 'Pricing',
  'customers': 'Reviews',
  'chill': 'chill.mov',
  'history': 'My Scans',
  'chat-launcher': 'GhostChat™',
  'scan-input': 'Scan.exe',
  'features': 'Why AlphaScan?',
  'blog': 'UnderTheStack',
  'games': 'Ghost Sweeper',
  'trash': 'Log Out',
  'auth': 'auth.exe (Login)',
  'profile': 'Profile',
};

function windowDisplayName(windowId: string): string {
  if (WINDOW_NAMES[windowId]) return WINDOW_NAMES[windowId]!;
  if (windowId.startsWith('scan-')) return `Scan Report`;
  if (windowId.startsWith('payment-')) return `Payment`;
  if (windowId.startsWith('chat-')) return `GhostChat™`;
  return windowId;
}

/**
 * Track PostHog analytics events.
 * Safe to call even if PostHog is not initialized — events are silently dropped.
 *
 * Every event includes $event_description for human-readable context in Live Events.
 */
export const analytics = {
  scanStarted(domain: string, tier: string) {
    posthog.capture('scan_started', { domain, tier, $event_description: `Scan: ${domain} (${tier})` });
  },

  scanCompleted(scanId: string, domain: string, marketingIq: number | null) {
    posthog.capture('scan_completed', { scan_id: scanId, domain, marketing_iq: marketingIq, $event_description: `${domain} — MarketingIQ: ${marketingIq ?? '?'}` });
  },

  signupWallShown(domain: string) {
    posthog.capture('signup_wall_shown', { domain, $event_description: `Gate shown for ${domain}` });
  },

  signupWallConverted(domain: string) {
    posthog.capture('signup_wall_converted', { domain, $event_description: `Signed up after scanning ${domain}` });
  },

  chatMessageSent(scanId: string) {
    posthog.capture('chat_message_sent', { scan_id: scanId, $event_description: `Chat message in scan ${scanId.slice(0, 8)}` });
  },

  moduleExpanded(moduleId: string, scanId: string) {
    posthog.capture('module_expanded', { module_id: moduleId, scan_id: scanId, $event_description: `Expanded ${moduleId}` });
  },

  checkoutStarted(product: string, scanId: string, amountCents: number) {
    posthog.capture('checkout_started', { product, scan_id: scanId, amount_cents: amountCents, $event_description: `${product} — $${(amountCents / 100).toFixed(2)}` });
  },

  /** PRD/PDF download — source distinguishes which button was clicked */
  pdfDownloaded(scanId: string, domain: string, source: 'status_bar' | 'm43_slide' | 'report_topbar' | 'boss_deck' | 'm43_boss_deck' | 'audit_deck' | 'm43_audit_deck') {
    posthog.capture('pdf_downloaded', { scan_id: scanId, domain, source, $event_description: `${domain} — ${source}` });
  },

  shareLinkCreated(scanId: string) {
    posthog.capture('share_link_created', { scan_id: scanId, $event_description: `Share link for ${scanId.slice(0, 8)}` });
  },

  scanDeleted(scanId: string) {
    posthog.capture('scan_deleted', { scan_id: scanId, $event_description: `Deleted scan ${scanId.slice(0, 8)}` });
  },

  accountDeleted() {
    posthog.capture('account_deleted', { $event_description: 'User deleted their account' });
  },

  windowOpened(windowId: string) {
    posthog.capture('window_opened', { window_id: windowId, window_name: windowDisplayName(windowId), $event_description: windowDisplayName(windowId) });
  },

  chatActivated(scanId: string) {
    posthog.capture('chat_activated', { scan_id: scanId, $event_description: `Chat activated for ${scanId.slice(0, 8)}` });
  },

  markdownCopied(scanId: string, domain: string) {
    posthog.capture('markdown_copied', { scan_id: scanId, domain, $event_description: `Copied MD for ${domain}` });
  },

  authFailed(mode: string, errorMessage: string, context?: string) {
    posthog.capture('auth_failed', { mode, error_message: errorMessage, context, $event_description: `${mode}: ${errorMessage}` });
  },

  /** Scan report opened — fires when ScanDashboardContent mounts with data */
  reportViewed(scanId: string, domain: string, tier: string) {
    posthog.capture('report_viewed', { scan_id: scanId, domain, tier, $event_description: `${domain} (${tier})` });
  },

  /** Tab/category navigation within the scan report */
  reportTabClicked(scanId: string, tabKey: string) {
    posthog.capture('report_tab_clicked', { scan_id: scanId, tab: tabKey, $event_description: `Tab: ${tabKey}` });
  },

  /** Slide became visible via scroll (fires once per slide per session) */
  slideViewed(scanId: string, slideId: string) {
    posthog.capture('slide_viewed', { scan_id: scanId, slide_id: slideId, $event_description: slideId });
  },

  /** Scroll depth milestone in the report (25%, 50%, 75%, 100%) */
  reportScrollDepth(scanId: string, depth: number) {
    posthog.capture('report_scroll_depth', { scan_id: scanId, depth_percent: depth, $event_description: `${depth}% scroll depth` });
  },

  /** Chloé callout clicked within a slide */
  chloeCalloutClicked(scanId: string, slideId: string, variant: 'margin-note' | 'cta') {
    posthog.capture('chloe_callout_clicked', { scan_id: scanId, slide_id: slideId, variant, $event_description: `${variant} on ${slideId}` });
  },

  betaInviteClicked(code: string) {
    posthog.capture('beta_invite_clicked', { invite_code: code, $event_description: `Invite: ${code}` });
  },
};
