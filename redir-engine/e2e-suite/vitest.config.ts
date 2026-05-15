import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['specs/**/*.test.ts'],
    testTimeout: 120000, // increased for heavy load tests like T12/T13
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
