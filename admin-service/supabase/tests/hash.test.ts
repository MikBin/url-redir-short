import { describe, it, expect } from 'vitest'
import { fnv1a64 } from '../server/utils/hash'

describe('FNV-1a 64-bit Hash', () => {
  it('should return a 16-character hex string', () => {
    const hash = fnv1a64('test-input')
    expect(hash).toHaveLength(16)
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('should be deterministic', () => {
    const input = 'consistent-input'
    expect(fnv1a64(input)).toBe(fnv1a64(input))
  })

  it('should handle empty string', () => {
    const hash = fnv1a64('')
    // FNV offset basis for 64-bit: cbf29ce484222325
    expect(hash).toBe('cbf29ce484222325')
  })

  it('should handle unicode characters', () => {
    const hash = fnv1a64('🔥')
    expect(hash).toHaveLength(16)
  })
})
