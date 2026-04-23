import { describe, it, expect } from 'vitest'
import { fnv1a64 } from '../server/utils/hash'

describe('Hash Utility', () => {
  it('should hash empty string consistently', () => {
    const hash1 = fnv1a64('')
    const hash2 = fnv1a64('')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(16)
  })

  it('should produce different hashes for different inputs', () => {
    const hash1 = fnv1a64('hello')
    const hash2 = fnv1a64('world')
    expect(hash1).not.toBe(hash2)
  })

  it('should produce consistent hashes for same input', () => {
    const hash1 = fnv1a64('hello world')
    const hash2 = fnv1a64('hello world')
    expect(hash1).toBe(hash2)
  })

  it('should return a 16-character hex string', () => {
    const hash = fnv1a64('test-string')
    expect(hash).toHaveLength(16)
    expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true)
  })
})
