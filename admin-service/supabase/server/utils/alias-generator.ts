import crypto from 'crypto'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateAlias(length: number = 7): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length]
  }
  return result
}

export async function generateUniqueAlias(checkExists: (slug: string) => Promise<boolean>, length: number = 7): Promise<string> {
  const MAX_RETRIES = 3

  for (let i = 0; i <= MAX_RETRIES; i++) {
    const alias = generateAlias(length)
    const exists = await checkExists(alias)
    if (!exists) {
      return alias
    }
  }

  throw new Error('Failed to generate a unique alias after maximum retries')
}
