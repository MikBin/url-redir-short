import { spawn, spawnSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Task 2.10: end-to-end journey over a fresh PocketBase — the whole §2
// pipeline exercised as one narrative against the real binary:
// create → PB record → host-keyed KV key → resolve returns the destination,
// plus the rejection status-code matrix (403 Turnstile / 429 quota /
// 503 breaker) with zero side effects, and the read path staying alive
// while the create kill switch is tripped (the local analog of "clicks
// unaffected": resolve is the click path's fallback source).

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationsDir = join(root, 'pb_migrations')
const hooksDir = join(root, 'pb_hooks')

const SUPERUSER_EMAIL = 'ci-e2e@example.com'
const SUPERUSER_PASSWORD = 'ci-e2e-password'

const APP_ORIGIN = 'https://macrolattice.com'
const TURNSTILE_SECRET = 'e2e-turnstile-secret'
const VALID_TOKEN = 'e2e-valid-token'
const INVALID_TOKEN = 'e2e-invalid-token'

const IP_HASH_SALT = 'ci-e2e-salt'
const JOURNEY_IP = '203.0.113.120'
const QUOTA_IP = '203.0.113.121'
const BREAKER_IP = '203.0.113.122'
const RESOLVE_IP = '203.0.113.123'

const RESOLVE_SECRET = 'e2e-resolve-secret'
const RESOLVE_RATE_LIMIT_PER_MINUTE = '60'

const CF_ACCOUNT_ID = 'e2e-account'
const CF_NAMESPACE_ID = 'e2e-namespace'
const CF_API_TOKEN = 'e2e-kv-token'

interface SiteverifyCall {
  response?: string
}

const siteverifyCalls: SiteverifyCall[] = []

const siteverifyServer = createServer((request, response) => {
  let body = ''
  request.on('data', (chunk: Buffer) => {
    body += chunk.toString('utf8')
  })
  request.on('end', () => {
    let payload: SiteverifyCall
    try {
      payload = JSON.parse(body) as SiteverifyCall
    } catch {
      payload = {}
    }
    siteverifyCalls.push(payload)

    response.setHeader('Content-Type', 'application/json')
    response.statusCode = 200
    response.end(
      JSON.stringify({
        success: payload.response === VALID_TOKEN,
        'error-codes': payload.response === VALID_TOKEN ? [] : ['invalid-input-response']
      })
    )
  })
})

interface KVApiCall {
  method: string
  url: string
  body: string | null
}

const kvCalls: KVApiCall[] = []

const kvApiServer = createServer((request, response) => {
  let body: string | null = null
  request.on('data', (chunk: Buffer) => {
    body = `${body ?? ''}${chunk.toString('utf8')}`
  })
  request.on('end', () => {
    kvCalls.push({
      method: request.method ?? '',
      url: request.url ?? '',
      body
    })

    response.setHeader('Content-Type', 'application/json')
    response.statusCode = 200
    response.end(JSON.stringify({ success: true }))
  })
})

interface CreateResponse {
  url?: string
  slug?: string
  created?: boolean
}

interface ResolveResponse {
  destination?: string
  code?: number
}

interface AuthResponse {
  token: string
}

interface AppRecord {
  id: string
  daily_create_limit: number
}

interface AppList {
  items: AppRecord[]
}

interface LinkRecord {
  id: string
  slug: string
  app?: string
  content_ref?: Record<string, unknown>
  created_from_ip?: string
  destination_url?: string
  is_active?: boolean
}

interface LinkList {
  items: LinkRecord[]
  totalItems: number
}

interface SystemConfigRecord {
  id: string
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

function run(bin: string, args: string[]): { status: number | null; output: string } {
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

describe.skipIf(binary === null)('live share E2E journey (task 2.10)', () => {
  let dataDir = ''
  let baseUrl = ''
  let superuserToken = ''
  let serverProcess: ReturnType<typeof spawn> | null = null
  let serverOutput = ''

  // Journey state, threaded through the sequential `it` blocks.
  let createdSlug = ''
  let createdUrl = ''
  let createdDestination = ''

  const trackServerOutput = (chunk: Buffer): void => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-4000)
  }

  const serverLog = (): string => serverOutput

  const hashIp = (ip: string): string => createHmac('sha256', IP_HASH_SALT).update(ip).digest('hex')

  const superuserHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: superuserToken
  })

  const postCreate = (
    body: Record<string, unknown>,
    options: { token?: string | null; ip?: string; origin?: string } = {}
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': options.ip ?? JOURNEY_IP
    }
    if (options.origin !== undefined) headers['Origin'] = options.origin
    const payload =
      options.token === null ? body : { ...body, turnstileToken: options.token ?? VALID_TOKEN }
    return fetch(`${baseUrl}/api/share/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
  }

  const getResolve = (
    host: string,
    path: string,
    options: { auth?: string; ip?: string } = {}
  ): Promise<Response> => {
    const params = new URLSearchParams({ host, path })
    const headers: Record<string, string> = {
      Authorization: options.auth ?? `Bearer ${RESOLVE_SECRET}`,
      'CF-Connecting-IP': options.ip ?? RESOLVE_IP
    }
    return fetch(`${baseUrl}/api/share/resolve?${params.toString()}`, { headers })
  }

  const findApp = async (appId: string): Promise<AppRecord> => {
    const filter = encodeURIComponent(`app_id='${appId}'`)
    const response = await fetch(
      `${baseUrl}/api/collections/apps/records?perPage=1&filter=${filter}`,
      { headers: { Authorization: superuserToken } }
    )
    const list = await readJsonBody<AppList>(response)
    const app = list.items[0]
    if (app === undefined) throw new Error(`App ${appId} was not seeded`)
    return app
  }

  const setDailyCreateLimit = async (appRecordId: string, limit: number): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/collections/apps/records/${appRecordId}`, {
      method: 'PATCH',
      headers: superuserHeaders(),
      body: JSON.stringify({ daily_create_limit: limit })
    })
    await readJsonBody<unknown>(response)
  }

  const findLinkBySlug = async (slug: string): Promise<LinkRecord> => {
    const filter = encodeURIComponent(`slug='${slug}'`)
    const response = await fetch(`${baseUrl}/api/collections/links/records?perPage=1&filter=${filter}`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<LinkList>(response)
    const record = list.items[0]
    if (record === undefined) throw new Error(`Link '${slug}' was not found`)
    return record
  }

  const countLinks = async (): Promise<number> => {
    const response = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<LinkList>(response)
    return list.totalItems
  }

  const findBreakerRecord = async (): Promise<SystemConfigRecord> => {
    const filter = encodeURIComponent("key='public_creation_paused'")
    const response = await fetch(
      `${baseUrl}/api/collections/system_config/records?perPage=1&filter=${filter}`,
      { headers: { Authorization: superuserToken } }
    )
    const list = await readJsonBody<SystemConfigList>(response)
    const record = list.items[0]
    if (record === undefined) throw new Error('system_config breaker row was not seeded')
    return record
  }

  const setBreakerFlag = async (value: unknown): Promise<void> => {
    const record = await findBreakerRecord()
    const response = await fetch(`${baseUrl}/api/collections/system_config/records/${record.id}`, {
      method: 'PATCH',
      headers: superuserHeaders(),
      body: JSON.stringify({ value })
    })
    await readJsonBody<unknown>(response)
  }

  const kvPutsForKey = (key: string): KVApiCall[] =>
    kvCalls.filter(
      (call) => call.method === 'PUT' && call.url.includes(encodeURIComponent(key))
    )

  beforeAll(async () => {
    const pb = requireBinary()

    dataDir = mkdtempSync(join(tmpdir(), 'pb-e2e-'))

    const migrated = run(pb, ['migrate', 'up', `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`])
    expect(migrated.status, migrated.output).toBe(0)

    const superuser = run(pb, [
      'superuser',
      'create',
      SUPERUSER_EMAIL,
      SUPERUSER_PASSWORD,
      `--dir=${dataDir}`
    ])
    expect(superuser.status, superuser.output).toBe(0)

    await new Promise<void>((resolve) => siteverifyServer.listen(0, '127.0.0.1', resolve))
    const siteverifyAddress = siteverifyServer.address() as AddressInfo
    const siteverifyUrl = `http://127.0.0.1:${siteverifyAddress.port}/turnstile/v0/siteverify`

    await new Promise<void>((resolve) => kvApiServer.listen(0, '127.0.0.1', resolve))
    const kvApiAddress = kvApiServer.address() as AddressInfo
    const kvApiUrl = `http://127.0.0.1:${kvApiAddress.port}/client/v4`

    const port = 26000 + Math.floor(Math.random() * 2000)
    baseUrl = `http://127.0.0.1:${port}`
    serverProcess = spawn(
      pb,
      [
        'serve',
        `--http=127.0.0.1:${port}`,
        `--dir=${dataDir}`,
        `--migrationsDir=${migrationsDir}`,
        `--hooksDir=${hooksDir}`
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TURNSTILE_SECRET,
          TURNSTILE_VERIFY_URL: siteverifyUrl,
          IP_HASH_SALT,
          CF_ACCOUNT_ID,
          CF_KV_NAMESPACE_ID: CF_NAMESPACE_ID,
          CF_API_TOKEN,
          CF_KV_API_URL: kvApiUrl,
          WORKER_RESOLVE_SECRET: RESOLVE_SECRET,
          RESOLVE_RATE_LIMIT_PER_MINUTE
        }
      }
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
    superuserToken = auth.token
  }, 120_000)

  afterAll(async () => {
    serverProcess?.kill()
    await new Promise<void>((resolve) => siteverifyServer.close(() => resolve()))
    await new Promise<void>((resolve) => kvApiServer.close(() => resolve()))
    if (dataDir.length > 0) {
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
  })

  it('creates a short link from a content reference and returns the short URL', async () => {
    const response = await postCreate(
      { appId: 'macrolattice', type: 'meal', contentId: 'e2e_01', params: { week: 2 } },
      { origin: APP_ORIGIN }
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN)

    const payload = (await response.json()) as CreateResponse
    expect(payload.created).toBe(true)
    expect(payload.slug).toMatch(/^[A-Za-z0-9]{7}$/)
    expect(payload.url).toBe(`https://sh.macrolattice.com/${payload.slug}`)

    createdSlug = payload.slug ?? ''
    createdUrl = payload.url ?? ''
    createdDestination = 'https://macrolattice.com/meal/e2e_01'
  })

  it('persists the PocketBase record with the hashed IP and content reference', async () => {
    const record = await findLinkBySlug(createdSlug)

    expect(record.destination_url).toBe(createdDestination)
    expect(record.created_from_ip).toBe(hashIp(JOURNEY_IP))
    expect(record.created_from_ip).not.toBe(JOURNEY_IP)
    expect(record.content_ref).toEqual({
      appId: 'macrolattice',
      type: 'meal',
      contentId: 'e2e_01',
      params: { week: 2 }
    })
    expect(record.is_active).toBe(true)
    expect(record.app).toEqual(expect.any(String))
  })

  it('publishes the host-keyed KV entry carrying the RedirectRule value', async () => {
    const expectedKey = `sh.macrolattice.com:/${createdSlug}`
    const puts = kvPutsForKey(expectedKey)

    expect(puts).toHaveLength(1)
    expect(puts[0]?.url).toContain('/accounts/e2e-account/storage/kv/namespaces/e2e-namespace/values/')

    const value = JSON.parse(puts[0]?.body ?? '{}') as Record<string, unknown>
    expect(value.id).toEqual(expect.any(String))
    expect(value.path).toBe(`/${createdSlug}`)
    expect(value.destination).toBe(createdDestination)
    expect(value.code).toBe(302)
    expect(value.isActive).toBe(true)
  })

  it('resolves the fresh link back to its destination (read-through source)', async () => {
    const response = await getResolve('sh.macrolattice.com', `/${createdSlug}`)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const payload = (await response.json()) as ResolveResponse
    expect(payload.destination).toBe(createdDestination)
    expect(payload.code).toBe(302)
  })

  it('returns the existing short URL on a repeat with no new record or KV publish', async () => {
    const linksBefore = await countLinks()
    const putsBefore = kvPutsForKey(`sh.macrolattice.com:/${createdSlug}`).length

    const response = await postCreate(
      { appId: 'macrolattice', type: 'meal', contentId: 'e2e_01', params: { week: 2 } },
      { origin: APP_ORIGIN }
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as CreateResponse
    expect(payload.created).toBe(false)
    expect(payload.url).toBe(createdUrl)
    expect(payload.slug).toBe(createdSlug)

    expect(await countLinks()).toBe(linksBefore)
    expect(kvPutsForKey(`sh.macrolattice.com:/${createdSlug}`)).toHaveLength(putsBefore)
  })

  it('rejects creates with 403 when the Turnstile token is missing or invalid', async () => {
    const linksBefore = await countLinks()

    const missing = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_403a' }, {
      token: null,
      origin: APP_ORIGIN
    })
    expect(missing.status).toBe(403)
    expect(((await missing.json()) as { code?: string }).code).toBe('turnstile_missing')

    const invalid = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_403b' }, {
      token: INVALID_TOKEN,
      origin: APP_ORIGIN
    })
    expect(invalid.status).toBe(403)
    expect(((await invalid.json()) as { code?: string }).code).toBe('turnstile_failed')

    expect(await countLinks()).toBe(linksBefore)
  })

  it('rejects creates with 429 once the per-IP daily quota is exhausted', async () => {
    const app = await findApp('macrolattice')
    await setDailyCreateLimit(app.id, 1)

    const linksBefore = await countLinks()

    const first = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_429a' }, {
      ip: QUOTA_IP,
      origin: APP_ORIGIN
    })
    expect(first.status).toBe(201)

    const second = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_429b' }, {
      ip: QUOTA_IP,
      origin: APP_ORIGIN
    })
    expect(second.status).toBe(429)

    const payload = (await second.json()) as {
      code?: string
      limit?: number
      used?: number
      resetAt?: string
    }
    expect(payload.code).toBe('quota_exceeded')
    expect(payload.limit).toBe(1)
    expect(payload.used).toBe(1)
    expect(payload.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0)

    // The rejected create stored nothing: only the first link landed.
    expect(await countLinks()).toBe(linksBefore + 1)
  })

  it('rejects creates with 503 while the breaker is paused and resumes after reset', async () => {
    const linksBefore = await countLinks()
    siteverifyCalls.length = 0

    await setBreakerFlag(true)

    const paused = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_503a' }, {
      ip: BREAKER_IP,
      origin: APP_ORIGIN
    })
    expect(paused.status).toBe(503)
    expect(((await paused.json()) as { code?: string }).code).toBe('creation_paused')
    // The kill switch sheds load before the Turnstile gate: no siteverify call.
    expect(siteverifyCalls).toHaveLength(0)
    expect(await countLinks()).toBe(linksBefore)

    await setBreakerFlag(false)

    const resumed = await postCreate({ appId: 'macrolattice', type: 'meal', contentId: 'e2e_503b' }, {
      ip: BREAKER_IP,
      origin: APP_ORIGIN
    })
    expect(resumed.status).toBe(201)
    expect(await countLinks()).toBe(linksBefore + 1)
  })

  it('keeps the read path alive while the breaker is paused', async () => {
    await setBreakerFlag(true)
    try {
      const response = await getResolve('sh.macrolattice.com', `/${createdSlug}`)
      expect(response.status).toBe(200)
      expect(((await response.json()) as ResolveResponse).destination).toBe(createdDestination)
    } finally {
      await setBreakerFlag(false)
    }
    expect((await findBreakerRecord()).value).toBe(false)
  })
})
