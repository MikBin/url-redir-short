import { describe, it, expect } from 'vitest'
import { validateBulkLinks } from '../server/utils/bulk'

describe('Bulk Import Utility', () => {
  it('should validate correct links', () => {
    const input = [
      { slug: 'link1', destination: 'https://example.com/1' },
      { slug: 'link2', destination: 'https://example.com/2' }
    ]
    const { valid, invalid } = validateBulkLinks(input)
    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(0)
    expect(valid[0].slug).toBe('link1')
  })

  it('should filter invalid links', () => {
    const input = [
      { slug: 'link1', destination: 'https://example.com/1' },
      { slug: '', destination: 'https://example.com/2' }, // empty slug
      { slug: 'link3', destination: '' }, // empty destination
      { slug: 123, destination: 'https://example.com/4' }, // invalid type
      {} // empty object
    ]
    const { valid, invalid } = validateBulkLinks(input)
    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(4)
  })

  it('should trim inputs', () => {
    const input = [
        { slug: ' link1 ', destination: ' https://example.com/1 ' }
    ]
    const { valid } = validateBulkLinks(input)
    expect(valid[0].slug).toBe('link1')
    expect(valid[0].destination).toBe('https://example.com/1')
  })

  it('should throw error if input is not array', () => {
      expect(() => validateBulkLinks(null as any)).toThrow('Input must be an array')
  })
})
