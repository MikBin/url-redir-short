import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['server/**/*.ts'],
      exclude: ['node_modules/**', 'tests/**', 'tests/setup.ts'],
      thresholds: {
        statements: 47,
        branches: 42,
        functions: 52,
        lines: 47,
      },
    },
  },
})
