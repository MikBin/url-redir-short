import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationsDir = join(root, 'pb_migrations')

const SUPERUSER_EMAIL = 'ci-verification@example.com'
const SUPERUSER_PASSWORD = 'ci-verification-password'

const LINK_FIELDS = ['app', 'content_ref', 'destination_url', 'last_click_at', 'created_from_ip', 'created']

const SEEDED_APP_IDS = ['macrolattice', 'supatrainer', 'azurechip']

interface CommandResult {
  status: number | null
  output: string
}

interface CollectionInfo {
  fields: Array<{ name: string; required?: boolean }>
  indexes: string[]
  listRule: string | null
  viewRule: string | null
  createRule: string | null
  updateRule: string | null
  deleteRule: string | null
}

interface ListResponse<T> {
  items: T[]
}

interface AppRecord {
  app_id: string
  daily_create_limit: number
  active: boolean
}

interface AuthResponse {
  token: string
}

interface SystemConfigRecord {
  key: string
  value: unknown
}

interface SystemConfigList {
  items: SystemConfigRecord[]
}

function resolveBinary(): string | null {
  const candidate = process.env['POCKETBASE_BIN']?.trim() || 'pocketbase'
  const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
  return probe.status === 0 ? candidate : null
}

function requireBinary(): string {
  const candidate = resolveBinary()
  if (candidate === null) {
    throw new Error('PocketBase binary not found: set POCKETBASE_BIN or add pocketbase to PATH')
  }
  return candidate
}

function run(bin: string, args: string[]): CommandResult {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

async function waitForHealth(baseUrl: string, serverLog: () => string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`PocketBase did not become healthy within ${timeoutMs}ms:\n${serverLog()}`)
}

