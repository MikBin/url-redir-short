import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    env: {
      SUPABASE_URL: 'https://example.com',
      SUPABASE_KEY: 'some-random-key'
    },
    alias: {
      'ioredis': 'ioredis-mock'
    }
  }
})
