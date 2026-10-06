import { createHmac, randomInt } from 'node:crypto'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

interface ValidationIssue {
  field: string
  message: string
}

interface ContentReference {
  appId: string
  type: string
  contentId: string
  params: Record<string, string | number | boolean>
}

type ParseResult = { ok: true; value: ContentReference } | { ok: false; errors: ValidationIssue[] }

type OriginDecision =
  | { kind: 'absent' }
  | { kind: 'allowed'; origin: string }
  | { kind: 'denied'; origin: string }

type UrlResult = { ok: true; destination: string } | { ok: false; code: string; message: string }

type TurnstileResult =
  | { ok: true }
  | { ok: false; code: string; reason?: string; message: string }

interface SiteverifyCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  timeout: number
}

interface SiteverifyMock {
  calls: SiteverifyCall[]
  send: (config: SiteverifyCall) => unknown
}

interface QuotaQuery {
  expression: string
  params: Record<string, string>
}

type QuotaDecision =
  | { ok: true; used: number; limit: number; remaining: number }
  | {
      ok: false
      code: 'quota_exceeded'
      used: number
      limit: number
      resetAt: string
      retryAfterSeconds: number
    }
  | { ok: false; code: 'quota_input_invalid'; message: string }

interface ShareLib {
  CREATE_PATH: string
  MAX_DESTINATION_LENGTH: number
  KNOWN_SHORTENER_HOSTS: string[]
  TURNSTILE_TOKEN_FIELD: string
  DEFAULT_TURNSTILE_VERIFY_URL: string
  MAX_TURNSTILE_TOKEN_LENGTH: number
  DEFAULT_DAILY_CREATE_LIMIT: number
  normalizeOrigin: (origin: unknown) => string
  parseContentReference: (body: unknown) => ParseResult
  resolveAllowedOrigins: (rows: unknown) => string[]
  decideOrigin: (origin: unknown, allowedOrigins: string[]) => OriginDecision
  extractTurnstileToken: (body: unknown) => string | null
  interpretSiteverify: (response: unknown) => TurnstileResult
  verifyTurnstileToken: (token: unknown, deps: unknown) => TurnstileResult
  renderDestination: (template: unknown, reference: unknown) => UrlResult
  validateDestination: (destination: unknown, allowedHost: unknown) => UrlResult
  normalizeClientIp: (value: unknown) => string | null
  hashClientIp: (ip: unknown, salt: unknown, hash: unknown) => string | null
  utcDayStart: (now: unknown) => string | null
  nextUtcMidnight: (now: unknown) => Date | null
  dailyQuotaQuery: (input: unknown) => QuotaQuery | null
  evaluateDailyQuota: (input: unknown) => QuotaDecision
  SLUG_ALPHABET: string
  SLUG_LENGTH: number
  MAX_SLUG_COLLISION_RETRIES: number
  SLUG_PATTERN: RegExp
  SLUG_COLLISION_QUERY_EXPRESSION: string
  generateSlug: (random: unknown) => string | null
  generateSlugWithCollisionRetry: (input: unknown) => SlugGenerationResult
  slugCollisionQuery: (appRecordId: unknown, slug: unknown) => QuotaQuery | null
  KV_API_BASE_URL: string
  KV_ENV_ACCOUNT_ID: string
  KV_ENV_NAMESPACE_ID: string
  KV_ENV_API_TOKEN: string
  KV_ENV_API_URL: string
  KV_REDIRECT_CODE: number
  KV_MAX_KEY_LENGTH: number
  kvConfigFromEnv: (getenv: unknown) => KVConfig | null
  kvLinkKey: (shareHost: unknown, path: unknown) => string | null
  kvSlugPath: (slug: unknown) => string | null
  kvValuesUrl: (config: unknown, key: unknown) => string | null
  interpretKVResponse: (response: unknown) => KVOutcome
  clampKVTimeout: (seconds: unknown) => number
  createKVPublishMetrics: () => KVMetrics
  kvPublishMetrics: () => KVMetrics
  publishShareLinkToKV: (input: unknown, deps: unknown) => KVResult
  deleteShareLinkFromKV: (input: unknown, deps: unknown) => KVResult
  RESOLVE_PATH: string
  RESOLVE_SECRET_ENV: string
  RESOLVE_RATE_LIMIT_ENV: string
  DEFAULT_RESOLVE_RATE_LIMIT_PER_MINUTE: number
  MAX_RESOLVE_RATE_LIMIT_PER_MINUTE: number
  RESOLVE_RATE_WINDOW_MS: number
  MAX_RESOLVE_RATE_KEYS: number
  RESOLVE_APP_QUERY_EXPRESSION: string
  RESOLVE_LINK_QUERY_EXPRESSION: string
  parseResolveQuery: (query: unknown) => ResolveQueryResult
  evaluateResolveAuth: (authorization: unknown, secret: unknown, hash: unknown) => ResolveAuthResult
  resolveRateKey: (value: unknown) => string
  parseResolveRateLimitPerMinute: (value: unknown) => number | null
  createResolveRateLimiter: (config: unknown) => ResolveRateLimiter | null
  resolveRateLimiter: (getenv: unknown) => ResolveRateLimiter
  evaluateLinkResolvable: (input: unknown) => LinkResolvableResult
}

interface KVConfig {
  accountId: string
  namespaceId: string
  apiToken: string
  apiUrl: string
}

interface KVCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  timeout: number
}

interface KVMetricsSnapshot {
  publishAttempts: number
  publishFailures: number
  deleteAttempts: number
  deleteFailures: number
  failureCodes: Record<string, number>
}

interface KVMetrics {
  recordPublishSuccess: () => void
  recordPublishFailure: (code: unknown) => void
  recordDeleteSuccess: () => void
  recordDeleteFailure: (code: unknown) => void
  snapshot: () => KVMetricsSnapshot
}

type KVOutcome = { ok: true; status: number } | { ok: false; code: string; status: number | null }

type KVResult =
  | { ok: true; key: string; status: number }
  | { ok: false; code: string; status: number | null; skipped?: boolean }

type SlugGenerationResult =
  | { ok: true; slug: string; attempts: number }
  | { ok: false; code: string; message: string }

type ResolveQueryResult =
  | { ok: true; host: string; path: string; slug: string }
  | { ok: false; code: 'invalid_request'; message: string; fields: ValidationIssue[] }

type ResolveAuthResult =
  | { ok: true }
  | { ok: false; code: 'resolve_not_configured' | 'resolve_unauthorized'; message: string }

interface ResolveRateDecision {
  allowed: boolean
  count: number
  remaining: number
  retryAfterSeconds: number
}

interface ResolveRateLimiter {
  take: (key: unknown) => ResolveRateDecision
}

interface LinkResolvableResult {
  resolvable: boolean
  reason: 'ok' | 'inactive' | 'expired' | 'invalid_expiry' | 'invalid_input'
}

function createSiteverifyMock(response: unknown): SiteverifyMock {
  const calls: SiteverifyCall[] = []
  return {
    calls,
    send: (config: SiteverifyCall) => {
      calls.push(config)
      return response
    }
  }
}

const nodeRequire = createRequire(import.meta.url)
const share = nodeRequire('../pb_hooks/lib/share.cjs') as ShareLib

const validBody = {
  appId: 'macrolattice',
  type: 'meal',
  contentId: 'r_8f3k',
  params: { week: 3, ref: 'share' }
}

const ALLOWED = ['https://azurechip.com', 'https://macrolattice.com', 'https://supatrainer.com']

function parsedFields(result: ParseResult): string[] {
  if (result.ok) return []
  return result.errors.map((error) => error.field)
}

describe('share hook lib: parseContentReference (task 2.1)', () => {
  it('accepts a minimal content reference and defaults params to an empty object', () => {
    const result = share.parseContentReference({ appId: 'supatrainer', type: 'workout', contentId: 'w_42' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        appId: 'supatrainer',
        type: 'workout',
        contentId: 'w_42',
        params: {}
      })
    }
  })

  it('accepts a fully populated content reference and preserves primitive params', () => {
    const result = share.parseContentReference(validBody)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(validBody)
    }
  })

  it('ignores client-supplied extra fields such as slug or destination urls', () => {
    const result = share.parseContentReference({
      ...validBody,
      slug: 'client-chosen',
      url: 'https://evil.example/'
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual(['appId', 'contentId', 'params', 'type'])
    }
  })

  it('rejects non-object bodies', () => {
    for (const body of [null, undefined, 'text', 42, [], true]) {
      const result = share.parseContentReference(body)
      expect(result.ok, JSON.stringify(body)).toBe(false)
      expect(parsedFields(result)).toEqual(['body'])
    }
  })

  it('rejects malformed appId values', () => {
    for (const appId of ['', 'Macrolattice', '1stapp', 'macrolattice-app', 'a'.repeat(65), 42, null]) {
      const result = share.parseContentReference({ ...validBody, appId })
      expect(parsedFields(result), `appId ${JSON.stringify(appId)}`).toContain('appId')
    }
  })

  it('rejects malformed type values', () => {
    for (const type of ['', 'Meal', '-meal', 'a'.repeat(65), 7, null]) {
      const result = share.parseContentReference({ ...validBody, type })
      expect(parsedFields(result), `type ${JSON.stringify(type)}`).toContain('type')
    }
  })

  it('rejects contentIds that are not URL-safe identifiers', () => {
    for (const contentId of ['', 'a/b', 'a?b', 'a#b', 'a b', '%2e%2e', '.', '..', 'a'.repeat(129), 9, null]) {
      const result = share.parseContentReference({ ...validBody, contentId })
      expect(parsedFields(result), `contentId ${JSON.stringify(contentId)}`).toContain('contentId')
    }
  })

  it('rejects params that are not plain objects, contain nested values, or exceed bounds', () => {
    const nested = share.parseContentReference({ ...validBody, params: { deep: { value: 1 } } })
    expect(parsedFields(nested)).toEqual(['params.deep'])

    const arrayParam = share.parseContentReference({ ...validBody, params: { list: [1, 2] } })
    expect(parsedFields(arrayParam)).toEqual(['params.list'])

    const arrayBody = share.parseContentReference({ ...validBody, params: [] })
    expect(parsedFields(arrayBody)).toEqual(['params'])

    const longString = share.parseContentReference({ ...validBody, params: { note: 'x'.repeat(257) } })
    expect(parsedFields(longString)).toEqual(['params.note'])

    const tooManyKeys = share.parseContentReference({
      ...validBody,
      params: Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`k${index}`, 1]))
    })
    expect(parsedFields(tooManyKeys)).toContain('params')

    const badKey = share.parseContentReference({ ...validBody, params: { 'bad-key': 1 } })
    expect(parsedFields(badKey)).toEqual(['params.bad-key'])
  })

  it('rejects non-finite numbers and non-primitive parameter values', () => {
    const notFinite = share.parseContentReference({ ...validBody, params: { value: Number.POSITIVE_INFINITY } })
    expect(parsedFields(notFinite)).toEqual(['params.value'])
  })
})

