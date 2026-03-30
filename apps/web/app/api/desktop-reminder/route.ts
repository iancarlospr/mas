import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@marketing-alpha/email-service';
import { DesktopReminderEmail } from '@marketing-alpha/email-templates';

const Schema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, turnstileToken } = parsed.data;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  // IP rate limit: 3 per hour
  const ipLimit = rateLimit(`desktop-reminder:${ip}`, 3, 3_600_000);
  if (!ipLimit.allowed) {
    // Return success silently to prevent enumeration
    return NextResponse.json({ success: true });
  }

  // Email rate limit: 1 per 24h per address
  const emailLimit = rateLimit(`desktop-reminder:email:${email.toLowerCase()}`, 1, 86_400_000);
  if (!emailLimit.allowed) {
    // Already sent to this email recently — silently succeed
    return NextResponse.json({ success: true });
  }

  // Verify Turnstile token
  if (process.env.TURNSTILE_SECRET_KEY) {
    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
      }),
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return NextResponse.json({ error: 'Security verification failed' }, { status: 403 });
    }
  }

  try {
    await sendEmail({
      to: email,
      template: 'desktop-reminder',
      subject: 'your desktop link is ready \u2014 Chlo\u00e9',
      react: DesktopReminderEmail({ email }),
    });
  } catch (err) {
    console.error('[desktop-reminder] Failed to send:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
