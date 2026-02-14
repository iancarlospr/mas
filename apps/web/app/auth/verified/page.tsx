import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifiedContent } from './verified-content';

export const metadata: Metadata = {
  title: 'Email Verified',
};

export default function VerifiedPage() {
  return (
    <Suspense>
      <VerifiedContent />
    </Suspense>
  );
}
