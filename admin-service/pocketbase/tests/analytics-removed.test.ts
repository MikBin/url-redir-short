import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|vue|js)$/.test(entry.name) ? [path] : []
  })
}

function readAll(dir: string): Array<[string, string]> {
  return sourceFiles(dir).map((path) => [path, readFileSync(path, 'utf-8') as string])
}

describe('analytics pipeline removal (task 1.3 / C5)', () => {
  it('drops analytics collections from pb_schema.json', () => {
    const parsed: unknown = JSON.parse(readFileSync(`${root}/pb_schema.json`, 'utf-8'))

    const names = Array.isArray(parsed)
      ? parsed.filter(isRecord).map((collection) => collection['name'])
      : []

    expect(names, 'analytics_events must not be re-added to pb_init source').not.toContain('analytics_events')
    expect(names).not.toContain('analytics_aggregates')
  })

  it('deletes the analytics_events collection via migration', () => {
    const migrations = readdirSync(`${root}/pb_migrations`)
    expect(
      migrations.some((file) => file.endsWith('_deleted_analytics_events.js')),
      'a deleted_analytics_events migration must stay in the chain'
    ).toBe(true)
  })

  it('removes the analytics endpoint tree and all references', () => {
    expect(existsSync(`${root}/server/api/analytics`)).toBe(false)

    const sources = [...readAll(`${root}/server`), ...readAll(`${root}/app`)]
    expect(sources.length).toBeGreaterThan(0)

    for (const [file, source] of sources) {
      expect(source, file).not.toContain('analytics_aggregates')
      expect(source, file).not.toContain('analytics_events')
      expect(source, file).not.toContain('api/analytics')
    }
  })
})
