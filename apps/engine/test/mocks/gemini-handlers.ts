import { http, HttpResponse } from 'msw';
import { readFixture } from '../fixtures/loader';

export const geminiHandlers = [
  http.post(
    'https://generativelanguage.googleapis.com/v1beta/models/:model\\:generateContent',
    async ({ params, request }) => {
      const model = params.model as string;
      const body = (await request.json()) as any;

      const promptText = body.contents?.[0]?.parts?.[0]?.text || '';
      const fixtureKey = extractFixtureKey(promptText);

      try {
        const fixture = await readFixture('gemini', model, fixtureKey);
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(fixture) }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 1500,
            candidatesTokenCount: 800,
            totalTokenCount: 2300,
          },
        });
      } catch {
        // Default generic response
        return HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: '{}' }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
        });
      }
    },
  ),
];

function extractFixtureKey(prompt: string): string {
  if (prompt.includes('analytics')) return 'm41_analytics';
  if (prompt.includes('paid media')) return 'm41_paid_media';
  if (prompt.includes('final synthesis')) return 'm42_final';
  if (prompt.includes('PRD')) return 'm43_prd';
  if (prompt.includes('ROI')) return 'm44_roi';
  if (prompt.includes('cost cutter')) return 'm45_cost_cutter';
  return 'generic';
}
