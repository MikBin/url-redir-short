import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

const RULE_ASSIGNMENT =
  /"(listRule|viewRule|createRule|updateRule|deleteRule)"\s*:\s*([^,\n}]+)/g

const RULE_KEYS = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const

const SEEDED_APPS = [
  { appId: 'macrolattice', shareHost: 'sh.macrolattice.com', allowedHost: 'macrolattice.com', type: 'meal' },
  { appId: 'supatrainer', shareHost: 'sh.supatrainer.com', allowedHost: 'supatrainer.com', type: 'workout' },
  { appId: 'azurechip', shareHost: 'sh.azurechip.com', allowedHost: 'azurechip.com', type: 'screen' }
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function appsMigrationSource(): string {
  const file = readdirSync(`${root}/pb_migrations`).find((name) => name.endsWith('_created_apps.js'))
  if (!file) throw new Error('_created_apps.js migration is missing from pb_migrations')
  return readFileSync(`${root}/pb_migrations/${file}`, 'utf-8') as string
}

describe('apps registry (task 1.4)', () => {
  it('locks every apps collection rule (T0-only registry)', () => {
    const source = appsMigrationSource()

    const assignments = [...source.matchAll(RULE_ASSIGNMENT)]
    expect(assignments.length).toBeGreaterThan(0)

    for (const assignment of assignments) {
      const key = assignment[1] as string
      const value = assignment[2] as string
      expect(value.trim(), `apps ${key}`).toBe('null')
    }
  })

  it('seeds the three first-party apps with https templates on their allowed host', () => {
    const source = appsMigrationSource()

    for (const app of SEEDED_APPS) {
      expect(source, `seed row for ${app.appId}`).toContain(`"${app.appId}"`)
      expect(source).toContain(`"${app.shareHost}"`)
      expect(source).toContain(`"${app.allowedHost}"`)
      expect(source, `${app.appId} ${app.type} template`).toContain(
        `https://${app.allowedHost}/${app.type}/{contentId}`
      )
    }

    expect(source).toContain('record.set("daily_create_limit", 100)')
    expect(source).toContain('record.set("active", true)')
  })

  it('enforces unique registry keys', () => {
    const source = appsMigrationSource()

    expect(source).toContain('CREATE UNIQUE INDEX `idx_apps_app_id`')
    expect(source).toContain('CREATE UNIQUE INDEX `idx_apps_share_host`')
  })

  it('registers a locked apps collection in pb_schema.json', () => {
    const parsed: unknown = JSON.parse(readFileSync(`${root}/pb_schema.json`, 'utf-8'))

    const apps = Array.isArray(parsed)
      ? parsed.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry['name'] === 'apps')
      : undefined

    expect(apps, 'apps collection missing from pb_schema.json').toBeDefined()
    if (!apps) return

    for (const key of RULE_KEYS) {
      expect(apps[key], `pb_schema.json apps.${key}`).toBeNull()
    }
  })
})
