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

interface ShareLib {
  CREATE_PATH: string
  normalizeOrigin: (origin: unknown) => string
  parseContentReference: (body: unknown) => ParseResult
  resolveAllowedOrigins: (rows: unknown) => string[]
  decideOrigin: (origin: unknown, allowedOrigins: string[]) => OriginDecision
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
})
