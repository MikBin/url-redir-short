import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['specs/**/*.test.ts'],
    testTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
        forks: {
            isolate: true,
            singleFork: false,
        },
    },
    // Prevent miniflare processes from accumulating
    hookTimeout: 30000,
  },
});
