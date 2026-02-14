import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface ConfirmPageProps {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    redirect_to?: string;
  }>;
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const params = await searchParams;
  const tokenHash = params.token_hash;
  const type = params.type as 'signup' | 'magiclink' | 'recovery' | undefined;
  const redirectTo = params.redirect_to ?? '/history';

  if (!tokenHash || !type) {
    redirect('/auth/error?message=invalid_link');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    redirect('/auth/error?message=verification_failed');
  }

  // For signup: trigger welcome email + redirect to "verified" interstitial
  if (type === 'signup') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';
      // Fire-and-forget welcome email
      fetch(`${baseUrl}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
        },
        body: JSON.stringify({
          template: 'welcome',
          userId: user.id,
          data: { email: user.email },
        }),
      }).catch(() => {});
    }

    // Redirect to interstitial that signals the original tab via BroadcastChannel
    redirect(`/auth/verified?redirect_to=${encodeURIComponent(redirectTo)}`);
  }

  redirect(redirectTo);
}
