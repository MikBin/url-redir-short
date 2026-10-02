import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
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

const VALID_BODY = JSON.stringify({
  appId: 'macrolattice',
  type: 'meal',
  contentId: 'r_8f3k',
  params: { week: 3 }
})

interface CommandResult {
  status: number | null
  output: string
}

interface ErrorPayload {
  code?: string
  message?: string
  status?: number
  fields?: Array<{ field: string; message: string }>
}

interface RecordList {
  totalItems: number
}

interface AuthResponse {
  token: string
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

describe.skipIf(binary === null)('live share/create route (tasks 2.1-2.2)', () => {
  let dataDir = ''
  let baseUrl = ''
  let superuserToken = ''
  let serverProcess: ReturnType<typeof spawn> | null = null
  let serverOutput = ''

  const trackServerOutput = (chunk: Buffer): void => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-4000)
  }

  const serverLog = (): string => serverOutput

  const postCreate = (body: string, origin?: string): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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
    superuserToken = auth.token
  }, 120_000)

  afterAll(() => {
    serverProcess?.kill()
    if (dataDir.length > 0) {
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
  })

  it('requires no authentication for the create route', async () => {
    const response = await postCreate(VALID_BODY)

    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
    expect(response.status).toBe(501)
  })

  it('fails closed with 501 until tasks 2.3-2.9 complete the pipeline', async () => {
    const response = await postCreate(VALID_BODY, APP_ORIGINS[0])

    expect(response.status).toBe(501)
    const payload = await errorPayload(response)
    expect(payload.code).toBe('not_implemented')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('renders and allowlist-validates content references (task 2.2)', async () => {
    const unknownApp = await postCreate(
      JSON.stringify({ appId: 'nosuchapp', type: 'meal', contentId: 'r_8f3k' }),
      APP_ORIGINS[0]
    )
    expect(unknownApp.status).toBe(400)
    expect((await errorPayload(unknownApp)).code).toBe('unknown_app')

    const unknownType = await postCreate(
      JSON.stringify({ appId: 'macrolattice', type: 'workout', contentId: 'r_8f3k' }),
      APP_ORIGINS[0]
    )
    expect(unknownType.status).toBe(400)
    expect((await errorPayload(unknownType)).code).toBe('unknown_type')

    for (const origin of APP_ORIGINS) {
      const accepted = await postCreate(VALID_BODY, origin)
      expect(accepted.status, origin).toBe(501)
    }
  })

  it('echoes the exact first-party origin on create responses', async () => {
    for (const origin of APP_ORIGINS) {
      const response = await postCreate(VALID_BODY, origin)
      expect(response.headers.get('access-control-allow-origin'), origin).toBe(origin)
    }
  })

  it('sends no CORS headers to non-browser clients without an Origin', async () => {
    const response = await postCreate(VALID_BODY)

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects disallowed origins on both the request and the preflight (no CORS headers)', async () => {
    const request = await postCreate(VALID_BODY, DISALLOWED_ORIGIN)
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
      const response = await postCreate(JSON.stringify(body), APP_ORIGINS[0])
      expect(response.status, JSON.stringify(body)).toBe(400)

      const payload = await errorPayload(response)
      expect(payload.code).toBe('invalid_request')
      expect((payload.fields ?? []).map((item) => item.field)).toContain(field)
    }

    const arrayBody = await postCreate(JSON.stringify([1, 2, 3]), APP_ORIGINS[0])
    expect(arrayBody.status).toBe(400)
    expect(((await errorPayload(arrayBody)).fields ?? []).map((item) => item.field)).toEqual(['body'])
  })

  it('rejects invalid JSON and oversized bodies', async () => {
    const malformed = await postCreate('not-json', APP_ORIGINS[0])
    expect(malformed.status).toBe(400)
    expect((await errorPayload(malformed)).code).toBe('invalid_json')

    const oversized = await postCreate(
      JSON.stringify({ appId: 'macrolattice', type: 'meal', contentId: 'r_8f3k', params: { pad: 'x'.repeat(8000) } }),
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
})
