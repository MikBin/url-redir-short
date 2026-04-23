import { z } from 'zod'

const envSchema = z.object({
  // Security
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  IP_HASH_SALT: z.string().default('default-salt'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SERVICE_NAME: z.string().default('pb-admin-service'),

  // PocketBase
  PB_URL: z.string().url().default('http://127.0.0.1:8090'),
})

// Parse and validate process.env
// We use safeParse to allow default values to kick in if env vars are missing
const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format())
  throw new Error('Invalid environment variables')
}

export const config = _env.data
