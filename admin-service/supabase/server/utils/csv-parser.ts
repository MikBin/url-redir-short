import { parse } from 'csv-parse/sync'

export interface LinkInput {
  slug: string
  destination: string
  code?: number
  expires_at?: string | null
  max_clicks?: number | null
  password_protection?: {
    enabled: boolean
    password?: string
  }
}

export interface ParseError {
  row: number
  message: string
}

export interface ParseResult {
  rows: LinkInput[]
  errors: ParseError[]
}

const MAX_ROWS = 10000

export function parseCsv(input: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [] }

  try {
    const records = parse(input, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    if (records.length > MAX_ROWS) {
      throw new Error(`Exceeded maximum allowed rows (${MAX_ROWS})`)
    }

    records.forEach((record: any, index: number) => {
      const rowNum = index + 2 // +1 for 0-index, +1 for header row

      // Validate required fields
      if (!record.slug) {
        result.errors.push({ row: rowNum, message: 'Missing required field: slug' })
        return
      }

      if (!record.destination) {
        result.errors.push({ row: rowNum, message: 'Missing required field: destination' })
        return
      }

      // Build valid input
      const link: LinkInput = {
        slug: record.slug,
        destination: record.destination
      }

      if (record.code) {
        const code = parseInt(record.code, 10)
        if (!isNaN(code)) link.code = code
      }

      if (record.expires_at) {
         link.expires_at = record.expires_at
      }

      if (record.max_clicks) {
         const clicks = parseInt(record.max_clicks, 10)
         if (!isNaN(clicks)) link.max_clicks = clicks
      }

      if (record.password) {
         link.password_protection = { enabled: true, password: record.password }
      }

      result.rows.push(link)
    })
  } catch (err: any) {
    result.errors.push({ row: 0, message: `CSV Parsing Error: ${err.message}` })
  }

  return result
}
