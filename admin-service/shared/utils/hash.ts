import { createHash } from 'node:crypto'

/**
 * Anonymize an IP address by hashing it with an optional salt.
 * Uses SHA-256 for consistent, one-way anonymization.
 */
export function anonymizeIp(ip: string, salt: string = ''): string {
  return createHash('sha256')
    .update(ip + salt)
    .digest('hex')
}

/**
 * Extract a stable identifier from a user agent string.
 */
export function hashUserAgent(ua: string): string {
  return createHash('sha256')
    .update(ua)
    .digest('hex')
}
