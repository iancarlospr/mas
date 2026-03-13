/**
 * ConsoleCollector — Captures console messages, page errors, and failed requests.
 *
 * Attach BEFORE page.goto() to capture SDK initialization logs from the start.
 * Replaces the ad-hoc page.on('console') listeners in M11.
 *
 * Consumers: M05 (tool confirmation), M08 (tag firing validation), M11 (primary)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapturedConsoleMessage {
  type: string;       // 'log' | 'warning' | 'error' | 'info' | 'debug' | 'trace'
  text: string;       // truncated to 500 chars
  url?: string;       // source URL from location()
  timestamp: number;
  sdkMatch: string | null; // matched SDK name or null
}

export interface CapturedPageError {
  message: string;    // truncated to 300 chars
  stack?: string;     // truncated to 500 chars
  timestamp: number;
}

export interface CapturedFailedRequest {
  url: string;        // truncated to 200 chars
  failure: string;
  resourceType: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SDK log patterns — matches console output from SDK initialization
// ---------------------------------------------------------------------------

const SDK_LOG_PATTERNS: Array<{ pattern: RegExp; tool: string }> = [
  // Google
  { pattern: /google\s*analytics|gtag|ga4/i, tool: 'Google Analytics 4' },
  { pattern: /google\s*tag\s*manager|gtm/i, tool: 'Google Tag Manager' },

  // Analytics
  { pattern: /segment\s*(loaded|initialized|ready)/i, tool: 'Segment' },
  { pattern: /mixpanel\s*(loaded|initialized)/i, tool: 'Mixpanel' },
  { pattern: /amplitude\s*(loaded|initialized|SDK)/i, tool: 'Amplitude' },
  { pattern: /posthog\s*(loaded|initialized|ready)/i, tool: 'PostHog' },
  { pattern: /heap\s*(loaded|initialized)/i, tool: 'Heap' },
  { pattern: /plausible/i, tool: 'Plausible' },
  { pattern: /rudderstack|rudder\s*analytics/i, tool: 'RudderStack' },

  // Session replay & heatmaps
  { pattern: /hotjar\s*(ready|initialized|loaded)/i, tool: 'Hotjar' },
  { pattern: /fullstory\s*(started|loaded|initialized)/i, tool: 'FullStory' },
  { pattern: /clarity\s*(loaded|initialized)/i, tool: 'Microsoft Clarity' },
  { pattern: /logrocket\s*(session|initialized)/i, tool: 'LogRocket' },
  { pattern: /mouseflow/i, tool: 'Mouseflow' },
  { pattern: /smartlook/i, tool: 'Smartlook' },

  // Error monitoring
  { pattern: /sentry\s*(initialized|SDK|loaded)/i, tool: 'Sentry' },
  { pattern: /bugsnag\s*(loaded|started|initialized)/i, tool: 'Bugsnag' },
  { pattern: /datadog\s*(rum|initialized|loaded)/i, tool: 'Datadog RUM' },
  { pattern: /new\s*relic\s*(agent|loaded)/i, tool: 'New Relic' },
  { pattern: /rollbar\s*(loaded|initialized)/i, tool: 'Rollbar' },

  // Chat & marketing
  { pattern: /intercom\s*(booted|loaded|initialized)/i, tool: 'Intercom' },
  { pattern: /drift\s*(ready|loaded|initialized)/i, tool: 'Drift' },
  { pattern: /crisp\s*(loaded|ready)/i, tool: 'Crisp' },
  { pattern: /zendesk\s*(loaded|chat)/i, tool: 'Zendesk' },
  { pattern: /hubspot\s*(loaded|initialized|tracking)/i, tool: 'HubSpot' },
  { pattern: /klaviyo\s*(loaded|initialized)/i, tool: 'Klaviyo' },

  // A/B testing
  { pattern: /optimizely\s*(activated|loaded|initialized)/i, tool: 'Optimizely' },
  { pattern: /launchdarkly\s*(connected|initialized|ready)/i, tool: 'LaunchDarkly' },
  { pattern: /vwo\s*(loaded|initialized)/i, tool: 'VWO' },

  // Tag managers
  { pattern: /tealium\s*(loaded|initialized)/i, tool: 'Tealium' },
  { pattern: /adobe\s*launch|_satellite/i, tool: 'Adobe Launch' },

  // Performance
  { pattern: /appdynamics|adrum/i, tool: 'AppDynamics' },
  { pattern: /dynatrace|dtrum/i, tool: 'Dynatrace' },
  { pattern: /elastic\s*apm/i, tool: 'Elastic APM' },
];

const MAX_MESSAGES = 300;
const MAX_ERRORS = 50;
const MAX_FAILED_REQUESTS = 50;
const MAX_TEXT_LENGTH = 500;

// ---------------------------------------------------------------------------
// ConsoleCollector
// ---------------------------------------------------------------------------

export class ConsoleCollector {
  private messages: CapturedConsoleMessage[] = [];
  private pageErrors: CapturedPageError[] = [];
  private failedRequests: CapturedFailedRequest[] = [];
  private attached = false;

  /**
   * Attach listeners to a Playwright page. Call BEFORE page.goto().
   */
  attach(page: Page): void {
    if (this.attached) return;
    this.attached = true;

    page.on('console', (msg) => {
      if (this.messages.length >= MAX_MESSAGES) return;
      try {
        const text = msg.text().slice(0, MAX_TEXT_LENGTH);
        const sdkMatch = this.matchSDK(text);
        this.messages.push({
          type: msg.type(),
          text,
          url: msg.location()?.url,
          timestamp: Date.now(),
          sdkMatch,
        });
      } catch {
        // Ignore errors from detached pages
      }
    });

    page.on('pageerror', (error: Error) => {
      if (this.pageErrors.length >= MAX_ERRORS) return;
      this.pageErrors.push({
        message: (error.message ?? 'Unknown error').slice(0, 300),
        stack: error.stack?.slice(0, 500),
        timestamp: Date.now(),
      });
    });

    page.on('requestfailed', (request) => {
      if (this.failedRequests.length >= MAX_FAILED_REQUESTS) return;
      try {
        const failure = request.failure();
        this.failedRequests.push({
          url: request.url().slice(0, 200),
          failure: failure?.errorText ?? 'Unknown',
          resourceType: request.resourceType(),
          timestamp: Date.now(),
        });
      } catch {
        // Ignore errors from detached pages
      }
    });
  }

  /** Get all captured console messages. */
  getAllMessages(): CapturedConsoleMessage[] {
    return this.messages;
  }

  /** Filter messages by type (e.g., 'error', 'warning', 'log'). */
  getByType(type: string): CapturedConsoleMessage[] {
    return this.messages.filter((m) => m.type === type);
  }

  /** Get messages that matched an SDK initialization pattern. */
  getSDKLogs(): CapturedConsoleMessage[] {
    return this.messages.filter((m) => m.sdkMatch !== null);
  }

  /** Get all captured page errors (uncaught exceptions). */
  getPageErrors(): CapturedPageError[] {
    return this.pageErrors;
  }

  /** Get all failed network requests. */
  getFailedRequests(): CapturedFailedRequest[] {
    return this.failedRequests;
  }

  /** Get messages captured since a given timestamp. */
  getMessagesSince(ts: number): CapturedConsoleMessage[] {
    return this.messages.filter((m) => m.timestamp >= ts);
  }

  /** Match a console message text against known SDK patterns. */
  private matchSDK(text: string): string | null {
    for (const { pattern, tool } of SDK_LOG_PATTERNS) {
      if (pattern.test(text)) return tool;
    }
    return null;
  }
}
