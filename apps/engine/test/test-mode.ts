/**
 * Conditionally enable MSW in the engine when TEST_MODE=true.
 * This allows E2E tests to hit the real Fastify server while
 * intercepting all external API calls (DataForSEO, Gemini, etc.).
 *
 * Import this at the top of server.ts when running in test mode:
 *   if (process.env.TEST_MODE === 'true') await import('../test/test-mode.js');
 */
import { server } from './mocks/server';

server.listen({ onUnhandledRequest: 'bypass' });
console.log('[TEST_MODE] MSW intercepting external API calls');

export {};
