import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['tests/components/**', 'happy-dom'],
      ['tests/integration/**', 'node'],
      ['tests/*.test.ts', 'node']
    ],
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup/env.ts'],
    coverage: {
      provider: 'v8',
      include: ['server/api/**/*.ts'],
      exclude: ['tests/**', 'server/api/health.get.ts', 'server/api/metrics.get.ts', '**/node_modules/**']
    },
    env: {
      SUPABASE_URL: 'https://dummy.supabase.co',
      SUPABASE_KEY: 'dummy-supabase-key',
      SUPABASE_SERVICE_KEY: 'dummy-supabase-service-key',
      NUXT_PUBLIC_SUPABASE_URL: 'https://dummy.supabase.co',
      NUXT_PUBLIC_SUPABASE_KEY: 'dummy-supabase-key',
      TEST_ENV: 'true'
    }
  }
})
