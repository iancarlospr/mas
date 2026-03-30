/** Test account credentials for E2E tests. */
export const TEST_USERS = {
  free: {
    email: process.env.E2E_TEST_EMAIL || 'free@test.com',
    password: process.env.E2E_TEST_PASSWORD || 'testpass123',
  },
  paid: {
    email: process.env.E2E_PAID_EMAIL || 'paid@test.com',
    password: process.env.E2E_PAID_PASSWORD || 'testpass123',
  },
} as const;
