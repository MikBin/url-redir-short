import { describe, it, expect } from 'vitest'
import { parseCsv } from '../server/utils/csv-parser'

describe('csv-parser', () => {
  it('parses valid CSV correctly', () => {
    const csv = `slug,destination,code
link1,https://example.com,301
link2,https://example.org,302`

    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].slug).toBe('link1')
    expect(result.rows[0].destination).toBe('https://example.com')
    expect(result.rows[0].code).toBe(301)
  })

  it('handles missing required fields', () => {
    const csv = `slug,destination
,https://example.com
link2,`

    const result = parseCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].message).toContain('Missing required field: slug')
    expect(result.errors[1].message).toContain('Missing required field: destination')
  })

  it('handles optional fields like password and max_clicks', () => {
    const csv = `slug,destination,max_clicks,password
link1,https://example.com,100,secret123`

    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].max_clicks).toBe(100)
    expect(result.rows[0].password_protection?.enabled).toBe(true)
    expect(result.rows[0].password_protection?.password).toBe('secret123')
  })

  it('handles malformed CSV gracefully', () => {
    const csv = `slug,destination
link1,"https://example.com` // Unclosed quote

    const result = parseCsv(csv)

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain('CSV Parsing Error')
  })

  it('throws error when exceeding max rows', () => {
    const header = 'slug,destination\n'
    const row = 'link,https://example.com\n'
    // 10001 rows
    const csv = header + row.repeat(10001)

    const result = parseCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Exceeded maximum allowed rows')
  })
})
