import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

const NEW_FIELDS = ['app', 'content_ref', 'destination_url', 'last_click_at', 'created_from_ip']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const UPDATED_LINKS_FILE = '1790784887_updated_links.js'
const CREATED_APPS_FILE = '1790784135_created_apps.js'

function migrationSource(file: string): string {
  const entries = readdirSync(`${root}/pb_migrations`)
  if (!entries.includes(file)) throw new Error(`${file} migration is missing from pb_migrations`)
  return readFileSync(`${root}/pb_migrations/${file}`, 'utf-8') as string
}

describe('links extension (task 1.5)', () => {
  it('adds the five share-pivot fields after the apps registry exists', () => {
    const createdAppsTs = Number(CREATED_APPS_FILE.split('_')[0])
    const updatedLinksTs = Number(UPDATED_LINKS_FILE.split('_')[0])

    expect(updatedLinksTs, 'apps must be created before links reference it').toBeGreaterThan(createdAppsTs)
  })

  it('adds app relation, content_ref, destination_url, last_click_at, created_from_ip', () => {
    const source = migrationSource(UPDATED_LINKS_FILE)

    for (const field of NEW_FIELDS) {
      expect(source, `field ${field}`).toContain(`"name": "${field}"`)
    }

    expect(source).toContain('"collectionId": "pbc_apps"')
  })

  it('scopes slug uniqueness per app', () => {
    const source = migrationSource(UPDATED_LINKS_FILE)

    expect(source).toContain('CREATE UNIQUE INDEX `idx_links_app_slug` ON `links` (`app`, `slug`)')
  })

  it('is idempotent — fields and index are only added when absent', () => {
    const source = migrationSource(UPDATED_LINKS_FILE)

    expect(source).toContain('collection.fields.getByName(name)')
    expect(source).toContain('!collection.indexes.includes(appSlugIndex)')
  })

  it('registers the new fields in pb_schema.json with nullable expiry/click dates', () => {
    const parsed: unknown = JSON.parse(readFileSync(`${root}/pb_schema.json`, 'utf-8'))

    const links = Array.isArray(parsed)
      ? parsed.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry['name'] === 'links')
      : undefined

    expect(links, 'links collection missing from pb_schema.json').toBeDefined()
    if (!links) return

    const fields = Array.isArray(links['fields']) ? links['fields'] : []
    const names = fields.filter(isRecord).map((field) => field['name'])

    for (const field of [...NEW_FIELDS, 'expires_at']) {
      expect(names, `pb_schema.json links.${field}`).toContain(field)
    }
  })
})
