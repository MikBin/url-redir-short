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

interface ShareLib {
  CREATE_PATH: string
  MAX_DESTINATION_LENGTH: number
  KNOWN_SHORTENER_HOSTS: string[]
  normalizeOrigin: (origin: unknown) => string
  parseContentReference: (body: unknown) => ParseResult
  resolveAllowedOrigins: (rows: unknown) => string[]
  decideOrigin: (origin: unknown, allowedOrigins: string[]) => OriginDecision
  renderDestination: (template: unknown, reference: unknown) => UrlResult
  validateDestination: (destination: unknown, allowedHost: unknown) => UrlResult
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
