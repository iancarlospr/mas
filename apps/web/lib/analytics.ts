import posthog from 'posthog-js';

/**
 * Track PostHog analytics events.
 * Safe to call even if PostHog is not initialized — events are silently dropped.
 */
export const analytics = {
  scanStarted(domain: string, tier: string) {
    posthog.capture('scan_started', { domain, tier });
  },

  scanCompleted(scanId: string, domain: string, marketingIq: number | null) {
    posthog.capture('scan_completed', { scan_id: scanId, domain, marketing_iq: marketingIq });
  },

  signupWallShown(domain: string) {
    posthog.capture('signup_wall_shown', { domain });
  },

  signupWallConverted(domain: string) {
    posthog.capture('signup_wall_converted', { domain });
  },

  chatMessageSent(scanId: string) {
    posthog.capture('chat_message_sent', { scan_id: scanId });
  },

  moduleExpanded(moduleId: string, scanId: string) {
    posthog.capture('module_expanded', { module_id: moduleId, scan_id: scanId });
  },

  checkoutStarted(product: string, scanId: string, amountCents: number) {
    posthog.capture('checkout_started', { product, scan_id: scanId, amount_cents: amountCents });
  },

  /** PRD/PDF download — source distinguishes which button was clicked */
  pdfDownloaded(scanId: string, domain: string, source: 'status_bar' | 'm43_slide' | 'report_topbar' | 'boss_deck' | 'm43_boss_deck') {
    posthog.capture('pdf_downloaded', { scan_id: scanId, domain, source });
  },

  shareLinkCreated(scanId: string) {
    posthog.capture('share_link_created', { scan_id: scanId });
  },

  scanDeleted(scanId: string) {
    posthog.capture('scan_deleted', { scan_id: scanId });
  },

  accountDeleted() {
    posthog.capture('account_deleted');
  },

  windowOpened(windowId: string) {
    posthog.capture('window_opened', { window_id: windowId });
  },

  chatActivated(scanId: string) {
    posthog.capture('chat_activated', { scan_id: scanId });
  },

  authFailed(mode: string, errorMessage: string, context?: string) {
    posthog.capture('auth_failed', { mode, error_message: errorMessage, context });
  },

  /** Scan report opened — fires when ScanDashboardContent mounts with data */
  reportViewed(scanId: string, domain: string, tier: string) {
    posthog.capture('report_viewed', { scan_id: scanId, domain, tier });
  },

  /** Tab/category navigation within the scan report */
  reportTabClicked(scanId: string, tabKey: string) {
    posthog.capture('report_tab_clicked', { scan_id: scanId, tab: tabKey });
  },

  /** Slide became visible via scroll (fires once per slide per session) */
  slideViewed(scanId: string, slideId: string) {
    posthog.capture('slide_viewed', { scan_id: scanId, slide_id: slideId });
  },

  /** Scroll depth milestone in the report (25%, 50%, 75%, 100%) */
  reportScrollDepth(scanId: string, depth: number) {
    posthog.capture('report_scroll_depth', { scan_id: scanId, depth_percent: depth });
  },

  /** Chloé callout clicked within a slide */
  chloeCalloutClicked(scanId: string, slideId: string, variant: 'margin-note' | 'cta') {
    posthog.capture('chloe_callout_clicked', { scan_id: scanId, slide_id: slideId, variant });
  },
};
