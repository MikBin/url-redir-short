import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['specs/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
