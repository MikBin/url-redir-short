/* eslint-disable */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import Redis from 'ioredis'
import RedisMock from 'ioredis-mock'

let redisClient: Redis | null = null

export const useValkey = () => {
  if (redisClient) return redisClient

  const config = useRuntimeConfig()

  // @ts-ignore - Nuxt runtime config typing
  const url = config.valkeyUrl || 'redis://localhost:6379'

  // Let's directly create a mock if in test env to avoid timeout and ECONNREFUSED issues
  if (process.env.TEST_ENV === 'true' || process.env.NODE_ENV === 'test') {
    if (!redisClient) {
       redisClient = new RedisMock() as unknown as Redis
    }
    return redisClient
  }

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
