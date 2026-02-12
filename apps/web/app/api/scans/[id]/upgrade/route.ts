import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { engineFetch } from '@/lib/engine';
import { isValidUUID } from '@/lib/utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Get current scan
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier, status, user_id, url, domain')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Only upgrade peek scans
  if (scan.tier !== 'peek') {
    return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
  }

  // Reject failed/cancelled scans
  if (scan.status === 'failed' || scan.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot upgrade a failed scan' }, { status: 400 });
  }

  // If scan already has an owner and it's not this user, reject
  if (scan.user_id && scan.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Associate scan with user and upgrade tier
  await supabase
    .from('scans')
    .update({ user_id: user.id, tier: 'full' })
    .eq('id', scanId);

  // Notify engine to run remaining modules
  await engineFetch(`/engine/scans/${scanId}/upgrade`, {
    method: 'POST',
    body: JSON.stringify({ tier: 'full' }),
  });

  return NextResponse.json({ upgraded: true });
}
