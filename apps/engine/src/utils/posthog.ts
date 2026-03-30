import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!process.env['POSTHOG_API_KEY']) return null;
  if (!client) {
    client = new PostHog(process.env['POSTHOG_API_KEY'], {
      host: process.env['POSTHOG_HOST'] ?? 'https://us.i.posthog.com',
      flushAt: 10,
      flushInterval: 5000,
    });
  }
  return client;
}

export async function shutdownPostHog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
