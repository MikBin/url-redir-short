import { spawn, spawnSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationsDir = join(root, 'pb_migrations')
const hooksDir = join(root, 'pb_hooks')

const SUPERUSER_EMAIL = 'ci-share-create@example.com'
const SUPERUSER_PASSWORD = 'ci-share-create-password'

const APP_ORIGINS = ['https://macrolattice.com', 'https://supatrainer.com', 'https://azurechip.com']
const DISALLOWED_ORIGIN = 'https://evil.example'

const TURNSTILE_SECRET = 'test-turnstile-secret'
const VALID_TOKEN = 'test-valid-token'
const INVALID_TOKEN = 'test-invalid-token'
const REPLAY_TOKEN = 'test-replay-token'
const UNAVAILABLE_TOKEN = 'test-unavailable-token'
const REMOTE_IP_TOKEN = 'test-remote-ip-token'
const REMOTE_IP = '203.0.113.7'

const IP_HASH_SALT = 'ci-share-quota-salt'
const DEFAULT_IP = '198.51.100.10'
const QUOTA_IP = '198.51.100.77'
const QUOTA_IP_2 = '198.51.100.78'
const QUOTA_OWNER_EMAIL = 'ci-share-owner@example.com'
const QUOTA_OWNER_PASSWORD = 'ci-share-owner-password'

const BREAKER_MULTIPLIER = '2'
const BREAKER_THRESHOLD = 2 * 10
const BREAKER_SEEDED_LINKS = 30

const VALID_REFERENCE = {
  appId: 'macrolattice',
  type: 'meal',
  contentId: 'r_8f3k',
  params: { week: 3 }
}

interface SiteverifyPayload {
  secret?: string
  response?: string
  remoteip?: string
}

const siteverifyCalls: SiteverifyPayload[] = []

const siteverifyServer = createServer((request, response) => {
  let body = ''
  request.on('data', (chunk: Buffer) => {
    body += chunk.toString('utf8')
  })
  request.on('end', () => {
    let payload: SiteverifyPayload
    try {
      payload = JSON.parse(body) as SiteverifyPayload
    } catch {
      payload = {}
    }
    siteverifyCalls.push(payload)

    response.setHeader('Content-Type', 'application/json')
    if (payload.response === UNAVAILABLE_TOKEN) {
      response.statusCode = 500
      response.end(JSON.stringify({ error: 'upstream unavailable' }))
      return
    }
    if (payload.response === VALID_TOKEN) {
      response.statusCode = 200
      response.end(JSON.stringify({ success: true, hostname: 'macrolattice.com' }))
      return
    }

    response.statusCode = 200
    response.end(
      JSON.stringify({
        success: false,
        'error-codes': [payload.response === REPLAY_TOKEN ? 'timeout-or-duplicate' : 'invalid-input-response']
      })
    )
  })
})

// Task 2.7: hermetic KV API mock. Keys containing `kvfail` fail with a 500 so
// the failure path (warn log + counter, record survives) is provable locally.
const CF_ACCOUNT_ID = 'ci-account'
const CF_NAMESPACE_ID = 'ci-namespace'
const CF_API_TOKEN = 'ci-kv-token'

interface KVApiCall {
  method: string
  url: string
  authorization: string | null
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
      authorization: request.headers.authorization ?? null,
      body
    })

    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'PUT' && (request.url ?? '').includes('kvfail')) {
      response.statusCode = 500
      response.end(JSON.stringify({ errors: [{ code: 10000, message: 'injected KV failure' }] }))
      return
    }
    response.statusCode = 200
    response.end(JSON.stringify({ success: true }))
  })
})

function createBody(reference: unknown, token: string | null = VALID_TOKEN): string {
  if (token === null) return JSON.stringify(reference)
  return JSON.stringify({ ...(reference as Record<string, unknown>), turnstileToken: token })
}

interface CommandResult {
  status: number | null
  output: string
}

interface ErrorPayload {
  code?: string
  reason?: string
  message?: string
  status?: number
  fields?: Array<{ field: string; message: string }>
  limit?: number
  used?: number
  resetAt?: string
}

interface RecordList {
  totalItems: number
}

interface AppList {
  items: Array<{ id: string; daily_create_limit: number }>
}

interface IdResponse {
  id: string
}

interface AuthResponse {
  token: string
}

interface SystemConfigRecord {
  id: string
  key: string
  value: unknown
}

interface SystemConfigList {
  items: SystemConfigRecord[]
}