async function readJsonBody<T>(response: Response): Promise<T> {
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Unexpected HTTP ${response.status} from ${response.url}: ${body.slice(0, 500)}`)
  }
  return JSON.parse(body) as T
}

const binary = resolveBinary()

describe.skipIf(binary === null)('live PocketBase migration chain (task 1.6 behavioral gate)', () => {
  let dataDir = ''
  let baseUrl = ''
  let authToken = ''
  let serverProcess: ReturnType<typeof spawn> | null = null
  let serverOutput = ''

  const trackServerOutput = (chunk: Buffer): void => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-4000)
  }

  const serverLog = (): string => serverOutput

  beforeAll(async () => {
    const pb = requireBinary()

    dataDir = mkdtempSync(join(tmpdir(), 'pb-live-'))

    const firstRun = run(pb, ['migrate', 'up', `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`])
    expect(firstRun.status, firstRun.output).toBe(0)
    expect(firstRun.output).not.toContain('Error')

    const secondRun = run(pb, ['migrate', 'up', `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`])
    expect(secondRun.status, secondRun.output).toBe(0)
    expect(secondRun.output).toContain('No new migrations to apply.')

    const superuser = run(pb, [
      'superuser',
      'create',
      SUPERUSER_EMAIL,
      SUPERUSER_PASSWORD,
      `--dir=${dataDir}`
    ])
    expect(superuser.status, superuser.output).toBe(0)

    const port = 20000 + Math.floor(Math.random() * 10000)
    baseUrl = `http://127.0.0.1:${port}`
    serverProcess = spawn(
      pb,
      ['serve', `--http=127.0.0.1:${port}`, `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    serverProcess.stdout?.on('data', trackServerOutput)
    serverProcess.stderr?.on('data', trackServerOutput)

    await waitForHealth(baseUrl, serverLog, 30_000)

    const authResponse = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD })
    })
    const auth = await readJsonBody<AuthResponse>(authResponse)
    authToken = auth.token
  }, 120_000)

  afterAll(() => {
    serverProcess?.kill()
    if (dataDir.length > 0) {
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
  })

  it('serves healthy after the fresh migration run', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    expect(response.status).toBe(200)
  })

  it('adds the share-pivot fields and the per-app slug index to links', async () => {
    const response = await fetch(`${baseUrl}/api/collections/links`, {
      headers: { Authorization: authToken }
    })
    const collection = await readJsonBody<CollectionInfo>(response)

    const fieldNames = collection.fields.map((field) => field.name)
    for (const field of LINK_FIELDS) {
      expect(fieldNames, `links.${field}`).toContain(field)
    }
    expect(collection.indexes.some((index) => index.includes('idx_links_app_slug'))).toBe(true)
  })

  it('relaxes legacy required fields for anonymous creates (task 2.9)', async () => {
    const response = await fetch(`${baseUrl}/api/collections/links`, {
      headers: { Authorization: authToken }
    })
    const collection = await readJsonBody<CollectionInfo>(response)

    const field = (name: string) => collection.fields.find((entry) => entry.name === name)
    // Anonymous share creates carry no legacy owner and write destination_url,
    // so the pre-pivot required flags must be off; slug stays mandatory.
    expect(field('destination')?.required).toBe(false)
    expect(field('owner_id')?.required).toBe(false)
    expect(field('slug')?.required).toBe(true)
  })

  it('locks all five links rules for anonymous and non-superuser access', async () => {
    const response = await fetch(`${baseUrl}/api/collections/links`, {
      headers: { Authorization: authToken }
    })
    const collection = await readJsonBody<CollectionInfo>(response)

    expect(collection.listRule).toBeNull()
    expect(collection.viewRule).toBeNull()
    expect(collection.createRule).toBeNull()
    expect(collection.updateRule).toBeNull()
    expect(collection.deleteRule).toBeNull()
  })

  it('seeds the three first-party apps from the migration', async () => {
    const response = await fetch(`${baseUrl}/api/collections/apps/records?perPage=50`, {
      headers: { Authorization: authToken }
    })
    const list = await readJsonBody<ListResponse<AppRecord>>(response)

    expect(list.items.map((record) => record.app_id).sort()).toEqual([...SEEDED_APP_IDS].sort())
    for (const record of list.items) {
      expect(record.active).toBe(true)
      expect(record.daily_create_limit).toBe(100)
    }
  })

  it('creates the locked system_config collection with the breaker flag off (task 2.5)', async () => {
    const collectionResponse = await fetch(`${baseUrl}/api/collections/system_config`, {
      headers: { Authorization: authToken }
    })
    const collection = await readJsonBody<CollectionInfo>(collectionResponse)

    for (const field of ['key', 'value', 'created', 'updated']) {
      expect(collection.fields.map((entry) => entry.name), `system_config.${field}`).toContain(field)
    }
    expect(collection.listRule).toBeNull()
    expect(collection.viewRule).toBeNull()
    expect(collection.createRule).toBeNull()
    expect(collection.updateRule).toBeNull()
    expect(collection.deleteRule).toBeNull()

    const recordsResponse = await fetch(`${baseUrl}/api/collections/system_config/records?perPage=50`, {
      headers: { Authorization: authToken }
    })
    const records = await readJsonBody<SystemConfigList>(recordsResponse)
    expect(records.items).toHaveLength(1)
    expect(records.items[0]?.key).toBe('public_creation_paused')
    expect(records.items[0]?.value).toBe(false)

    const anonymous = await fetch(`${baseUrl}/api/collections/system_config/records?perPage=1`)
    expect(anonymous.status).toBe(403)
  })

  it('rejects anonymous listing of links (locked rules, fail closed)', async () => {
    const response = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`)
    expect(response.status).toBe(403)
  })

  it('rejects anonymous creation of links (locked rules, fail closed)', async () => {
    const response = await fetch(`${baseUrl}/api/collections/links/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'anon-attempt', destination: 'https://macrolattice.com/meal/1' })
    })
    expect(response.status).toBe(403)
  })
})
