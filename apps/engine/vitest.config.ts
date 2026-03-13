import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'engine',
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/integration/**'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/workers/**', 'src/lib/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.fixture.ts'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10_000,
    hookTimeout: 15_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: false },
    },
  },
});
