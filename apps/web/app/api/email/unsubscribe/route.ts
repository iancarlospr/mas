import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createServiceClient } from '@/lib/supabase/server';

const secret = new TextEncoder().encode(
  process.env.UNSUBSCRIBE_JWT_SECRET ?? '',
);

async function unsubscribe(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secret);
  const userId = payload.userId as string;
  if (!userId) throw new Error('Invalid token payload');

  const supabase = createServiceClient();
  await supabase.from('email_preferences').upsert(
    {
      user_id: userId,
      marketing_opt_in: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return { userId };
}

/** POST — RFC 8058 List-Unsubscribe-Post handler */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    await unsubscribe(token);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
}

/** GET — Browser-accessible unsubscribe link */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(
      new URL('/auth/error?message=invalid_token', request.url),
    );
  }

  try {
    await unsubscribe(token);
    return NextResponse.redirect(new URL('/unsubscribed', request.url));
  } catch {
    return NextResponse.redirect(
      new URL('/auth/error?message=invalid_token', request.url),
    );
  }
}
