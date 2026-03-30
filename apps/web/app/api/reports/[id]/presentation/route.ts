import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/reports/[id]/presentation
 *
 * Redirect stub — PDF generation moved client-side.
 * Keeps old cached JS from triggering Vercel 500 errors.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/report/${id}/slides?download=1`, _request.url));
}
