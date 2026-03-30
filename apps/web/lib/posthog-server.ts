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

/** Capture a server-side error to PostHog error tracking */
export function captureServerError(
  userId: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const ph = getPostHog();
  if (!ph) return;

  const err = error instanceof Error ? error : new Error(String(error));
  ph.capture({
    distinctId: userId,
    event: '$exception',
    properties: {
      $exception_message: err.message,
      $exception_type: err.name,
      $exception_stack_trace_raw: err.stack,
      ...context,
    },
  });
}
