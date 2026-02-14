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

  reportPurchased(scanId: string, product: string) {
    posthog.capture('report_purchased', { scan_id: scanId, product });
  },

  chatMessageSent(scanId: string) {
    posthog.capture('chat_message_sent', { scan_id: scanId });
  },

  moduleExpanded(moduleId: string, scanId: string) {
    posthog.capture('module_expanded', { module_id: moduleId, scan_id: scanId });
  },
};
