import { Suspense } from 'react';
import { AuthRouteOrchestrator } from '@/components/auth/auth-route-orchestrator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register',
};

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthRouteOrchestrator mode="register" />
    </Suspense>
  );
}
