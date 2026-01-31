import Redis from 'ioredis'

let redisClient: Redis | null = null

export const useValkey = () => {
  if (redisClient) return redisClient

  const config = useRuntimeConfig()

  // In a real production app, we might want to handle reconnection strategies or clusters.
  // For now, a single connection instance is sufficient.

  // @ts-ignore - Nuxt runtime config typing
  const url = config.valkeyUrl || 'redis://localhost:6379'

  console.log(`Connecting to Valkey/Redis at ${url.replace(/:[^:@]*@/, ':***@')}`) // Redact password in logs

  redisClient = new Redis(url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    maxRetriesPerRequest: 3
  })

  redisClient.on('error', (err) => {
    console.error('Valkey/Redis connection error:', err)
  })

  redisClient.on('connect', () => {
    // console.log('Valkey/Redis connected')
  })

  return redisClient
}
