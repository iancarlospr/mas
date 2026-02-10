import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/web/vitest.config.ts',
      'apps/engine/vitest.config.ts',
      'packages/types/vitest.config.ts',
    ],
  },
});
