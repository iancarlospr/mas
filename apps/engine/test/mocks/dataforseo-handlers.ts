import { http, HttpResponse } from 'msw';
import { readFixture } from '../fixtures/loader';

export const dataForSeoHandlers = [
  // Domain Technologies
  http.post(
    'https://api.dataforseo.com/v3/domain_analytics/technologies/domain_technologies/live',
    async ({ request }) => {
      const body = (await request.json()) as any[];
      const target = body[0]?.target;
      try {
        const fixture = await readFixture('dataforseo', 'domain-technologies', target);
        return HttpResponse.json(fixture);
      } catch {
        return HttpResponse.json({
          version: '0.1.20241223',
          status_code: 20000,
          status_message: 'Ok.',
          tasks: [],
        });
      }
    },
  ),

  // Domain Rank
  http.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank/live',
    async ({ request }) => {
      const body = (await request.json()) as any[];
      const target = body[0]?.target;
      try {
        const fixture = await readFixture('dataforseo', 'domain-rank', target);
        return HttpResponse.json(fixture);
      } catch {
        return HttpResponse.json({
          version: '0.1.20241223',
          status_code: 20000,
          status_message: 'Ok.',
          tasks: [],
        });
      }
    },
  ),

  // Catch-all for unhandled DataForSEO endpoints
  http.post('https://api.dataforseo.com/v3/*', () => {
    return HttpResponse.json({
      version: '0.1.20241223',
      status_code: 20000,
      status_message: 'Ok.',
      tasks: [],
    });
  }),
];
