import { vi } from 'vitest';

export const mockPostHog = {
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  onFeatureFlags: vi.fn(),
  isFeatureEnabled: vi.fn().mockReturnValue(false),
  getFeatureFlag: vi.fn().mockReturnValue(null),
};
