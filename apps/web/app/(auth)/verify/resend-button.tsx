'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ResendVerificationButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleResend = async () => {
    setStatus('sending');
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: 'signup', email });
      setStatus('sent');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <button
      onClick={handleResend}
      disabled={status !== 'idle'}
      className="text-sm text-accent hover:underline disabled:opacity-50 disabled:no-underline"
    >
      {status === 'sent' ? 'Verification email resent' : status === 'sending' ? 'Resending...' : 'Resend verification email'}
    </button>
  );
}
