import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  sanitizePath,
  schemas,
  linkSchema,
  parseBody
} from '../server/utils/sanitizer'

describe('Sanitizer Utility', () => {
  it('should escape HTML tags correctly', () => {
    const input = '<script>alert("XSS")</script>'
    const output = sanitizeHtml(input)
    expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
  })

  it('should clean up path inputs', () => {
    const input = '../some/path//with<>"'
    const output = sanitizePath(input)
    expect(output).toBe('/some/path/with')
  })

  it('slug schema should reject invalid characters', () => {
    const result1 = schemas.slug.safeParse('valid-slug_123')
    expect(result1.success).toBe(true)

    const result2 = schemas.slug.safeParse('invalid slug!')
    expect(result2.success).toBe(false)
  })

  it('linkSchema should validate correctly', () => {
    const validLink = {
      slug: 'my-link',
      destination: 'https://example.com'
    }
    const result = linkSchema.safeParse(validLink)
    expect(result.success).toBe(true)
  })

  it('parseBody should parse correctly and throw on invalid', () => {
    const validBody = {
      slug: 'test',
      destination: 'https://test.com'
    }
    const parsed = parseBody(validBody, linkSchema)
    expect(parsed.slug).toBe('test')

    expect(() => parseBody({ slug: 'test' }, linkSchema)).toThrow()
  })
})
