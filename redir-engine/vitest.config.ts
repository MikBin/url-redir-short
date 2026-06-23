import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.bench.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.ts', 'runtimes/**/*.ts'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.bench.ts',
        '**/.wrangler/**',
        '**/bundle-*/**',
        '**/loader.entry.ts',
        '**/dist/**',
      ],
      thresholds: {
        statements: 53,
        branches: 43,
        functions: 43,
        lines: 54,
      },
    },
  },
});
