import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup/env.ts'],
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
