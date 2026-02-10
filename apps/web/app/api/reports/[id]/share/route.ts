import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateShareToken } from '@/lib/report/share';

/** POST /api/reports/:id/share — generate a shareable report URL */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify scan exists and is paid
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const token = await generateShareToken(scanId);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';
  const url = `${baseUrl}/report/${scanId}?share=${token}`;

  return NextResponse.json({ url, token });
}
