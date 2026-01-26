// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss'
  ],
  supabase: {
    redirect: false // Handling auth manually/conditionally if needed, or set to true for forced auth
  },
  nitro: {
    routeRules: {
      '/api/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      }
    }
  },
  runtimeConfig: {
    // Server-only env vars
    ipHashSalt: process.env.IP_HASH_SALT || 'default-salt',
    rateLimitSalt: process.env.RATE_LIMIT_SALT || 'default-salt',
    valkeyUrl: process.env.VALKEY_URL || process.env.REDIS_URL || 'redis://localhost:6379',
    logLevel: process.env.LOG_LEVEL || 'info',
    // Public env vars (exposed to client)
    public: {
      corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || ''
    }
  }
})
