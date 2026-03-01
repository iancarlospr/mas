import { Suspense } from 'react';
import { AuthRouteOrchestrator } from '@/components/auth/auth-route-orchestrator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthRouteOrchestrator mode="login" />
    </Suspense>
  );
}