interface CronJob {
  id: string
  expression: string
}

interface LogRecord {
  id: string
  message: string
}

interface LogList {
  items: LogRecord[]
}

interface KVFailureLogData {
  code?: string
  status?: string | number
  contextId?: string
  metrics?: string
}

interface KVFailureLogRecord {
  id: string
  message: string
  data?: KVFailureLogData
}

interface KVFailureLogList {
  items: KVFailureLogRecord[]
}

interface LinkRecord {
  id: string
  slug: string
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

describe.skipIf(binary === null)('live share/create route (tasks 2.1-2.7)', () => {
  let dataDir = ''
  let baseUrl = ''
  let superuserToken = ''
  let quotaOwnerId: string | null = null
  let serverProcess: ReturnType<typeof spawn> | null = null
  let serverOutput = ''

  const trackServerOutput = (chunk: Buffer): void => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-4000)
  }

  const serverLog = (): string => serverOutput

  const postCreate = (
    body: string,
    origin?: string,
    extraHeaders: Record<string, string> = {}
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': DEFAULT_IP,
      ...extraHeaders
    }
    if (origin !== undefined) headers['Origin'] = origin
    return fetch(`${baseUrl}/api/share/create`, { method: 'POST', headers, body })
  }

  const preflight = (origin: string): Promise<Response> =>
    fetch(`${baseUrl}/api/share/create`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    })

  const errorPayload = async (response: Response): Promise<ErrorPayload> =>
    (await response.json()) as ErrorPayload

  const hashIp = (ip: string): string => createHmac('sha256', IP_HASH_SALT).update(ip).digest('hex')

  const superuserHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: superuserToken
  })

  const findApp = async (appId: string): Promise<{ id: string; daily_create_limit: number }> => {
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

  const ensureQuotaOwner = async (): Promise<string> => {
    if (quotaOwnerId !== null) return quotaOwnerId

    const response = await fetch(`${baseUrl}/api/collections/users/records`, {
      method: 'POST',
      headers: superuserHeaders(),
      body: JSON.stringify({
        email: QUOTA_OWNER_EMAIL,
        password: QUOTA_OWNER_PASSWORD,
        passwordConfirm: QUOTA_OWNER_PASSWORD
      })
    })
    const user = await readJsonBody<IdResponse>(response)
    quotaOwnerId = user.id
    return quotaOwnerId
  }

  const seedLink = async (
    appRecordId: string,
    ownerId: string,
    slug: string,
    ipHash: string
  ): Promise<LinkRecord> => {
    const response = await fetch(`${baseUrl}/api/collections/links/records`, {
      method: 'POST',
      headers: superuserHeaders(),
      body: JSON.stringify({
        slug,
        destination: `https://macrolattice.com/meal/${slug}`,
        owner_id: ownerId,
        app: appRecordId,
        created_from_ip: ipHash,
        is_active: true
      })
    })
    return readJsonBody<LinkRecord>(response)
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

  const latestBreakerRunId = async (): Promise<string | null> => {
    const filter = encodeURIComponent("message ~ 'share circuit breaker job finished'")
    const response = await fetch(
      `${baseUrl}/api/logs?perPage=5&sort=-created&filter=${filter}`,
      { headers: { Authorization: superuserToken } }
    )
    const list = await readJsonBody<LogList>(response)
    return list.items[0]?.id ?? null
  }

  const latestKvFailureLog = async (): Promise<KVFailureLogRecord | null> => {
    const filter = encodeURIComponent("message ~ 'share KV publish failed'")
    const response = await fetch(
      `${baseUrl}/api/logs?perPage=1&sort=-created&filter=${filter}`,
      { headers: { Authorization: superuserToken } }
    )
    const list = await readJsonBody<KVFailureLogList>(response)
    return list.items[0] ?? null
  }

  // PB batches log writes, so a freshly emitted entry needs a short wait
  // before the /api/logs query can see it (same as the breaker job gate).
  const waitForKvFailureLog = async (previousId: string | null): Promise<KVFailureLogRecord> => {
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const entry = await latestKvFailureLog()
      if (entry !== null && entry.id !== previousId) return entry
      await new Promise<void>((resolve) => setTimeout(resolve, 150))
    }
    throw new Error('share KV publish failure was not logged within 15s')
  }

  const runBreakerJob = async (): Promise<void> => {
    // The /api/crons trigger returns immediately and runs the job on another
    // goroutine, so wait for the job's own completion log entry instead of
    // racing it (the log line is also the ops trail for the daily run).
    const previousRunId = await latestBreakerRunId()
    const response = await fetch(`${baseUrl}/api/crons/share_breaker_daily`, {
      method: 'POST',
      headers: { Authorization: superuserToken }
    })
    if (response.status !== 204) {
      throw new Error(`Breaker cron run failed with HTTP ${response.status}`)
    }

    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const currentRunId = await latestBreakerRunId()
      if (currentRunId !== null && currentRunId !== previousRunId) return
      await new Promise<void>((resolve) => setTimeout(resolve, 150))
    }
    throw new Error('Breaker baseline job did not report completion within 15s')
  }

  const countLinks = async (): Promise<number> => {
    const response = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<RecordList>(response)
    return list.totalItems
  }

  beforeAll(async () => {
    const pb = requireBinary()

    dataDir = mkdtempSync(join(tmpdir(), 'pb-share-create-'))

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

    const port = 21000 + Math.floor(Math.random() * 10000)
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
          BREAKER_MULTIPLIER,
          CF_ACCOUNT_ID,
          CF_KV_NAMESPACE_ID: CF_NAMESPACE_ID,
          CF_API_TOKEN,
          CF_KV_API_URL: kvApiUrl
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

  it('requires no authentication for the create route', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE))

    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
    expect(response.status).toBe(501)
  })

  it('fails closed with 501 until tasks 2.6-2.9 complete the pipeline', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])

    expect(response.status).toBe(501)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('not_implemented')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('renders and allowlist-validates content references (task 2.2)', async () => {
    const unknownApp = await postCreate(
      createBody({ appId: 'nosuchapp', type: 'meal', contentId: 'r_8f3k' }),
      APP_ORIGINS[0]
    )
    expect(unknownApp.status).toBe(400)
    expect((await errorPayload(unknownApp)).code).toBe('unknown_app')

    const unknownType = await postCreate(
      createBody({ appId: 'macrolattice', type: 'workout', contentId: 'r_8f3k' }),
      APP_ORIGINS[0]
    )
    expect(unknownType.status).toBe(400)
    expect((await errorPayload(unknownType)).code).toBe('unknown_type')

    for (const origin of APP_ORIGINS) {
      const accepted = await postCreate(createBody(VALID_REFERENCE), origin)
      expect(accepted.status, origin).toBe(501)
    }
  })

  it('ignores client-supplied slug and url fields (task 2.6)', async () => {
    const response = await postCreate(
      createBody({
        ...VALID_REFERENCE,
        slug: 'my-custom-slug',
        url: 'https://macrolattice.com/override',
        customSlug: 'brand'
      }),
      APP_ORIGINS[0]
    )

    // The slug is server-generated from crypto randomness; the pipeline still
    // holds at the interim 501 and nothing is persisted.
    expect(response.status).toBe(501)
    expect((await errorPayload(response)).code).toBe('not_implemented')
    expect(await countLinks()).toBe(0)
  })

  it('echoes the exact first-party origin on create responses', async () => {
    for (const origin of APP_ORIGINS) {
      const response = await postCreate(createBody(VALID_REFERENCE), origin)
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin)
    }
  })

  it('sends no CORS headers to non-browser clients without an Origin', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE))

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('verifies the Turnstile token against the configured siteverify endpoint', async () => {
    siteverifyCalls.length = 0

    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])

    expect(response.status).toBe(501)
    expect(siteverifyCalls).toHaveLength(1)
    expect(siteverifyCalls[0]?.secret).toBe(TURNSTILE_SECRET)
    expect(siteverifyCalls[0]?.response).toBe(VALID_TOKEN)
  })

  it('rejects requests without a Turnstile token with 403 and no side effects', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE, null), APP_ORIGINS[0])

    expect(response.status).toBe(403)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('turnstile_missing')
    expect(response.headers.get('access-control-allow-origin')).toBe(APP_ORIGINS[0])
  })

  it('rejects invalid Turnstile tokens with 403', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE, INVALID_TOKEN), APP_ORIGINS[0])

    expect(response.status).toBe(403)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('turnstile_failed')
    expect(payload.reason).toBe('invalid')
  })

  it('rejects replayed Turnstile tokens with 403', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE, REPLAY_TOKEN), APP_ORIGINS[0])

    expect(response.status).toBe(403)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('turnstile_failed')
    expect(payload.reason).toBe('expired_or_duplicate')
  })

  it('fails closed with 503 when siteverify is unavailable', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE, UNAVAILABLE_TOKEN), APP_ORIGINS[0])

    expect(response.status).toBe(503)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('turnstile_unavailable')
  })

  it('forwards CF-Connecting-IP to siteverify as remoteip', async () => {
    siteverifyCalls.length = 0

    const response = await postCreate(createBody(VALID_REFERENCE, REMOTE_IP_TOKEN), APP_ORIGINS[0], {
      'CF-Connecting-IP': REMOTE_IP
    })

    expect(response.status).toBe(403)
    const call = siteverifyCalls.find((item) => item.response === REMOTE_IP_TOKEN)
    expect(call).toBeDefined()
    expect(call?.remoteip).toBe(REMOTE_IP)
  })

  it('rejects disallowed origins on both the request and the preflight (no CORS headers)', async () => {
    const request = await postCreate(createBody(VALID_REFERENCE), DISALLOWED_ORIGIN)
    expect(request.status).toBe(403)
    expect(request.headers.get('access-control-allow-origin')).toBeNull()
    expect((await errorPayload(request)).code).toBe('origin_not_allowed')

    const options = await preflight(DISALLOWED_ORIGIN)
    expect(options.status).toBe(403)
    expect(options.headers.get('access-control-allow-origin')).toBeNull()
    expect((await errorPayload(options)).code).toBe('origin_not_allowed')
  })

  it('answers allowed preflights with the exact origin and POST method only', async () => {
    for (const origin of APP_ORIGINS) {
      const response = await preflight(origin)

      expect(response.status, origin).toBe(204)
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin)
      expect(response.headers.get('access-control-allow-methods')).toContain('POST')
      expect(response.headers.get('access-control-allow-methods')).not.toContain('DELETE')
      expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
      expect(response.headers.get('vary')?.toLowerCase()).toContain('origin')
    }
  })

  it('rejects malformed content references with 400 and per-field details', async () => {
    const cases: Array<[unknown, string]> = [
      [{ type: 'meal', contentId: 'r_8f3k' }, 'appId'],
      [{ appId: 'macrolattice', contentId: 'r_8f3k' }, 'type'],
      [{ appId: 'macrolattice', type: 'meal' }, 'contentId'],
      [{ appId: 'macrolattice', type: 'meal', contentId: 'a/b' }, 'contentId'],
      [{ appId: 'macrolattice', type: 'meal', contentId: 'r_8f3k', params: { nested: { a: 1 } } }, 'params.nested']
    ]

    for (const [body, field] of cases) {
      const response = await postCreate(createBody(body), APP_ORIGINS[0])
      expect(response.status, JSON.stringify(body)).toBe(400)

      const payload = await errorPayload(response)
      expect(payload.code).toBe('invalid_request')
      expect((payload.fields ?? []).map((item) => item.field)).toContain(field)
    }

    const arrayBody = await postCreate(JSON.stringify([1, 2, 3]), APP_ORIGINS[0])
    expect(arrayBody.status).toBe(403)
    expect((await errorPayload(arrayBody)).code).toBe('turnstile_missing')
  })

  it('rejects invalid JSON and oversized bodies before Turnstile verification', async () => {
    const malformed = await postCreate('not-json', APP_ORIGINS[0])
    expect(malformed.status).toBe(400)
    expect((await errorPayload(malformed)).code).toBe('invalid_json')

    const oversized = await postCreate(
      createBody({ appId: 'macrolattice', type: 'meal', contentId: 'r_8f3k', params: { pad: 'x'.repeat(8000) } }),
      APP_ORIGINS[0]
    )
    expect(oversized.status).toBe(413)
  })

  it('exposes no read surface on the create path', async () => {
    const response = await fetch(`${baseUrl}/api/share/create`, {
      headers: { Origin: APP_ORIGINS[0] }
    })

    expect([404, 405]).toContain(response.status)
  })

  it('stores nothing for any rejected or placeholder request', async () => {
    const links = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<RecordList>(links)
    expect(list.totalItems).toBe(0)

    const anonymous = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`)
    expect(anonymous.status).toBe(403)
  })

  it('enforces the per-IP daily quota at the limit with 429 and reset metadata (task 2.4)', async () => {
    const app = await findApp('macrolattice')
    await setDailyCreateLimit(app.id, 2)
    const ownerId = await ensureQuotaOwner()
    const ipHash = hashIp(QUOTA_IP)
    await seedLink(app.id, ownerId, 'quota-seed-1', ipHash)
    await seedLink(app.id, ownerId, 'quota-seed-2', ipHash)

    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0], {
      'CF-Connecting-IP': QUOTA_IP
    })

    expect(response.status).toBe(429)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('quota_exceeded')
    expect(payload.limit).toBe(2)
    expect(payload.used).toBe(2)
    expect(payload.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)

    const retryAfter = Number(response.headers.get('retry-after'))
    expect(Number.isInteger(retryAfter)).toBe(true)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(86_400)
    expect(response.headers.get('access-control-allow-origin')).toBe(APP_ORIGINS[0])
    expect(response.headers.get('cache-control')).toBe('no-store')

    const links = await fetch(`${baseUrl}/api/collections/links/records?perPage=1`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<RecordList>(links)
    expect(list.totalItems).toBe(2)
  })

  it('allows requests below the per-IP quota and keys the counter by IP (task 2.4)', async () => {
    const app = await findApp('macrolattice')
    const ownerId = await ensureQuotaOwner()
    await seedLink(app.id, ownerId, 'quota-seed-3', hashIp(QUOTA_IP_2))

    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0], {
      'CF-Connecting-IP': QUOTA_IP_2
    })

    expect(response.status).toBe(501)
  })

  it('keys the quota per app: an exhausted app does not block other apps (task 2.4)', async () => {
    const response = await postCreate(
      createBody({ appId: 'supatrainer', type: 'workout', contentId: 'w_42' }),
      APP_ORIGINS[1],
      { 'CF-Connecting-IP': QUOTA_IP }
    )

    expect(response.status).toBe(501)
  })

  it('verifies Turnstile before evaluating the quota (task 2.4)', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE, INVALID_TOKEN), APP_ORIGINS[0], {
      'CF-Connecting-IP': QUOTA_IP
    })

    expect(response.status).toBe(403)
    expect((await errorPayload(response)).code).toBe('turnstile_failed')
  })

  it('fails closed with 503 when CF-Connecting-IP is absent (task 2.4)', async () => {
    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0], {
      'CF-Connecting-IP': ''
    })

    expect(response.status).toBe(503)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('quota_unavailable')
  })

  it('seeds a locked system_config collection with the breaker flag off (task 2.5)', async () => {
    const anonymous = await fetch(`${baseUrl}/api/collections/system_config/records?perPage=1`)
    expect(anonymous.status).toBe(403)

    const record = await findBreakerRecord()
    expect(record.key).toBe('public_creation_paused')
    expect(record.value).toBe(false)

    const anonymousPatch = await fetch(
      `${baseUrl}/api/collections/system_config/records/${record.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: true })
      }
    )
    expect(anonymousPatch.status).toBe(403)
  })

  it('registers the daily breaker baseline job (task 2.5)', async () => {
    const response = await fetch(`${baseUrl}/api/crons`, {
      headers: { Authorization: superuserToken }
    })
    const jobs = await readJsonBody<CronJob[]>(response)

    const job = jobs.find((entry) => entry.id === 'share_breaker_daily')
    expect(job).toBeDefined()
    expect(job?.expression).toBe('0 0 * * *')
  })

  it('trips the breaker above the baseline multiple and rejects creates with 503 (task 2.5)', async () => {
    const app = await findApp('macrolattice')
    const ownerId = await ensureQuotaOwner()

    // Below the floor-scaled threshold: the job must not trip.
    await runBreakerJob()
    expect((await findBreakerRecord()).value).toBe(false)

    const hash = hashIp('203.0.113.250')
    for (let i = 1; i <= BREAKER_SEEDED_LINKS; i++) {
      await seedLink(app.id, ownerId, `breaker-seed-${i}`, hash)
    }
    expect(await countLinks()).toBeGreaterThan(BREAKER_THRESHOLD)

    await runBreakerJob()
    expect((await findBreakerRecord()).value).toBe(true)

    const linksBefore = await countLinks()
    siteverifyCalls.length = 0

    const validToken = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])
    expect(validToken.status).toBe(503)
    expect((await errorPayload(validToken)).code).toBe('creation_paused')
    expect(validToken.headers.get('access-control-allow-origin')).toBe(APP_ORIGINS[0])
    expect(validToken.headers.get('cache-control')).toBe('no-store')

    // The kill switch runs before the Turnstile gate: a paused system sheds
    // load without calling siteverify, and every request sees 503.
    const missingToken = await postCreate(createBody(VALID_REFERENCE, null), APP_ORIGINS[0])
    expect(missingToken.status).toBe(503)
    expect((await errorPayload(missingToken)).code).toBe('creation_paused')
    expect(siteverifyCalls).toHaveLength(0)

    // The breaker also precedes the quota, so an exhausted IP sees 503.
    const exhaustedIp = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0], {
      'CF-Connecting-IP': QUOTA_IP
    })
    expect(exhaustedIp.status).toBe(503)

    expect(await countLinks()).toBe(linksBefore)
  }, 60_000)

  it('fails closed while the flag value is malformed (task 2.5)', async () => {
    await setBreakerFlag('paused')

    const response = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])
    expect(response.status).toBe(503)
    expect((await errorPayload(response)).code).toBe('breaker_unavailable')

    await setBreakerFlag(false)
  })

  it('lets the admin reset the breaker and creates resume (task 2.5)', async () => {
    await setBreakerFlag(true)
    expect((await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])).status).toBe(503)

    await setBreakerFlag(false)
    const resumed = await postCreate(createBody(VALID_REFERENCE), APP_ORIGINS[0])
    expect(resumed.status).toBe(501)
    expect((await findBreakerRecord()).value).toBe(false)
  })

  it('publishes a created share link to the host-keyed KV namespace (task 2.7)', async () => {
    const app = await findApp('macrolattice')
    const ownerId = await ensureQuotaOwner()
    kvCalls.length = 0

    await seedLink(app.id, ownerId, 'kvpubab', hashIp('203.0.113.60'))

    const expectedKey = 'sh.macrolattice.com:/kvpubab'
    const call = kvCalls.find(
      (item) => item.method === 'PUT' && item.url.includes(encodeURIComponent(expectedKey))
    )
    expect(call).toBeDefined()
    expect(call?.url).toContain('/accounts/ci-account/storage/kv/namespaces/ci-namespace/values/')
    expect(call?.authorization).toBe(`Bearer ${CF_API_TOKEN}`)

    const value = JSON.parse(call?.body ?? '{}') as Record<string, unknown>
    expect(value.id).toEqual(expect.any(String))
    expect(value.path).toBe('/kvpubab')
    expect(value.destination).toBe('https://macrolattice.com/meal/kvpubab')
    expect(value.code).toBe(302)
    expect(value.isActive).toBe(true)
  })

  it('removes the KV key when a share link record is deleted (task 2.7)', async () => {
    const app = await findApp('macrolattice')
    const ownerId = await ensureQuotaOwner()
    const record = await seedLink(app.id, ownerId, 'kvdelab', hashIp('203.0.113.61'))
    kvCalls.length = 0

    const response = await fetch(`${baseUrl}/api/collections/links/records/${record.id}`, {
      method: 'DELETE',
      headers: superuserHeaders()
    })
    expect(response.status).toBe(204)

    const expectedKey = 'sh.macrolattice.com:/kvdelab'
    const call = kvCalls.find(
      (item) => item.method === 'DELETE' && item.url.includes(encodeURIComponent(expectedKey))
    )
    expect(call).toBeDefined()
    expect(call?.authorization).toBe(`Bearer ${CF_API_TOKEN}`)
  })

  it('isolates KV publish failures: the record persists and the failure is warn-logged with counters (task 2.7)', async () => {
    const app = await findApp('macrolattice')
    const ownerId = await ensureQuotaOwner()
    const previousFailure = await latestKvFailureLog()

    await seedLink(app.id, ownerId, 'kvfail11', hashIp('203.0.113.62'))

    // KV is a cache: a failed publish must never fail the record operation,
    // and the read-through fallback (2.8/3.5) covers the missed key.
    const filter = encodeURIComponent("slug='kvfail11'")
    const lookup = await fetch(`${baseUrl}/api/collections/links/records?perPage=1&filter=${filter}`, {
      headers: { Authorization: superuserToken }
    })
    const list = await readJsonBody<RecordList>(lookup)
    expect(list.totalItems).toBe(1)

    // Not silent: the failure lands in the ops log trail with running counters.
    const failure = await waitForKvFailureLog(previousFailure?.id ?? null)
    expect(failure.data?.code).toBe('kv_unavailable')
    const metrics = JSON.parse(failure.data?.metrics ?? '{}') as {
      publishFailures?: number
      failureCodes?: Record<string, number>
    }
    expect(metrics.publishFailures ?? 0).toBeGreaterThan(0)
    expect(metrics.failureCodes?.kv_unavailable ?? 0).toBeGreaterThan(0)
  })
})
