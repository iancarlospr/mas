import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { sendEmail } from '@marketing-alpha/email-service';
import type { SendEmailHookPayload } from '@marketing-alpha/email-service';
import {
  VerificationEmail,
  MagicLinkEmail,
  RecoveryEmail,
} from '@marketing-alpha/email-templates';

/** Extract the final redirect destination from the emailRedirectTo value.
 *  signUp() passes /auth/callback?redirect_to=<path> (for OAuth flow).
 *  For email verification we need just the inner <path>. */
function extractRedirectPath(redirectTo: string | undefined): string {
  if (!redirectTo) return '/history';
  try {
    const url = new URL(redirectTo);
    if (url.pathname === '/auth/callback') {
      return url.searchParams.get('redirect_to') || '/history';
    }
    return url.pathname + url.search;
  } catch {
    // Already a relative path — use directly
    return redirectTo;
  }
}

/** POST — Supabase Send Email Hook handler (Standard Webhooks spec) */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  // Verify using Standard Webhooks — strip the v1,whsec_ prefix
  const hookSecret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET ?? '';
  const wh = new Webhook(hookSecret.replace(/^v1,whsec_/, ''));

  let verified: SendEmailHookPayload;
  try {
    verified = wh.verify(payload, headers) as SendEmailHookPayload;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json(
      { error: { http_code: 401, message: 'Invalid webhook signature' } },
      { status: 401 },
    );
  }

  const { user, email_data } = verified;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';

  // Extract the final redirect path from email_data.redirect_to.
  // signUp() sets emailRedirectTo to /auth/callback?redirect_to=<path> (for OAuth),
  // but for email verification we skip the callback and redirect directly after OTP.
  const redirectPath = extractRedirectPath(email_data.redirect_to);

  try {
    switch (email_data.email_action_type) {
      case 'signup': {
        const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=signup&redirect_to=${encodeURIComponent(redirectPath)}`;
        await sendEmail({
          to: user.email,
          userId: user.id,
          template: 'verification',
          subject: 'Verify your email to unlock Full Scan access',
          react: VerificationEmail({ email: user.email, confirmationUrl: confirmUrl }),
          critical: true,
        });
        break;
      }
      case 'magiclink': {
        const magicUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=magiclink&redirect_to=${encodeURIComponent(redirectPath)}`;
        await sendEmail({
          to: user.email,
          userId: user.id,
          template: 'magic-link',
          subject: 'Your login link for MarketingAlphaScan',
          react: MagicLinkEmail({ email: user.email, magicLinkUrl: magicUrl }),
          critical: true,
        });
        break;
      }
      case 'recovery': {
        const recoveryUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=recovery&redirect_to=/auth/reset-password`;
        await sendEmail({
          to: user.email,
          userId: user.id,
          template: 'recovery',
          subject: 'Reset your MarketingAlphaScan password',
          react: RecoveryEmail({ email: user.email, recoveryUrl }),
          critical: true,
        });
        break;
      }
      default:
        return NextResponse.json(
          { error: { http_code: 400, message: 'Unsupported action' } },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error('Email send failed:', err);
    return NextResponse.json(
      { error: { http_code: 500, message: 'Failed to send email' } },
      { status: 500 },
    );
  }

  // Supabase expects an empty JSON object on success
  return NextResponse.json({});
}
