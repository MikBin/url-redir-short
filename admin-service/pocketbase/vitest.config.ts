import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/middleware/**', 'server/utils/**', 'server/api/**'],
      exclude: ['node_modules/**', 'tests/**', 'tests/setup.ts'],
    },
  },
})