describe('share hook lib: resolveAllowedOrigins (task 2.1)', () => {
  it('derives https origins from active registry rows only', () => {
    const origins = share.resolveAllowedOrigins([
      { allowed_host: 'macrolattice.com', active: true },
      { allowed_host: 'supatrainer.com', active: false },
      { allowed_host: 'azurechip.com', active: true }
    ])

    expect(origins).toEqual(['https://azurechip.com', 'https://macrolattice.com'])
  })

  it('deduplicates hosts and ignores malformed rows', () => {
    const origins = share.resolveAllowedOrigins([
      { allowed_host: 'macrolattice.com', active: true },
      { allowed_host: 'macrolattice.com', active: true },
      { allowed_host: '', active: true },
      { allowed_host: 42, active: true },
      null,
      'macrolattice.com',
      { allowed_host: 'macrolattice.com' }
    ])

    expect(origins).toEqual(['https://macrolattice.com'])
  })

  it('returns an empty list for non-array input', () => {
    expect(share.resolveAllowedOrigins(undefined)).toEqual([])
    expect(share.resolveAllowedOrigins({})).toEqual([])
  })
})

describe('share hook lib: decideOrigin (task 2.1, fail closed)', () => {
  it('treats requests without an Origin header as absent (native clients)', () => {
    expect(share.decideOrigin(undefined, ALLOWED)).toEqual({ kind: 'absent' })
    expect(share.decideOrigin(null, ALLOWED)).toEqual({ kind: 'absent' })
    expect(share.decideOrigin('', ALLOWED)).toEqual({ kind: 'absent' })
    expect(share.decideOrigin('   ', ALLOWED)).toEqual({ kind: 'absent' })
  })

  it('allows the three app origins exactly, case-insensitively and without trailing slashes', () => {
    for (const allowedOrigin of ALLOWED) {
      expect(share.decideOrigin(allowedOrigin, ALLOWED)).toEqual({ kind: 'allowed', origin: allowedOrigin })
    }

    expect(share.decideOrigin('https://macrolattice.com/', ALLOWED)).toEqual({
      kind: 'allowed',
      origin: 'https://macrolattice.com'
    })
    expect(share.decideOrigin('HTTPS://MacroLattice.com', ALLOWED)).toEqual({
      kind: 'allowed',
      origin: 'https://macrolattice.com'
    })
  })

  it('denies unknown origins, the literal null origin, ports, sibling subdomains and suffixes', () => {
    for (const origin of [
      'https://evil.example',
      'null',
      'https://macrolattice.com:8443',
      'https://www.macrolattice.com',
      'https://macrolattice.com.evil.io',
      'http://macrolattice.com'
    ]) {
      expect(share.decideOrigin(origin, ALLOWED), origin).toEqual({ kind: 'denied', origin })
    }
  })
})

describe('share hook lib: shared constants', () => {
  it('exposes the create route path used by the hooks and tests', () => {
    expect(share.CREATE_PATH).toBe('/api/share/create')
  })

  it('pins the destination length ceiling to the spec', () => {
    expect(share.MAX_DESTINATION_LENGTH).toBe(2048)
  })
})

