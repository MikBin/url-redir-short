import { describe, it, expect } from 'vitest'
import { transformLink, SupabaseLink } from '../server/utils/transformer'

describe('Data Transformer', () => {
  it('should transform a basic link', () => {
    const link: SupabaseLink = {
      id: '123',
      slug: 'foo',
      destination: 'https://example.com',
      owner_id: 'user-1'
    }

    const rule = transformLink(link)

    expect(rule.id).toBe('123')
    expect(rule.path).toBe('/foo') // Should prepend /
    expect(rule.destination).toBe('https://example.com')
    expect(rule.code).toBe(301)
  })

  it('should handle optional fields', () => {
    const link: SupabaseLink = {
      id: '456',
      slug: '/bar',
      destination: 'https://bar.com',
      expires_at: '2023-12-31T23:59:59Z',
      max_clicks: 100,
      targeting: { enabled: true, rules: [] },
      hsts: { enabled: true },
      password_protection: { enabled: true, password: 'abc' }
    }

    const rule = transformLink(link)

    expect(rule.path).toBe('/bar')
    expect(rule.expiresAt).toBe(new Date('2023-12-31T23:59:59Z').getTime())
    expect(rule.maxClicks).toBe(100)
    expect(rule.targeting).toEqual(link.targeting)
    expect(rule.hsts).toEqual(link.hsts)
    expect(rule.password_protection).toEqual(link.password_protection)
  })

  it('should ignore invalid date', () => {
      const link: SupabaseLink = {
      id: '789',
      slug: 'baz',
      destination: 'http://baz.com',
      expires_at: 'invalid-date'
    }

    const rule = transformLink(link)
    expect(rule.expiresAt).toBeUndefined()
  })
})
