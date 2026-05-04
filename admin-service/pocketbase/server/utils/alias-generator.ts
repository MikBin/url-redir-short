import crypto from 'node:crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_LENGTH = CHARSET.length;

export function generateAlias(length: number = 7): string {
  let result = '';
  while (result.length < length) {
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < randomBytes.length; i++) {
      if (result.length < length) {
        // Use a simple modulo operation to pick a character from the charset
        const byte = randomBytes[i];
        if (byte !== undefined) {
           result += CHARSET[byte % CHARSET_LENGTH];
        }
      }
    }
  }
  return result;
}

export async function generateUniqueAlias(
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const alias = generateAlias();
    const exists = await checkExists(alias);

    if (!exists) {
      return alias;
    }
  }

  throw new Error(`Failed to generate a unique alias after ${maxRetries} attempts`);
}