describe('share hook lib: renderDestination (task 2.2)', () => {
  it('renders the seeded registry templates with the contentId', () => {
    const cases: Array<[string, unknown, string]> = [
      [
        'https://macrolattice.com/meal/{contentId}',
        { contentId: 'r_8f3k', params: {} },
        'https://macrolattice.com/meal/r_8f3k'
      ],
      [
        'https://supatrainer.com/workout/{contentId}',
        { contentId: 'w_42', params: { week: 3 } },
        'https://supatrainer.com/workout/w_42'
      ],
      [
        'https://azurechip.com/screen/{contentId}',
        { contentId: 's.1-2_3~4', params: {} },
        'https://azurechip.com/screen/s.1-2_3~4'
      ]
    ]

    for (const [template, reference, expected] of cases) {
      const result = share.renderDestination(template, reference)
      expect(result, template).toEqual({ ok: true, destination: expected })
    }
  })

  it('substitutes named parameter placeholders with URL-encoded primitives', () => {
    const result = share.renderDestination(
      'https://macrolattice.com/meal/{contentId}?week={week}&ref={ref}&flag={flag}',
      { contentId: 'r_8f3k', params: { week: 3, ref: 'a b&c', flag: true } }
    )

    expect(result).toEqual({
      ok: true,
      destination: 'https://macrolattice.com/meal/r_8f3k?week=3&ref=a%20b%26c&flag=true'
    })
  })

  it('does not expand placeholders introduced by parameter values', () => {
    const result = share.renderDestination('https://macrolattice.com/meal/{contentId}?ref={ref}', {
      contentId: 'r_8f3k',
      params: { ref: '{contentId}' }
    })

    expect(result).toEqual({
      ok: true,
      destination: 'https://macrolattice.com/meal/r_8f3k?ref=%7BcontentId%7D'
    })
  })

  it('rejects templates that are not strings, are empty, or miss the {contentId} placeholder', () => {
    for (const template of ['', 'https://macrolattice.com/meal/', 'https://macrolattice.com/meal/{slug}', 42, null]) {
      const result = share.renderDestination(template, { contentId: 'r_8f3k', params: {} })
      expect(result.ok, String(template)).toBe(false)
      if (!result.ok) expect(result.code, String(template)).toBe('invalid_template')
    }
  })

  it('rejects references without a usable contentId or params', () => {
    for (const reference of [null, 'text', {}, { contentId: '' }, { contentId: 42 }, { contentId: 'x', params: [] }]) {
      const result = share.renderDestination('https://macrolattice.com/meal/{contentId}', reference)
      expect(result.ok, JSON.stringify(reference)).toBe(false)
      if (!result.ok) expect(result.code, JSON.stringify(reference)).toBe('invalid_reference')
    }
  })

  it('rejects templates whose placeholders have no matching parameter', () => {
    const result = share.renderDestination('https://macrolattice.com/meal/{contentId}?week={week}', {
      contentId: 'r_8f3k',
      params: {}
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('missing_placeholder_value')
      expect(result.message).toContain('{week}')
    }
  })
})

describe('share hook lib: validateDestination (task 2.2)', () => {
  const ALLOWED_HOST = 'macrolattice.com'

  function codeOf(result: UrlResult): string {
    return result.ok ? '' : result.code
  }

  it('accepts an exact first-party destination and returns it unchanged', () => {
    expect(share.validateDestination('https://macrolattice.com/meal/r_8f3k', ALLOWED_HOST)).toEqual({
      ok: true,
      destination: 'https://macrolattice.com/meal/r_8f3k'
    })
    expect(share.validateDestination('https://macrolattice.com/meal/r_8f3k?week=3#top', ALLOWED_HOST)).toEqual({
      ok: true,
      destination: 'https://macrolattice.com/meal/r_8f3k?week=3#top'
    })
  })

  it('accepts a case-insensitive allowed host and canonicalizes scheme, host, port and trailing dot', () => {
    const cases = [
      'HTTPS://MacroLattice.COM/meal/r_8f3k',
      'https://MacroLattice.com:443/meal/r_8f3k',
      'https://macrolattice.com./meal/r_8f3k'
    ]

    for (const destination of cases) {
      expect(share.validateDestination(destination, 'MacroLattice.com'), destination).toEqual({
        ok: true,
        destination: 'https://macrolattice.com/meal/r_8f3k'
      })
    }
  })

  it('rejects destinations whose host is not exactly the allowed host', () => {
    for (const destination of [
      'https://www.macrolattice.com/meal/r_8f3k',
      'https://macrolattice.com.evil.io/meal/r_8f3k',
      'https://evil-macrolattice.com/meal/r_8f3k',
      'https://notmacrolattice.com/meal/r_8f3k',
      'https://supatrainer.com/workout/w_42'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe('host_not_allowed')
    }
  })

  it('rejects non-HTTPS and relative destinations', () => {
    const cases: Array<[string, string]> = [
      ['http://macrolattice.com/meal/r_8f3k', 'insecure_scheme'],
      ['ftp://macrolattice.com/meal/r_8f3k', 'insecure_scheme'],
      ['javascript:alert(1)', 'insecure_scheme'],
      ['//macrolattice.com/meal/r_8f3k', 'missing_scheme'],
      ['macrolattice.com/meal/r_8f3k', 'missing_scheme'],
      ['/meal/r_8f3k', 'missing_scheme']
    ]

    for (const [destination, code] of cases) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe(code)
    }
  })

  it('rejects userinfo obfuscation', () => {
    for (const destination of [
      'https://user@macrolattice.com/meal/r_8f3k',
      'https://user:pass@macrolattice.com/meal/r_8f3k',
      'https://macrolattice.com@evil.io/meal/r_8f3k'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe('userinfo_not_allowed')
    }
  })

  it('rejects IP-literal hosts in every notation', () => {
    for (const destination of [
      'https://127.0.0.1/meal/r_8f3k',
      'https://10.0.0.1/meal/r_8f3k',
      'https://127.1/meal/r_8f3k',
      'https://2130706433/meal/r_8f3k',
      'https://0x7f000001/meal/r_8f3k',
      'https://[::1]/meal/r_8f3k',
      'https://[2001:db8::1]/meal/r_8f3k'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe('ip_literal_not_allowed')
    }
  })

  it('rejects punycode homograph hosts', () => {
    for (const destination of [
      'https://xn--mcrlttice-9db.com/meal/r_8f3k',
      'https://macrolattice.xn--com-9o0a/meal/r_8f3k'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe('punycode_not_allowed')
    }
  })

  it('rejects non-ASCII, whitespace, control characters and backslashes', () => {
    for (const destination of [
      'https://m\u0430crolattice.com/meal/r_8f3k',
      'https://macrolattice.com/meal/ r_8f3k',
      'https://macrolattice.com/meal/\nr_8f3k',
      'https://macrolattice.com\\@evil.io/meal/r_8f3k'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, JSON.stringify(destination)).toBe(false)
      expect(codeOf(result), JSON.stringify(destination)).toBe('invalid_characters')
    }
  })

  it('rejects known shortener destinations, including subdomains', () => {
    for (const destination of [
      'https://bit.ly/abc',
      'https://www.bit.ly/abc',
      'https://tinyurl.com/abc',
      'https://t.co/abc',
      'https://goo.gl/abc',
      'https://cutt.ly/abc'
    ]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe('shortener_not_allowed')
    }
  })

  it('does not flag lookalike hosts that merely contain a shortener name', () => {
    const result = share.validateDestination('https://notbit.ly/abc', ALLOWED_HOST)
    expect(result.ok).toBe(false)
    expect(codeOf(result)).toBe('host_not_allowed')
  })

  it('rejects destinations longer than 2048 characters and accepts the boundary', () => {
    const base = 'https://macrolattice.com/meal/'
    const atLimit = base + 'a'.repeat(share.MAX_DESTINATION_LENGTH - base.length)
    expect(atLimit).toHaveLength(share.MAX_DESTINATION_LENGTH)
    expect(share.validateDestination(atLimit, ALLOWED_HOST).ok).toBe(true)

    const overLimit = atLimit + 'a'
    const result = share.validateDestination(overLimit, ALLOWED_HOST)
    expect(result.ok).toBe(false)
    expect(codeOf(result)).toBe('destination_too_long')
  })

  it('rejects non-default ports and malformed authorities', () => {
    const cases: Array<[string, string]> = [
      ['https://macrolattice.com:8443/meal/r_8f3k', 'port_not_allowed'],
      ['https://macrolattice.com:80/meal/r_8f3k', 'port_not_allowed'],
      ['https://macrolattice.com:0443/meal/r_8f3k', 'port_not_allowed'],
      ['https://macrolattice.com:abc/meal/r_8f3k', 'port_not_allowed'],
      ['https://macrolattice.com:/meal/r_8f3k', 'port_not_allowed'],
      ['https://macrolattice.com:443:443/meal/r_8f3k', 'invalid_host'],
      ['https:///meal/r_8f3k', 'invalid_host'],
      ['https://macrolattice..com/meal/r_8f3k', 'invalid_host'],
      ['https://macrolattice.com%2e/meal/r_8f3k', 'invalid_host'],
      ['https://-macrolattice.com/meal/r_8f3k', 'invalid_host']
    ]

    for (const [destination, code] of cases) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, destination).toBe(false)
      expect(codeOf(result), destination).toBe(code)
    }
  })

  it('rejects non-string destinations and rejects a malformed allowed host', () => {
    for (const destination of [null, undefined, 42, {}]) {
      const result = share.validateDestination(destination, ALLOWED_HOST)
      expect(result.ok, String(destination)).toBe(false)
      expect(codeOf(result), String(destination)).toBe('invalid_destination')
    }

    const result = share.validateDestination('https://macrolattice.com/meal/r_8f3k', 'bad host!')
    expect(result.ok).toBe(false)
    expect(codeOf(result)).toBe('invalid_allowed_host')
  })
})

describe('share hook lib: extractTurnstileToken (task 2.3)', () => {
  it('pins the client-contract field name and the Cloudflare siteverify endpoint', () => {
    expect(share.TURNSTILE_TOKEN_FIELD).toBe('turnstileToken')
    expect(share.DEFAULT_TURNSTILE_VERIFY_URL).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    )
  })

  it('returns the trimmed token from the canonical field', () => {
    expect(share.extractTurnstileToken({ turnstileToken: ' token-123 ' })).toBe('token-123')
    expect(share.extractTurnstileToken({ turnstileToken: 'x'.repeat(share.MAX_TURNSTILE_TOKEN_LENGTH) })).toHaveLength(
      share.MAX_TURNSTILE_TOKEN_LENGTH
    )
  })

  it('returns null for missing, blank, oversized, or non-string tokens', () => {
    const cases: unknown[] = [
      null,
      undefined,
      'token-123',
      [],
      {},
      { turnstileToken: '' },
      { turnstileToken: '   ' },
      { turnstileToken: 42 },
      { turnstileToken: null },
      { turnstileToken: 'x'.repeat(share.MAX_TURNSTILE_TOKEN_LENGTH + 1) }
    ]

    for (const body of cases) {
      expect(share.extractTurnstileToken(body), JSON.stringify(body)).toBeNull()
    }
  })
})

describe('share hook lib: verifyTurnstileToken (task 2.3, mocked $http.send)', () => {
  const successResponse = { statusCode: 200, json: { success: true, hostname: 'macrolattice.com' } }

  it('rejects a missing token with turnstile_missing before calling siteverify', () => {
    const mock = createSiteverifyMock(successResponse)
    const result = share.verifyTurnstileToken(null, { secret: 'test-secret', send: mock.send })

    expect(result).toEqual({ ok: false, code: 'turnstile_missing', message: expect.any(String) })
    expect(mock.calls).toHaveLength(0)
  })

  it('fails closed with turnstile_not_configured when the secret or sender is missing', () => {
    for (const secret of [undefined, '', '   ', 42]) {
      const mock = createSiteverifyMock(successResponse)
      const result = share.verifyTurnstileToken('token-123', { secret, send: mock.send })

      expect(result.ok, String(secret)).toBe(false)
      if (!result.ok) expect(result.code).toBe('turnstile_not_configured')
      expect(mock.calls).toHaveLength(0)
    }

    const withoutSender = share.verifyTurnstileToken('token-123', { secret: 'test-secret' })
    expect(withoutSender.ok).toBe(false)
    if (!withoutSender.ok) expect(withoutSender.code).toBe('turnstile_not_configured')
  })

  it('posts the secret and token to the default endpoint with a bounded timeout', () => {
    const mock = createSiteverifyMock(successResponse)
    const result = share.verifyTurnstileToken('token-123', { secret: 'test-secret', send: mock.send })

    expect(result).toEqual({ ok: true })
    expect(mock.calls).toHaveLength(1)

    const call = mock.calls[0]
    expect(call).toBeDefined()
    if (call === undefined) return

    expect(call.url).toBe(share.DEFAULT_TURNSTILE_VERIFY_URL)
    expect(call.method).toBe('POST')
    expect(call.headers['content-type']).toBe('application/json')
    expect(call.timeout).toBe(5)
    expect(JSON.parse(call.body)).toEqual({ secret: 'test-secret', response: 'token-123' })
  })

  it('uses the configured endpoint and forwards remoteIp without emitting it when absent', () => {
    const withIp = createSiteverifyMock(successResponse)
    share.verifyTurnstileToken('token-123', {
      secret: 'test-secret',
      verifyUrl: 'http://127.0.0.1:9999/turnstile/v0/siteverify',
      remoteIp: '203.0.113.7',
      send: withIp.send
    })

    const call = withIp.calls[0]
    expect(call).toBeDefined()
    if (call !== undefined) {
      expect(call.url).toBe('http://127.0.0.1:9999/turnstile/v0/siteverify')
      expect(JSON.parse(call.body)).toEqual({
        secret: 'test-secret',
        response: 'token-123',
        remoteip: '203.0.113.7'
      })
    }

    const withoutIp = createSiteverifyMock(successResponse)
    share.verifyTurnstileToken('token-123', { secret: 'test-secret', remoteIp: '', send: withoutIp.send })
    const anonymousCall = withoutIp.calls[0]
    expect(anonymousCall).toBeDefined()
    if (anonymousCall !== undefined) {
      expect(JSON.parse(anonymousCall.body)).toEqual({ secret: 'test-secret', response: 'token-123' })
    }
  })

  it('defaults an empty verify URL to the Cloudflare endpoint', () => {
    const mock = createSiteverifyMock(successResponse)
    share.verifyTurnstileToken('token-123', { secret: 'test-secret', verifyUrl: '', send: mock.send })

    expect(mock.calls[0]?.url).toBe(share.DEFAULT_TURNSTILE_VERIFY_URL)
  })

  it('clamps the siteverify timeout between 1 and 10 seconds', () => {
    const cases: Array<[number | undefined, number]> = [
      [undefined, 5],
      [0, 5],
      [-3, 5],
      [Number.NaN, 5],
      [1, 1],
      [7, 7],
      [999, 10]
    ]

    for (const [timeout, expected] of cases) {
      const mock = createSiteverifyMock(successResponse)
      share.verifyTurnstileToken('token-123', { secret: 'test-secret', timeout, send: mock.send })
      expect(mock.calls[0]?.timeout, String(timeout)).toBe(expected)
    }
  })

  it('rejects an invalid token with reason "invalid"', () => {
    const mock = createSiteverifyMock({
      statusCode: 200,
      json: { success: false, 'error-codes': ['invalid-input-response'] }
    })
    const result = share.verifyTurnstileToken('bad-token', { secret: 'test-secret', send: mock.send })

    expect(result).toEqual({
      ok: false,
      code: 'turnstile_failed',
      reason: 'invalid',
      message: expect.any(String)
    })
  })

  it('rejects a replayed or expired token with reason "expired_or_duplicate"', () => {
    const mock = createSiteverifyMock({
      statusCode: 200,
      json: { success: false, 'error-codes': ['timeout-or-duplicate'] }
    })
    const result = share.verifyTurnstileToken('replayed-token', { secret: 'test-secret', send: mock.send })

    expect(result).toEqual({
      ok: false,
      code: 'turnstile_failed',
      reason: 'expired_or_duplicate',
      message: expect.any(String)
    })
  })

  it('fails closed with turnstile_unavailable on HTTP errors, malformed payloads, and network failures', () => {
    const responses: unknown[] = [
      { statusCode: 500, json: { success: false } },
      { statusCode: 429, json: {} },
      { statusCode: 200 },
      { statusCode: 200, json: null },
      { statusCode: 200, json: 'not-an-object' },
      { statusCode: 200, json: { success: 'true' } },
      null,
      'not-a-response'
    ]

    for (const response of responses) {
      const mock = createSiteverifyMock(response)
      const result = share.verifyTurnstileToken('token-123', { secret: 'test-secret', send: mock.send })

      expect(result.ok, JSON.stringify(response)).toBe(false)
      if (!result.ok) {
        expect(result.code, JSON.stringify(response)).toBe('turnstile_unavailable')
        expect(result.reason, JSON.stringify(response)).toBeUndefined()
      }
    }

    const throwing = share.verifyTurnstileToken('token-123', {
      secret: 'test-secret',
      send: () => {
        throw new Error('network down')
      }
    })
    expect(throwing.ok).toBe(false)
    if (!throwing.ok) expect(throwing.code).toBe('turnstile_unavailable')
  })

  it('exposes interpretSiteverify as the pure response mapper', () => {
    expect(share.interpretSiteverify({ statusCode: 200, json: { success: true } })).toEqual({ ok: true })
    expect(share.interpretSiteverify({ statusCode: 200, json: { success: false } })).toEqual({
      ok: false,
      code: 'turnstile_failed',
      reason: 'invalid',
      message: expect.any(String)
    })
    expect(share.interpretSiteverify(undefined)).toEqual({
      ok: false,
      code: 'turnstile_unavailable',
      message: expect.any(String)
    })
  })
})

describe('share hook lib: per-IP daily quota (task 2.4)', () => {
  const SALT = 'unit-test-ip-hash-salt'
  const hmac = (text: string, secret: string): string =>
    createHmac('sha256', secret).update(text).digest('hex')

  it('normalizes trustworthy client IPs and rejects absent or malformed values', () => {
    expect(share.normalizeClientIp('203.0.113.7')).toBe('203.0.113.7')
    expect(share.normalizeClientIp('  2001:DB8::1  ')).toBe('2001:db8::1')
    expect(share.normalizeClientIp('[2001:db8::1]')).toBe('2001:db8::1')
    expect(share.normalizeClientIp('198.51.100.10')).toBe('198.51.100.10')

    const rejected: unknown[] = [
      undefined,
      null,
      42,
      '',
      '   ',
      'hello',
      'deadbeef',
      '1.2.3.4, 5.6.7.8',
      '1.2.3.4 5.6.7.8',
      'x'.repeat(65)
    ]
    for (const value of rejected) {
      expect(share.normalizeClientIp(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('hashes the client IP with HMAC-SHA256 and the configured salt (A2 contract)', () => {
    const expected = hmac('203.0.113.7', SALT)
    const digest = share.hashClientIp('203.0.113.7', SALT, hmac)

    expect(digest).toBe(expected)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(share.hashClientIp('203.0.113.7', SALT, hmac)).toBe(digest)
    expect(share.hashClientIp('203.0.113.8', SALT, hmac)).not.toBe(digest)
    expect(share.hashClientIp('203.0.113.7', 'another-salt', hmac)).not.toBe(digest)
  })

  it('fails closed when the IP, salt, or hasher is missing or unusable', () => {
    const invalid: Array<[unknown, unknown, unknown]> = [
      [null, SALT, hmac],
      ['', SALT, hmac],
      ['203.0.113.7', '', hmac],
      ['203.0.113.7', null, hmac],
      ['203.0.113.7', SALT, null],
      ['203.0.113.7', SALT, undefined],
      ['203.0.113.7', SALT, () => 'not-a-hex-digest'],
      ['203.0.113.7', SALT, () => 'A'.repeat(64)],
      [
        '203.0.113.7',
        SALT,
        () => {
          throw new Error('hash failure')
        }
      ]
    ]

    for (const [ip, salt, hash] of invalid) {
      expect(share.hashClientIp(ip, salt, hash)).toBeNull()
    }
  })

  it('computes the UTC day start and the next UTC midnight reset', () => {
    const now = new Date('2026-10-02T13:37:05.250Z')

    expect(share.utcDayStart(now)).toBe('2026-10-02 00:00:00.000Z')
    expect(share.nextUtcMidnight(now)?.toISOString()).toBe('2026-10-03T00:00:00.000Z')
    expect(share.utcDayStart(new Date('2026-10-02T00:00:00.000Z'))).toBe('2026-10-02 00:00:00.000Z')
    expect(share.nextUtcMidnight(new Date('2026-12-31T23:59:59.999Z'))?.toISOString()).toBe(
      '2027-01-01T00:00:00.000Z'
    )
    expect(share.utcDayStart('not-a-date')).toBeNull()
    expect(share.nextUtcMidnight(null)).toBeNull()
  })

  it('builds an app + hashed-IP + UTC-day scoped count query', () => {
    const now = new Date('2026-10-02T13:37:05.250Z')
    const ipHash = hmac('203.0.113.7', SALT)
    const query = share.dailyQuotaQuery({ appId: 'pbc_apps_record', ipHash, now })

    expect(query).not.toBeNull()
    if (query !== null) {
      expect(query.expression).toContain('app = {:app}')
      expect(query.expression).toContain('created_from_ip = {:ip}')
      expect(query.expression).toContain('created >= {:since}')
      expect(query.params).toEqual({
        app: 'pbc_apps_record',
        ip: ipHash,
        since: '2026-10-02 00:00:00.000Z'
      })
    }

    expect(share.dailyQuotaQuery(null)).toBeNull()
    expect(share.dailyQuotaQuery({ appId: '', ipHash, now })).toBeNull()
    expect(share.dailyQuotaQuery({ appId: 'pbc_apps_record', ipHash: 'deadbeef', now })).toBeNull()
    expect(share.dailyQuotaQuery({ appId: 'pbc_apps_record', ipHash, now: 'yesterday' })).toBeNull()

    const otherApp = share.dailyQuotaQuery({ appId: 'other_app_record', ipHash, now })
    expect(otherApp?.params).toEqual({
      app: 'other_app_record',
      ip: ipHash,
      since: '2026-10-02 00:00:00.000Z'
    })
  })

  it('allows requests below the per-app limit and reports the remaining budget', () => {
    const now = new Date('2026-10-02T13:37:05.250Z')

    expect(share.evaluateDailyQuota({ used: 0, limit: 100, now })).toEqual({
      ok: true,
      used: 0,
      limit: 100,
      remaining: 100
    })
    expect(share.evaluateDailyQuota({ used: 99, limit: 100, now })).toEqual({
      ok: true,
      used: 99,
      limit: 100,
      remaining: 1
    })
    expect(share.evaluateDailyQuota({ used: 1, limit: 2, now })).toEqual({
      ok: true,
      used: 1,
      limit: 2,
      remaining: 1
    })
  })

  it('rejects requests at or above the limit with the reset time and retry hint', () => {
    const now = new Date('2026-10-02T13:37:05.250Z')

    expect(share.evaluateDailyQuota({ used: 100, limit: 100, now })).toEqual({
      ok: false,
      code: 'quota_exceeded',
      used: 100,
      limit: 100,
      resetAt: '2026-10-03T00:00:00.000Z',
      retryAfterSeconds: 37375
    })
    expect(share.evaluateDailyQuota({ used: 101, limit: 100, now })).toEqual({
      ok: false,
      code: 'quota_exceeded',
      used: 101,
      limit: 100,
      resetAt: '2026-10-03T00:00:00.000Z',
      retryAfterSeconds: 37375
    })

    const atMidnight = new Date('2026-10-02T00:00:00.000Z')
    expect(share.evaluateDailyQuota({ used: 1, limit: 1, now: atMidnight })).toEqual({
      ok: false,
      code: 'quota_exceeded',
      used: 1,
      limit: 1,
      resetAt: '2026-10-03T00:00:00.000Z',
      retryAfterSeconds: 86400
    })

    const newYearsEve = new Date('2026-12-31T23:00:00.000Z')
    expect(share.evaluateDailyQuota({ used: 5, limit: 5, now: newYearsEve })).toEqual({
      ok: false,
      code: 'quota_exceeded',
      used: 5,
      limit: 5,
      resetAt: '2027-01-01T00:00:00.000Z',
      retryAfterSeconds: 3600
    })
  })

  it('fails closed on invalid quota inputs', () => {
    const now = new Date('2026-10-02T13:37:05.250Z')
    const invalid: unknown[] = [
      undefined,
      null,
      'quota',
      { used: -1, limit: 2, now },
      { used: 1.5, limit: 2, now },
      { used: Number.NaN, limit: 2, now },
      { used: '1', limit: 2, now },
      { used: 0, limit: 0, now },
      { used: 0, limit: -5, now },
      { used: 0, limit: 2, now: 'yesterday' },
      { used: 0, limit: 2, now: null }
    ]

    for (const input of invalid) {
      const result = share.evaluateDailyQuota(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) {
        expect(result.code, JSON.stringify(input)).toBe('quota_input_invalid')
      }
    }
  })
})

describe('share hook lib: slug generator (task 2.6)', () => {
  const ALPHABET_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')

  describe('constants and entropy budget', () => {
    it('uses a 62-character unique alphanumeric alphabet', () => {
      expect(share.SLUG_ALPHABET).toHaveLength(62)
      expect(new Set(share.SLUG_ALPHABET.split(''))).toEqual(ALPHABET_CHARS)
      expect(share.SLUG_ALPHABET).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('meets the spec entropy budget: at least 7 chars and 62^7 >= 2^41', () => {
      expect(share.SLUG_LENGTH).toBeGreaterThanOrEqual(7)
      const keyspace = Math.pow(share.SLUG_ALPHABET.length, share.SLUG_LENGTH)
      expect(keyspace).toBeGreaterThanOrEqual(Math.pow(2, 41))
      expect(keyspace).toBe(3_521_614_606_208)
    })

    it('pins the slug pattern and a positive collision-retry budget', () => {
      expect(share.SLUG_PATTERN).toEqual(new RegExp(`^[A-Za-z0-9]{${share.SLUG_LENGTH}}$`))
      expect(Number.isInteger(share.MAX_SLUG_COLLISION_RETRIES)).toBe(true)
      expect(share.MAX_SLUG_COLLISION_RETRIES).toBeGreaterThan(0)
    })
  })

  describe('generateSlug', () => {
    it('builds the slug from the injected random source with the fixed length and alphabet', () => {
      const calls: Array<[number, string]> = []
      const slug = share.generateSlug((length: number, alphabet: string) => {
        calls.push([length, alphabet])
        return 'Ab3xK9z'
      })

      expect(slug).toBe('Ab3xK9z')
      expect(calls).toEqual([[share.SLUG_LENGTH, share.SLUG_ALPHABET]])
    })

    it('rejects generator output with a wrong length or characters outside the alphabet', () => {
      const badOutputs: unknown[] = [
        'Ab3xK9',
        'Ab3xK9zz',
        '',
        'Ab3xK9!',
        'áb3xK9z',
        'Ab3xK9 ',
        123,
        null,
        undefined
      ]

      for (const output of badOutputs) {
        expect(share.generateSlug(() => output), String(output)).toBeNull()
      }
    })

    it('fails closed on a missing, non-function, or throwing random source', () => {
      expect(share.generateSlug(undefined)).toBeNull()
      expect(share.generateSlug('random')).toBeNull()
      expect(
        share.generateSlug(() => {
          throw new Error('crypto unavailable')
        })
      ).toBeNull()
    })
  })

  describe('generateSlugWithCollisionRetry', () => {
    it('accepts the first collision-free candidate with one attempt', () => {
      const generated: string[] = []
      const result = share.generateSlugWithCollisionRetry({
        generate: () => {
          const slug = 'firstok'
          generated.push(slug)
          return slug
        },
        exists: () => false,
        maxRetries: share.MAX_SLUG_COLLISION_RETRIES
      })

      expect(result).toEqual({ ok: true, slug: 'firstok', attempts: 1 })
      expect(generated).toEqual(['firstok'])
    })

    it('retries past collisions and returns the first free candidate in order', () => {
      const queue = ['taken1', 'taken2', 'freeabc']
      const checked: string[] = []
      const result = share.generateSlugWithCollisionRetry({
        generate: () => queue.shift() ?? 'never',
        exists: (slug: string) => {
          checked.push(slug)
          return slug.startsWith('taken')
        },
        maxRetries: share.MAX_SLUG_COLLISION_RETRIES
      })

      expect(result).toEqual({ ok: true, slug: 'freeabc', attempts: 3 })
      expect(checked).toEqual(['taken1', 'taken2', 'freeabc'])
    })

    it('fails closed after exhausting the retry budget with every candidate taken', () => {
      let generated = 0
      const result = share.generateSlugWithCollisionRetry({
        generate: () => {
          generated += 1
          return 'alltaken'
        },
        exists: () => true,
        maxRetries: 4
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('slug_generation_failed')
      }
      expect(generated).toBe(5)
    })

    it('fails immediately without retrying when the random source is broken', () => {
      let generated = 0
      const result = share.generateSlugWithCollisionRetry({
        generate: () => {
          generated += 1
          return null
        },
        exists: () => false,
        maxRetries: share.MAX_SLUG_COLLISION_RETRIES
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('slug_generation_failed')
      }
      expect(generated).toBe(1)
    })

    it('fails closed when the collision check throws', () => {
      const result = share.generateSlugWithCollisionRetry({
        generate: () => 'candidate',
        exists: () => {
          throw new Error('database unavailable')
        },
        maxRetries: share.MAX_SLUG_COLLISION_RETRIES
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('slug_collision_check_failed')
      }
    })

    it('rejects invalid input shapes', () => {
      const invalid: unknown[] = [
        undefined,
        null,
        'slugs',
        { exists: () => false, maxRetries: 1 },
        { generate: () => 'x', maxRetries: 1 },
        { generate: 'gen', exists: () => false, maxRetries: 1 },
        { generate: () => 'x', exists: 'yes', maxRetries: 1 },
        { generate: () => 'x', exists: () => false, maxRetries: -1 },
        { generate: () => 'x', exists: () => false, maxRetries: 1.5 }
      ]

      for (const input of invalid) {
        const result = share.generateSlugWithCollisionRetry(input)
        expect(result.ok, JSON.stringify(input) ?? String(input)).toBe(false)
        if (!result.ok) {
          expect(result.code, JSON.stringify(input) ?? String(input)).toBe('slug_input_invalid')
        }
      }
    })

    it('still performs one attempt with zero retries', () => {
      const result = share.generateSlugWithCollisionRetry({
        generate: () => 'single1',
        exists: () => false,
        maxRetries: 0
      })

      expect(result).toEqual({ ok: true, slug: 'single1', attempts: 1 })
    })
  })

  describe('entropy and collision sampling', () => {
    it('produces unique in-alphabet slugs across a large uniform sample', () => {
      const sampleSize = 20_000
      const seen = new Set<string>()
      const charCounts = new Map<string, number>()

      for (let i = 0; i < sampleSize; i++) {
        const slug = share.generateSlug(
          (length: number, alphabet: string) =>
            Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join('')
        )
        expect(slug).not.toBeNull()
        if (slug === null) continue
        expect(slug).toMatch(share.SLUG_PATTERN)

        seen.add(slug)
        for (const char of slug) {
          charCounts.set(char, (charCounts.get(char) ?? 0) + 1)
        }
      }

      // Keyspace is 62^7 ≈ 3.5e12, so 20k draws must not collide.
      expect(seen.size).toBe(sampleSize)
      // Every alphabet character must occur (expected ≈ 2258 per char).
      expect(charCounts.size).toBe(62)
      for (const char of ALPHABET_CHARS) {
        const count = charCounts.get(char) ?? 0
        expect(count, `character ${char}`).toBeGreaterThan(1200)
        expect(count, `character ${char}`).toBeLessThan(3400)
      }
    })
  })

  describe('slugCollisionQuery', () => {
    it('builds a parameterized per-app collision query', () => {
      expect(share.SLUG_COLLISION_QUERY_EXPRESSION).toBe('app = {:app} AND slug = {:slug}')
      expect(share.slugCollisionQuery('abc123def456ghi', 'Ab3xK9z')).toEqual({
        expression: 'app = {:app} AND slug = {:slug}',
        params: { app: 'abc123def456ghi', slug: 'Ab3xK9z' }
      })
    })

    it('rejects invalid app ids or slug candidates', () => {
      expect(share.slugCollisionQuery('', 'Ab3xK9z')).toBeNull()
      expect(share.slugCollisionQuery(123, 'Ab3xK9z')).toBeNull()
      expect(share.slugCollisionQuery('a'.repeat(65), 'Ab3xK9z')).toBeNull()
      expect(share.slugCollisionQuery('abc123', 'Ab3xK9')).toBeNull()
      expect(share.slugCollisionQuery('abc123', 'Ab3xK9z!')).toBeNull()
      expect(share.slugCollisionQuery('abc123', '')).toBeNull()
      expect(share.slugCollisionQuery('abc123', null)).toBeNull()
    })
  })

  describe('client-supplied slug handling', () => {
    it('ignores client slug and url fields when parsing the content reference', () => {
      const result = share.parseContentReference({
        ...validBody,
        slug: 'my-custom-slug',
        url: 'https://macrolattice.com/override',
        customSlug: 'brand'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(Object.keys(result.value).sort()).toEqual(['appId', 'contentId', 'params', 'type'])
        expect('slug' in result.value).toBe(false)
        expect('url' in result.value).toBe(false)
      }
    })
  })
})

interface KVServerMock {
  calls: KVCall[]
  send: (config: KVCall) => unknown
}

function createKVMock(response: unknown, throwOnCall = false): KVServerMock {
  const calls: KVCall[] = []
  return {
    calls,
    send: (config: KVCall) => {
      calls.push(config)
      if (throwOnCall) throw new Error('network down')
      return response
    }
  }
}

const kvEnv = {
  [share.KV_ENV_ACCOUNT_ID]: 'ci-account',
  [share.KV_ENV_NAMESPACE_ID]: 'ci-namespace',
  [share.KV_ENV_API_TOKEN]: 'ci-kv-token'
}

describe('share hook lib: KV publisher (task 2.7)', () => {
  const baseConfig = {
    accountId: 'ci-account',
    namespaceId: 'ci-namespace',
    apiToken: 'ci-kv-token',
    apiUrl: share.KV_API_BASE_URL
  }

  describe('kvConfigFromEnv', () => {
    it('builds the publisher config from the CF env with the default API base URL', () => {
      expect(share.kvConfigFromEnv((name: string) => kvEnv[name] ?? null)).toEqual(baseConfig)
    })

    it('honors the CF_KV_API_URL override and strips trailing slashes', () => {
      const config = share.kvConfigFromEnv((name: string) =>
        name === share.KV_ENV_API_URL ? 'http://127.0.0.1:9/client/v4///' : kvEnv[name] ?? null
      )
      expect(config).toEqual({ ...baseConfig, apiUrl: 'http://127.0.0.1:9/client/v4' })
    })

    it('returns null when any required variable is missing or blank', () => {
      for (const missing of [share.KV_ENV_ACCOUNT_ID, share.KV_ENV_NAMESPACE_ID, share.KV_ENV_API_TOKEN]) {
        const env: Record<string, string | null> = { ...kvEnv }
        env[missing] = null
        expect(share.kvConfigFromEnv((name: string) => env[name] ?? null), `missing ${missing}`).toBeNull()

        env[missing] = '   '
        expect(share.kvConfigFromEnv((name: string) => env[name] ?? null), `blank ${missing}`).toBeNull()
      }
    })

    it('returns null for a non-function getter or a throwing getter', () => {
      expect(share.kvConfigFromEnv(null)).toBeNull()
      expect(share.kvConfigFromEnv('env')).toBeNull()
      expect(
        share.kvConfigFromEnv(() => {
          throw new Error('no os module')
        })
      ).toBeNull()
    })
  })

  describe('kvLinkKey / kvSlugPath', () => {
    it('composes the host-keyed namespace key from share host and path', () => {
      expect(share.kvLinkKey('sh.macrolattice.com', '/Ab3xK9z')).toBe('sh.macrolattice.com:/Ab3xK9z')
    })

    it('canonicalizes the share host (case, trailing dot)', () => {
      expect(share.kvLinkKey('SH.Macrolattice.COM.', '/Ab3xK9z')).toBe('sh.macrolattice.com:/Ab3xK9z')
    })

    it('rejects invalid share hosts', () => {
      for (const host of ['', 'sh .host', 'sh_host.com', '-bad.com', 'a..b', 42, null, undefined]) {
        expect(share.kvLinkKey(host, '/Ab3xK9z'), `host ${String(host)}`).toBeNull()
      }
    })

    it('rejects paths without a leading slash or with unsafe characters', () => {
      for (const path of ['', 'Ab3xK9z', '/a b', '/a\tb', '/a\\b', '/a\nb', 42, null]) {
        expect(share.kvLinkKey('sh.macrolattice.com', path), `path ${String(path)}`).toBeNull()
      }
    })

    it('rejects keys that exceed the length cap', () => {
      const longPath = `/${'a'.repeat(share.KV_MAX_KEY_LENGTH)}`
      expect(share.kvLinkKey('sh.macrolattice.com', longPath)).toBeNull()
    })

    it('builds the slug path and validates transport safety only', () => {
      expect(share.kvSlugPath('Ab3xK9z')).toBe('/Ab3xK9z')
      // Transport-safe non-generator slugs still publish (legacy/operator rows).
      expect(share.kvSlugPath('quota-seed-1')).toBe('/quota-seed-1')
    })

    it('rejects unsafe slug paths', () => {
      for (const slug of ['', 'a/b', 'a\\b', 'a b', 'a\tb', 'a'.repeat(129), 42, null]) {
        expect(share.kvSlugPath(slug), `slug ${String(slug)}`).toBeNull()
      }
    })
  })

  describe('kvValuesUrl', () => {
    it('builds the KV values REST URL with an encoded key', () => {
      expect(share.kvValuesUrl(baseConfig, 'sh.macrolattice.com:/Ab3xK9z')).toBe(
        'https://api.cloudflare.com/client/v4/accounts/ci-account/storage/kv/namespaces/ci-namespace/values/sh.macrolattice.com%3A%2FAb3xK9z'
      )
    })

    it('rejects incomplete configs or keys', () => {
      expect(share.kvValuesUrl(null, 'k')).toBeNull()
      expect(share.kvValuesUrl({ ...baseConfig, namespaceId: '' }, 'k')).toBeNull()
      expect(share.kvValuesUrl(baseConfig, '')).toBeNull()
      expect(share.kvValuesUrl(baseConfig, null)).toBeNull()
    })
  })

  describe('interpretKVResponse', () => {
    it('accepts a 200 KV API response', () => {
      expect(share.interpretKVResponse({ statusCode: 200, json: { success: true } })).toEqual({
        ok: true,
        status: 200
      })
    })

    it('maps failure statuses to stable codes', () => {
      expect(share.interpretKVResponse({ statusCode: 401 })).toEqual({
        ok: false,
        code: 'kv_auth_failed',
        status: 401
      })
      expect(share.interpretKVResponse({ statusCode: 403 }).code).toBe('kv_auth_failed')
      expect(share.interpretKVResponse({ statusCode: 429 }).code).toBe('kv_rate_limited')
      expect(share.interpretKVResponse({ statusCode: 500 }).code).toBe('kv_unavailable')
      expect(share.interpretKVResponse({ statusCode: 503 }).code).toBe('kv_unavailable')
      expect(share.interpretKVResponse({ statusCode: 400 }).code).toBe('kv_request_rejected')
      expect(share.interpretKVResponse({ statusCode: 418 }).code).toBe('kv_request_rejected')
    })

    it('treats malformed sender output as unavailable', () => {
      for (const response of [null, undefined, 'text', 42, {}, { statusCode: '200' }]) {
        const outcome = share.interpretKVResponse(response)
        expect(outcome.ok, JSON.stringify(response) ?? String(response)).toBe(false)
        if (!outcome.ok) {
          expect(outcome.code).toBe('kv_unavailable')
          expect(outcome.status).toBeNull()
        }
      }
    })
  })

  describe('clampKVTimeout', () => {
    it('mirrors the shared 5s default / 10s cap', () => {
      expect(share.clampKVTimeout(undefined)).toBe(5)
      expect(share.clampKVTimeout(0)).toBe(5)
      expect(share.clampKVTimeout(-3)).toBe(5)
      expect(share.clampKVTimeout(1.9)).toBe(1)
      expect(share.clampKVTimeout(5)).toBe(5)
      expect(share.clampKVTimeout(99)).toBe(10)
    })
  })

  describe('createKVPublishMetrics', () => {
    it('starts at zero and records successes, failures, and failure codes', () => {
      const metrics = share.createKVPublishMetrics()
      expect(metrics.snapshot()).toEqual({
        publishAttempts: 0,
        publishFailures: 0,
        deleteAttempts: 0,
        deleteFailures: 0,
        failureCodes: {}
      })

      metrics.recordPublishSuccess()
      metrics.recordPublishFailure('kv_unavailable')
      metrics.recordPublishFailure('kv_unavailable')
      metrics.recordPublishFailure('kv_auth_failed')
      metrics.recordDeleteSuccess()
      metrics.recordDeleteFailure('kv_network_error')

      const snapshot = metrics.snapshot()
      expect(snapshot.publishAttempts).toBe(4)
      expect(snapshot.publishFailures).toBe(3)
      expect(snapshot.deleteAttempts).toBe(2)
      expect(snapshot.deleteFailures).toBe(1)
      expect(snapshot.failureCodes).toEqual({ kv_unavailable: 2, kv_auth_failed: 1, kv_network_error: 1 })
    })

    it('returns snapshots that do not alias internal state', () => {
      const metrics = share.createKVPublishMetrics()
      const snapshot = metrics.snapshot()
      snapshot.failureCodes.kv_unavailable = 99
      metrics.recordPublishFailure('kv_unavailable')
      expect(metrics.snapshot().failureCodes).toEqual({ kv_unavailable: 1 })
    })

    it('exposes one process-wide singleton for the record hooks', () => {
      const first = share.kvPublishMetrics()
      first.recordDeleteSuccess()
      expect(share.kvPublishMetrics()).toBe(first)
      expect(share.kvPublishMetrics().snapshot().deleteAttempts).toBe(1)
    })
  })

  describe('publishShareLinkToKV', () => {
    const publishInput = {
      shareHost: 'sh.macrolattice.com',
      path: '/Ab3xK9z',
      id: 'rec123',
      destination: 'https://macrolattice.com/meal/r_8f3k',
      isActive: true
    }

    it('PUTs the RedirectRule-shaped value to the encoded key with bearer auth', () => {
      const mock = createKVMock({ statusCode: 200 })
      const metrics = share.createKVPublishMetrics()

      const result = share.publishShareLinkToKV(publishInput, {
        send: mock.send,
        config: baseConfig,
        metrics
      })

      expect(result).toEqual({ ok: true, key: 'sh.macrolattice.com:/Ab3xK9z', status: 200 })
      expect(mock.calls).toHaveLength(1)
      const call = mock.calls[0]
      expect(call.method).toBe('PUT')
      expect(call.url).toBe(share.kvValuesUrl(baseConfig, 'sh.macrolattice.com:/Ab3xK9z'))
      expect(call.headers['Authorization']).toBe('Bearer ci-kv-token')
      expect(call.headers['Content-Type']).toBe('application/json')
      expect(call.timeout).toBe(5)
      expect(JSON.parse(call.body ?? '{}')).toEqual({
        id: 'rec123',
        path: '/Ab3xK9z',
        destination: 'https://macrolattice.com/meal/r_8f3k',
        code: share.KV_REDIRECT_CODE,
        isActive: true
      })
      expect(metrics.snapshot()).toEqual({
        publishAttempts: 1,
        publishFailures: 0,
        deleteAttempts: 0,
        deleteFailures: 0,
        failureCodes: {}
      })
    })

    it('publishes inactive records with isActive false and tolerates a missing id', () => {
      const mock = createKVMock({ statusCode: 200 })

      share.publishShareLinkToKV(
        { ...publishInput, id: undefined, isActive: false },
        { send: mock.send, config: baseConfig }
      )

      expect(JSON.parse(mock.calls[0]?.body ?? '{}')).toMatchObject({ id: '', isActive: false })
    })

    it('skips without counting a failure when the publisher is unconfigured', () => {
      const mock = createKVMock({ statusCode: 200 })
      const metrics = share.createKVPublishMetrics()

      const withoutConfig = share.publishShareLinkToKV(publishInput, { send: mock.send, metrics })
      const withoutSend = share.publishShareLinkToKV(publishInput, { config: baseConfig, metrics })

      expect(withoutConfig).toEqual({ ok: false, code: 'kv_not_configured', status: null, skipped: true })
      expect(withoutSend).toEqual({ ok: false, code: 'kv_not_configured', status: null, skipped: true })
      expect(mock.calls).toHaveLength(0)
      expect(metrics.snapshot().publishFailures).toBe(0)
      expect(metrics.snapshot().publishAttempts).toBe(0)
    })

    it('counts and reports API failures without throwing', () => {
      const metrics = share.createKVPublishMetrics()
      for (const [status, expectedCode] of [
        [500, 'kv_unavailable'],
        [401, 'kv_auth_failed'],
        [429, 'kv_rate_limited'],
        [400, 'kv_request_rejected']
      ] as Array<[number, string]>) {
        const mock = createKVMock({ statusCode: status })
        const result = share.publishShareLinkToKV(publishInput, { send: mock.send, config: baseConfig, metrics })
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.code).toBe(expectedCode)
          expect(result.status).toBe(status)
        }
      }

      const snapshot = metrics.snapshot()
      expect(snapshot.publishAttempts).toBe(4)
      expect(snapshot.publishFailures).toBe(4)
      expect(snapshot.failureCodes).toEqual({
        kv_unavailable: 1,
        kv_auth_failed: 1,
        kv_rate_limited: 1,
        kv_request_rejected: 1
      })
    })

    it('counts network errors from a throwing sender', () => {
      const mock = createKVMock(null, true)
      const metrics = share.createKVPublishMetrics()

      const result = share.publishShareLinkToKV(publishInput, { send: mock.send, config: baseConfig, metrics })

      expect(result).toEqual({ ok: false, code: 'kv_network_error', status: null })
      expect(metrics.snapshot().publishFailures).toBe(1)
      expect(metrics.snapshot().failureCodes).toEqual({ kv_network_error: 1 })
    })

    it('fails closed with kv_input_invalid on malformed input, without calling send', () => {
      const mock = createKVMock({ statusCode: 200 })
      const metrics = share.createKVPublishMetrics()

      const invalidInputs = [
        null,
        {},
        { ...publishInput, shareHost: 'bad host' },
        { ...publishInput, path: 'Ab3xK9z' },
        { ...publishInput, destination: '' },
        { ...publishInput, destination: 'x'.repeat(2049) }
      ]
      for (const input of invalidInputs) {
        const result = share.publishShareLinkToKV(input, { send: mock.send, config: baseConfig, metrics })
        expect(result.ok, JSON.stringify(input) ?? String(input)).toBe(false)
        if (!result.ok) {
          expect(result.code).toBe('kv_input_invalid')
        }
      }

      expect(mock.calls).toHaveLength(0)
      expect(metrics.snapshot().publishFailures).toBe(invalidInputs.length)
      expect(metrics.snapshot().failureCodes).toEqual({ kv_input_invalid: invalidInputs.length })
    })

    it('clamps the configured timeout into the request', () => {
      const mock = createKVMock({ statusCode: 200 })
      share.publishShareLinkToKV(publishInput, { send: mock.send, config: baseConfig, timeout: 99 })
      expect(mock.calls[0]?.timeout).toBe(10)
    })
  })

  describe('deleteShareLinkFromKV', () => {
    it('DELETEs the encoded key with bearer auth and no body', () => {
      const mock = createKVMock({ statusCode: 200 })
      const metrics = share.createKVPublishMetrics()

      const result = share.deleteShareLinkFromKV(
        { shareHost: 'sh.macrolattice.com', path: '/Ab3xK9z' },
        { send: mock.send, config: baseConfig, metrics }
      )

      expect(result).toEqual({ ok: true, key: 'sh.macrolattice.com:/Ab3xK9z', status: 200 })
      expect(mock.calls).toHaveLength(1)
      expect(mock.calls[0]?.method).toBe('DELETE')
      expect(mock.calls[0]?.body).toBeUndefined()
      expect(mock.calls[0]?.headers['Authorization']).toBe('Bearer ci-kv-token')
      expect(metrics.snapshot()).toEqual({
        publishAttempts: 0,
        publishFailures: 0,
        deleteAttempts: 1,
        deleteFailures: 0,
        failureCodes: {}
      })
    })

    it('skips when unconfigured, counts failures, and validates the key', () => {
      const okMock = createKVMock({ statusCode: 200 })
      const failingMock = createKVMock({ statusCode: 500 })
      const metrics = share.createKVPublishMetrics()

      const skipped = share.deleteShareLinkFromKV(
        { shareHost: 'sh.macrolattice.com', path: '/Ab3xK9z' },
        { send: okMock.send }
      )
      expect(skipped).toEqual({ ok: false, code: 'kv_not_configured', status: null, skipped: true })
      expect(okMock.calls).toHaveLength(0)

      const rejected = share.deleteShareLinkFromKV(
        { shareHost: 'sh.macrolattice.com', path: '/Ab3xK9z' },
        { send: failingMock.send, config: baseConfig, metrics }
      )
      expect(rejected).toEqual({ ok: false, code: 'kv_unavailable', status: 500 })

      const invalid = share.deleteShareLinkFromKV(
        { shareHost: 'sh.macrolattice.com', path: 'no-slash' },
        { send: failingMock.send, config: baseConfig, metrics }
      )
      expect(invalid).toEqual({ ok: false, code: 'kv_input_invalid', status: null })

      const throwing = share.deleteShareLinkFromKV(
        { shareHost: 'sh.macrolattice.com', path: '/Ab3xK9z' },
        { send: createKVMock(null, true).send, config: baseConfig, metrics }
      )
      expect(throwing).toEqual({ ok: false, code: 'kv_network_error', status: null })

      expect(metrics.snapshot().deleteAttempts).toBe(3)
      expect(metrics.snapshot().deleteFailures).toBe(3)
      expect(metrics.snapshot().failureCodes).toEqual({
        kv_unavailable: 1,
        kv_input_invalid: 1,
        kv_network_error: 1
      })
    })
  })
})

describe('share hook lib: parseResolveQuery (task 2.8)', () => {
  it('accepts a canonical host and single-segment path', () => {
    const result = share.parseResolveQuery({ host: 'sh.macrolattice.com', path: '/Ab3xK9z' })

    expect(result).toEqual({
      ok: true,
      host: 'sh.macrolattice.com',
      path: '/Ab3xK9z',
      slug: 'Ab3xK9z'
    })
  })

  it('canonicalizes the host like the KV key half (case, trailing dot, padding)', () => {
    const result = share.parseResolveQuery({ host: '  SH.MacroLattice.COM.  ', path: '/abc1234' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.host).toBe('sh.macrolattice.com')
      expect(result.slug).toBe('abc1234')
    }
  })

  it('preserves slug case: the path is an exact key, never lowercased', () => {
    const result = share.parseResolveQuery({ host: 'sh.macrolattice.com', path: '/AbC123x' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.slug).toBe('AbC123x')
    }
  })

  it('rejects missing, empty, malformed or oversized hosts', () => {
    for (const host of [undefined, null, '', '   ', 'not_a_host', 'has space.com', 'a'.repeat(254), 42]) {
      const result = share.parseResolveQuery({ host, path: '/Ab3xK9z' })
      expect(result.ok, `host ${JSON.stringify(host)}`).toBe(false)
      if (!result.ok) {
        expect(result.fields.map((error) => error.field)).toContain('host')
      }
    }
  })

  it('rejects paths without a leading slash, empty segments, or multiple segments', () => {
    for (const path of [undefined, null, '', 'Ab3xK9z', '/', '//', '/a/b', '/a/', 42]) {
      const result = share.parseResolveQuery({ host: 'sh.macrolattice.com', path })
      expect(result.ok, `path ${JSON.stringify(path)}`).toBe(false)
      if (!result.ok) {
        expect(result.fields.map((error) => error.field)).toContain('path')
      }
    }
  })

  it('rejects paths with unsafe transport characters or oversized slugs', () => {
    for (const path of ['/ab cd', '/ab\tcd', '/ab\\cd', `/${'a'.repeat(129)}`]) {
      const result = share.parseResolveQuery({ host: 'sh.macrolattice.com', path })
      expect(result.ok, `path ${JSON.stringify(path)}`).toBe(false)
      if (!result.ok) {
        expect(result.fields.map((error) => error.field)).toContain('path')
      }
    }
  })

  it('accepts printable-ASCII oddities that can never match a slug (exact-key lookup decides)', () => {
    // Same transport rule as the KV publisher's path half: printable ASCII,
    // single segment. Quotes or semicolons are not injection vectors here
    // (lookups use named parameters) and simply miss every stored slug.
    for (const path of ['/"quoted"', '/a;b', '/%41']) {
      expect(share.parseResolveQuery({ host: 'sh.macrolattice.com', path }).ok, path).toBe(true)
    }
  })

  it('rejects non-object queries and reports both invalid fields together', () => {
    for (const query of [null, undefined, 'host', 42, []]) {
      expect(share.parseResolveQuery(query).ok, JSON.stringify(query)).toBe(false)
    }

    const both = share.parseResolveQuery({ host: '', path: 'nope' })
    expect(both.ok).toBe(false)
    if (!both.ok) {
      expect(both.code).toBe('invalid_request')
      expect(both.fields.map((error) => error.field).sort()).toEqual(['host', 'path'])
    }
  })
})

describe('share hook lib: evaluateResolveAuth (task 2.8)', () => {
  const hmacHash = (value: string, key: string): string =>
    createHmac('sha256', key).update(value).digest('hex')

  it('accepts the correct bearer secret with and without a timing-safe hash', () => {
    expect(share.evaluateResolveAuth('Bearer ci-secret', 'ci-secret', hmacHash).ok).toBe(true)
    expect(share.evaluateResolveAuth('Bearer ci-secret', 'ci-secret', undefined).ok).toBe(true)
  })

  it('accepts a case-insensitive scheme and surrounding whitespace, trims secret config', () => {
    expect(share.evaluateResolveAuth('bearer ci-secret', 'ci-secret', hmacHash).ok).toBe(true)
    expect(share.evaluateResolveAuth('  Bearer   ci-secret  ', 'ci-secret', hmacHash).ok).toBe(true)
    expect(share.evaluateResolveAuth('Bearer ci-secret', '  ci-secret  ', hmacHash).ok).toBe(true)
  })

  it('rejects wrong secrets identically with and without the hash', () => {
    for (const hash of [hmacHash, undefined]) {
      const result = share.evaluateResolveAuth('Bearer wrong-secret', 'ci-secret', hash)
      expect(result).toEqual({
        ok: false,
        code: 'resolve_unauthorized',
        message: 'A valid bearer secret is required'
      })
    }
  })

  it('rejects missing, empty, and non-bearer authorization headers', () => {
    for (const header of [undefined, null, '', 'Bearer', 'Bearer ', 'Basic ci-secret', 'ci-secret', 42]) {
      const result = share.evaluateResolveAuth(header, 'ci-secret', hmacHash)
      expect(result.ok, `header ${JSON.stringify(header)}`).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('resolve_unauthorized')
      }
    }
  })

  it('fails closed with resolve_not_configured when the server secret is unset', () => {
    for (const secret of [undefined, null, '', '   ', 42]) {
      const result = share.evaluateResolveAuth('Bearer ci-secret', secret, hmacHash)
      expect(result.ok, `secret ${JSON.stringify(secret)}`).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('resolve_not_configured')
      }
    }
  })

  it('fails closed when the injected hash throws', () => {
    const throwingHash = (): string => {
      throw new Error('hash unavailable')
    }

    const result = share.evaluateResolveAuth('Bearer ci-secret', 'ci-secret', throwingHash)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('resolve_unauthorized')
    }
  })
})

describe('share hook lib: resolve rate limiter (task 2.8)', () => {
  it('derives the bucket key from the trusted client IP and falls back to one shared bucket', () => {
    expect(share.resolveRateKey('198.51.100.10')).toBe('198.51.100.10')
    expect(share.resolveRateKey(' 2001:DB8::1 ')).toBe('2001:db8::1')
    expect(share.resolveRateKey('[2001:db8::1]')).toBe('2001:db8::1')

    for (const value of [undefined, null, '', 'garbage', 'not an ip']) {
      expect(share.resolveRateKey(value), JSON.stringify(value)).toBe('unknown')
    }
  })

  it('parses the per-minute limit with bounds and rejects garbage', () => {
    expect(share.parseResolveRateLimitPerMinute(300)).toBe(300)
    expect(share.parseResolveRateLimitPerMinute('42')).toBe(42)
    expect(share.parseResolveRateLimitPerMinute(' 7 ')).toBe(7)
    expect(share.parseResolveRateLimitPerMinute(2.9)).toBe(2)
    expect(share.parseResolveRateLimitPerMinute(100000)).toBe(100000)

    for (const value of ['abc', '', '   ', null, undefined, 0, -1, 1.5e9, Number.NaN]) {
      expect(share.parseResolveRateLimitPerMinute(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('rejects invalid limiter configurations', () => {
    for (const config of [null, undefined, 'x', {}, { max: 0, windowMs: 1000, now: () => 0 }, { max: 5, windowMs: 0, now: () => 0 }, { max: 5, windowMs: 1000 }]) {
      expect(share.createResolveRateLimiter(config), JSON.stringify(config)).toBeNull()
    }
  })

  it('allows up to max requests per window then denies with a bounded retry hint', () => {
    let clock = 120_000
    const limiter = share.createResolveRateLimiter({ max: 3, windowMs: 60_000, now: () => clock })

    expect(limiter?.take('ip-a')).toEqual({ allowed: true, count: 1, remaining: 2, retryAfterSeconds: 0 })
    expect(limiter?.take('ip-a')).toEqual({ allowed: true, count: 2, remaining: 1, retryAfterSeconds: 0 })
    expect(limiter?.take('ip-a')).toEqual({ allowed: true, count: 3, remaining: 0, retryAfterSeconds: 0 })

    const denied = limiter?.take('ip-a')
    expect(denied?.allowed).toBe(false)
    expect(denied?.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(denied?.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('resets the counter when the fixed window rolls over', () => {
    let clock = 120_000
    const limiter = share.createResolveRateLimiter({ max: 1, windowMs: 60_000, now: () => clock })

    expect(limiter?.take('ip-a').allowed).toBe(true)
    expect(limiter?.take('ip-a').allowed).toBe(false)

    clock += 60_001
    expect(limiter?.take('ip-a')).toEqual({ allowed: true, count: 1, remaining: 0, retryAfterSeconds: 0 })
  })

  it('isolates buckets per key', () => {
    const clock = 500_000
    const limiter = share.createResolveRateLimiter({ max: 1, windowMs: 60_000, now: () => clock })

    expect(limiter?.take('ip-a').allowed).toBe(true)
    expect(limiter?.take('ip-a').allowed).toBe(false)
    expect(limiter?.take('ip-b').allowed).toBe(true)
  })

  it('bounds memory by clearing stale buckets once maxKeys is exceeded', () => {
    let clock = 0
    const limiter = share.createResolveRateLimiter({ max: 1, windowMs: 60_000, maxKeys: 2, now: () => clock })

    expect(limiter?.take('ip-a').allowed).toBe(true)
    expect(limiter?.take('ip-b').allowed).toBe(true)
    expect(limiter?.take('ip-c').allowed).toBe(true)
    // The clear-on-overflow reset the map, so a previously exhausted key is fresh.
    expect(limiter?.take('ip-a').allowed).toBe(true)
  })

  it('fails open when the injected clock is broken', () => {
    const limiter = share.createResolveRateLimiter({
      max: 1,
      windowMs: 60_000,
      now: (): number => Number.NaN
    })

    expect(limiter?.take('ip-a').allowed).toBe(true)
    expect(limiter?.take('ip-a').allowed).toBe(true)
  })

  it('exposes a process-wide singleton configured once from env', () => {
    const first = share.resolveRateLimiter((): string => '2')
    const second = share.resolveRateLimiter((): string => '99999')

    expect(second).toBe(first)
    expect(typeof first.take).toBe('function')
  })
})

describe('share hook lib: evaluateLinkResolvable (task 2.8)', () => {
  const now = new Date('2026-10-06T12:00:00.000Z')

  it('resolves active links without an expiry', () => {
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: null, now })).toEqual({
      resolvable: true,
      reason: 'ok'
    })
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: '', now })).toEqual({
      resolvable: true,
      reason: 'ok'
    })
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: undefined, now })).toEqual({
      resolvable: true,
      reason: 'ok'
    })
  })

  it('does not resolve inactive links (PB stores unset bools as false)', () => {
    for (const isActive of [false, undefined, null]) {
      expect(share.evaluateLinkResolvable({ isActive, expiresAt: null, now }).reason).toBe('inactive')
    }
  })

  it('resolves links with a future expiry and drops expired ones (engine parity)', () => {
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: '2099-01-01 00:00:00.000Z', now })).toEqual({
      resolvable: true,
      reason: 'ok'
    })
    expect(
      share.evaluateLinkResolvable({ isActive: true, expiresAt: new Date(now.getTime() + 1000), now }).reason
    ).toBe('ok')
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: '2020-01-01 00:00:00.000Z', now }).reason).toBe(
      'expired'
    )
  })

  it('keeps a link resolvable exactly at its expiry instant (now > expiry is the engine rule)', () => {
    expect(
      share.evaluateLinkResolvable({ isActive: true, expiresAt: new Date(now.getTime()), now }).reason
    ).toBe('ok')
  })

  it('fails closed on an unparseable expiry or invalid input', () => {
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: 'not-a-date', now }).reason).toBe(
      'invalid_expiry'
    )
    expect(share.evaluateLinkResolvable({ isActive: true, expiresAt: '2099-01-01 00:00:00.000Z' }).reason).toBe(
      'invalid_input'
    )
    for (const input of [null, undefined, 'x', 42]) {
      expect(share.evaluateLinkResolvable(input).reason, JSON.stringify(input)).toBe('invalid_input')
    }
  })
})
