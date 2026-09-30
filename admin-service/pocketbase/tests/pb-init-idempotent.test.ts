import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

function read(path: string): string {
  return readFileSync(`${root}/${path}`, 'utf-8') as string
}

describe('idempotent PocketBase setup (task 1.6)', () => {
  it('never deletes collections in pb_init.js (non-destructive init)', () => {
    const source = read('pb_init.js')

    expect(source).not.toMatch(/collections\.delete/)

    expect(source).toContain('pb.collections.getOne(name)')
    expect(source).toContain('Skipping existing collection')
  })

  it('runs the test suite in run mode and reserves watch for test:watch', () => {
    const parsed: unknown = JSON.parse(read('package.json'))
    const scripts = typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)['scripts']
      : undefined

    expect(scripts && typeof scripts === 'object').toBe(true)
    const map = scripts as Record<string, unknown>

    expect(map['test']).toBe('vitest run')
    expect(map['test:watch']).toBe('vitest')
  })

  it('guards collection creation, seeding, field adds, and deletes in migrations', () => {
    const createdApps = read(
      'pb_migrations/1790784135_created_apps.js'
    )
    expect(createdApps).toContain('app.findCollectionByNameOrId("pbc_apps")')
    expect(createdApps).toContain('app.findFirstRecordByFilter')

    const updatedLinks = read('pb_migrations/1790784887_updated_links.js')
    expect(updatedLinks).toContain('collection.fields.getByName(name)')
    expect(updatedLinks).toContain('!collection.indexes.includes(appSlugIndex)')

    const deletedAnalytics = read('pb_migrations/1790783575_deleted_analytics_events.js')
    expect(deletedAnalytics).toContain('} catch {')
  })
})
