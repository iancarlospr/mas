'use client';

import { usePostHog } from 'posthog-js/react';

/** Check if a PostHog feature flag is enabled for the current user */
export function useFeatureFlag(flag: string): boolean {
  const ph = usePostHog();
  return ph?.isFeatureEnabled(flag) ?? false;
}
