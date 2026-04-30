import { readFileSync } from 'fs'

function loadSecret(name: string, envFallback: string): string {
  const filePath = `/run/secrets/${name}`
  try {
    return readFileSync(filePath, 'utf-8').trim()
  } catch {
    const envValue = process.env[envFallback]
    if (!envValue) {
      throw new Error(`Secret "${name}" not found at ${filePath} and env ${envFallback} is not set`)
    }
    return envValue
  }
}

export default defineNitroPlugin((nitroApp) => {
  // Only enforce strict validation in production
  if (process.env.NODE_ENV === 'production') {
    const required = [
      { secret: 'pocketbase_url', envFallback: 'POCKETBASE_URL' },
      { secret: 'pocketbase_admin_email', envFallback: 'POCKETBASE_ADMIN_EMAIL' },
      { secret: 'pocketbase_admin_password', envFallback: 'POCKETBASE_ADMIN_PASSWORD' },
      { secret: 'sync_api_key', envFallback: 'SYNC_API_KEY' },
      { secret: 'ip_hash_salt', envFallback: 'IP_HASH_SALT' }
    ]

    const missing: string[] = []

    for (const { secret, envFallback } of required) {
      try {
        loadSecret(secret, envFallback)
      } catch {
        missing.push(secret)
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`)
    }
  }
})
