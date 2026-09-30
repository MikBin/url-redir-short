import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateAppRow } from '../server/utils/registry'

const root = fileURLToPath(new URL('..', import.meta.url))

interface SeedRow {
  app_id: string
  share_host: string
  allowed_host: string
  url_template: Record<string, string>
  daily_create_limit: number
  active: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function seedRows(): unknown[] {
  const file = readdirSync(`${root}/pb_migrations`).find((name) => name.endsWith('_created_apps.js'))
  if (!file) throw new Error('_created_apps.js migration is missing from pb_migrations')

  const source = readFileSync(`${root}/pb_migrations/${file}`, 'utf-8') as string
  const match = source.match(/const SEED_JSON = '(.*)'/)
  if (!match?.[1]) throw new Error('SEED_JSON constant not found in the created_apps migration')

  const parsed: unknown = JSON.parse(match[1])
  return Array.isArray(parsed) ? parsed : []
}

const validRow = {
  app_id: 'macrolattice',
  share_host: 'sh.macrolattice.com',
  allowed_host: 'macrolattice.com',
  url_template: { meal: 'https://macrolattice.com/meal/{contentId}' },
  daily_create_limit: 100,
  active: true
}

describe('registry row validation (task 1.7)', () => {
  it('validates the exact seed rows embedded in the migration', () => {
    const rows = seedRows()
    expect(rows.length).toBe(3)

    for (const row of rows) {
      const result = validateAppRow(row)
      expect(result.success, JSON.stringify(result)).toBe(true)
    }

    const appIds = rows.filter(isRecord).map((row) => row['app_id'])
    expect(appIds).toEqual(['macrolattice', 'supatrainer', 'azurechip'])
  })

  it('accepts a well-formed row and defaults daily_create_limit to 100', () => {
    const { daily_create_limit: _omitted, ...withoutLimit } = validRow

    const result = validateAppRow(withoutLimit)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.daily_create_limit).toBe(100)
  })

  it('rejects malformed app ids', () => {
    for (const app_id of ['Macrolattice', 'macrolattice app', '1stapp', 'macrolattice-app', '']) {
      const result = validateAppRow({ ...validRow, app_id })
      expect(result.success, `app_id "${app_id}" must be rejected`).toBe(false)
    }
  })

  it('rejects invalid hostnames and a share_host equal to the allowed host', () => {
    for (const share_host of ['sh.macrolattice.com/', 'sh..macrolattice.com', '-sh.example.com', 'sh example.com']) {
      expect(validateAppRow({ ...validRow, share_host }).success, `share_host "${share_host}"`).toBe(false)
    }

    expect(validateAppRow({ ...validRow, share_host: 'macrolattice.com' }).success).toBe(false)
  })

  it('rejects templates that are not HTTPS on the allowed host or miss the placeholder', () => {
    const badTemplates: Array<Record<string, string>> = [
      { meal: `http://macrolattice.com/meal/{contentId}` },
      { meal: `https://evil.io/meal/{contentId}` },
      { meal: `https://macrolattice.com.evil.io/meal/{contentId}` },
      { meal: 'https://macrolattice.com/meal' },
      {}
    ]

    for (const url_template of badTemplates) {
      const result = validateAppRow({ ...validRow, url_template })
      expect(result.success, JSON.stringify(url_template)).toBe(false)
    }
  })

  it('rejects out-of-range or non-integer create limits and non-boolean active', () => {
    for (const daily_create_limit of [0, -1, 1.5, Number.MAX_SAFE_INTEGER * 2]) {
      expect(validateAppRow({ ...validRow, daily_create_limit }).success, `limit ${daily_create_limit}`).toBe(false)
    }

    expect(validateAppRow({ ...validRow, active: 'yes' }).success).toBe(false)

    const { active: _omitted, ...withoutActive } = validRow
    expect(validateAppRow(withoutActive).success).toBe(false)
  })
})

describe('seed row shape (task 1.7)', () => {
  it('keeps the migration seed fully populated', () => {
    for (const row of seedRows().filter(isRecord)) {
      expect(row['share_host']).toMatch(/^sh\./)
      expect(row['url_template']).toBeDefined()
      expect(row['daily_create_limit']).toBe(100)
      expect(row['active']).toBe(true)
    }
  })
})
