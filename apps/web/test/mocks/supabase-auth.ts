import { vi } from 'vitest';

export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
  app_metadata: { provider: 'email' },
  created_at: '2025-01-01T00:00:00Z',
};

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  user: mockUser,
};

export function createMockSupabaseAuth() {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: { session: mockSession },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { session: mockSession, user: mockUser },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: {
        session: null,
        user: { ...mockUser, email_confirmed_at: null },
      },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    }),
  };
}
