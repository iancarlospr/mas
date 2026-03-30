// PostHog reverse proxy — handled by Next.js rewrites in next.config.ts
// This file exists as a fallback if rewrites don't match
export async function POST() {
  return new Response(null, { status: 404 });
}

export async function GET() {
  return new Response(null, { status: 404 });
}
