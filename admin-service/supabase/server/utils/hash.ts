/**
 * FNV-1a 64-bit non-cryptographic hash function.
 * Optimized for speed and low collision rates for non-security-critical purposes.
 * returns a 16-character hex string.
 */
export function fnv1a64(str: string): string {
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}
