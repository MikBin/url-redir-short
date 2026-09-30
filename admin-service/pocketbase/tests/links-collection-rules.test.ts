import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationsDir = fileURLToPath(new URL('../pb_migrations', import.meta.url))
const schemaPath = fileURLToPath(new URL('../pb_schema.json', import.meta.url))

const RULE_KEYS = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const

const RULE_ASSIGNMENT =
  /"(listRule|viewRule|createRule|updateRule|deleteRule)"\s*:\s*([^,\n}]+)/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function migrationSources(): Array<[string, string]> {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => [file, readFileSync(`${migrationsDir}/${file}`, 'utf-8') as string])
}

describe('links collection rules (task 1.1 / C1 fix)', () => {
  it('never contains the any-authenticated rule family in migrations', () => {
    for (const [file, source] of migrationSources()) {
      expect(source, file).not.toContain('@request.auth.id != ""')
    }
  })

  it('locks every rule in every migration touching the links collection', () => {
    for (const [file, source] of migrationSources()) {
      if (!source.includes('pbc_links')) continue

      for (const assignment of [...source.matchAll(RULE_ASSIGNMENT)]) {
        const key = assignment[1] as string
        const value = assignment[2] as string
        expect(value.trim(), `${file} must lock ${key}`).toBe('null')
      }
    }
  })

  it('ends the migration chain with an explicit lock on links', () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.js'))
    expect(
      files.some((file) => file.endsWith('_locked_links_rules.js')),
      'the terminal _locked_links_rules.js migration must stay in the chain'
    ).toBe(true)
  })

  it('locks every links rule in pb_schema.json (pb_init source of truth)', () => {
    const parsed: unknown = JSON.parse(readFileSync(schemaPath, 'utf-8'))

    const links = Array.isArray(parsed)
      ? parsed.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry['name'] === 'links')
      : undefined

    expect(links, 'links collection missing from pb_schema.json').toBeDefined()
    if (!links) return

    for (const key of RULE_KEYS) {
      expect(links[key], `pb_schema.json links.${key}`).toBeNull()
    }
  })
})
