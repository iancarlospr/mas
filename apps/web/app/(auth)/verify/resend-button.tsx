'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ResendVerificationButton({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'already_verified'>('idle');

  const handleResend = async () => {
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    if (error) {
      // If the user is already confirmed, guide them to login instead
      if (error.message?.toLowerCase().includes('already confirmed') ||
          error.message?.toLowerCase().includes('already registered')) {
        setStatus('already_verified');
      } else {
        setStatus('error');
        // Allow retry after 3s
        setTimeout(() => setStatus('idle'), 3000);
      }
      return;
    }

    setStatus('sent');
  };

  if (status === 'already_verified') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-success">Your email is already verified.</p>
        <button
          onClick={() => router.push('/login')}
          className="text-sm font-medium text-accent hover:underline"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleResend}
      disabled={status !== 'idle'}
      className="text-sm text-accent hover:underline disabled:opacity-50 disabled:no-underline"
    >
      {status === 'sent'
        ? 'Verification email resent'
        : status === 'sending'
          ? 'Resending...'
          : status === 'error'
            ? 'Failed to resend — try again'
            : 'Resend verification email'}
    </button>
  );
}
