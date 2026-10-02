import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

type BreakerFlagDecision =
  | { ok: true; paused: boolean }
  | { ok: false; code: string; message: string }

type BreakerTripDecision =
  | {
      ok: true
      trip: boolean
      todayCreates: number
      baselineTotal: number
      baselineDays: number
      baselineDaily: number
      effectiveBaseline: number
      threshold: number
    }
  | { ok: false; code: string; message: string }

interface BreakerTripInfo {
  todayCreates: number
  baselineTotal: number
  baselineDays: number
  baselineDaily: number
  effectiveBaseline: number
  threshold: number
  multiplier: number
}

type BreakerJobResult =
  | {
      ok: true
      tripped: boolean
      skipped?: string
      todayCreates?: number
      baselineTotal?: number
      baselineDaily?: number
      effectiveBaseline?: number
      threshold?: number
    }
  | { ok: false; code: string; message: string }

interface ShareLib {
  SYSTEM_CONFIG_COLLECTION: string
  BREAKER_FLAG_KEY: string
  DEFAULT_BREAKER_MULTIPLIER: number
  DEFAULT_BREAKER_BASELINE_DAYS: number
  DEFAULT_BREAKER_MIN_BASELINE: number
  TODAY_CREATES_QUERY_EXPRESSION: string
  BASELINE_CREATES_QUERY_EXPRESSION: string
  parseBreakerFlag: (value: unknown) => boolean | null
  evaluateCircuitBreaker: (value: unknown) => BreakerFlagDecision
  parseBreakerMultiplier: (value: unknown) => number | null
  breakerBaselineWindow: (now: unknown, days: unknown) => { since: string; until: string } | null
  evaluateBreakerTrip: (input: unknown) => BreakerTripDecision
  runBreakerBaselineJob: (input: unknown) => BreakerJobResult
}

const nodeRequire = createRequire(import.meta.url)
const share = nodeRequire('../pb_hooks/lib/share.cjs') as ShareLib

const NOW = new Date('2026-10-02T13:37:05.250Z')

interface CountCall {
  since: string
  until: string | null
}

function createJobHarness(options: {
  todayCreates?: number
  baselineTotal?: number
  countThrows?: boolean
  tripThrows?: boolean
  currentPaused?: boolean
}) {
  const countCalls: CountCall[] = []
  const tripCalls: BreakerTripInfo[] = []

  return {
    countCalls,
    tripCalls,
    input: {
      now: NOW,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10,
      currentPaused: options.currentPaused === true,
      countCreates: (since: string, until: string | null): number => {
        if (options.countThrows === true) throw new Error('database unavailable')
        countCalls.push({ since, until })
        if (until === null) return options.todayCreates ?? 0
        return options.baselineTotal ?? 0
      },
      trip: (info: BreakerTripInfo): void => {
        if (options.tripThrows === true) throw new Error('save failed')
        tripCalls.push(info)
      }
    }
  }
}

describe('share hook lib: circuit breaker flag (task 2.5)', () => {
  it('pins the collection, key, defaults, and SQL expressions', () => {
    expect(share.SYSTEM_CONFIG_COLLECTION).toBe('system_config')
    expect(share.BREAKER_FLAG_KEY).toBe('public_creation_paused')
    expect(share.DEFAULT_BREAKER_MULTIPLIER).toBe(3)
    expect(share.DEFAULT_BREAKER_BASELINE_DAYS).toBe(7)
    expect(share.DEFAULT_BREAKER_MIN_BASELINE).toBe(10)
    expect(share.TODAY_CREATES_QUERY_EXPRESSION).toBe('created >= {:since}')
    expect(share.BASELINE_CREATES_QUERY_EXPRESSION).toBe(
      'created >= {:since} AND created < {:until}'
    )
  })

  it('parses the flag from booleans and the JSVM raw JSON text', () => {
    expect(share.parseBreakerFlag(true)).toBe(true)
    expect(share.parseBreakerFlag(false)).toBe(false)
    expect(share.parseBreakerFlag('true')).toBe(true)
    expect(share.parseBreakerFlag('false')).toBe(false)
    expect(share.parseBreakerFlag('  false  ')).toBe(false)

    for (const value of ['TRUE', 'yes', '1', 0, 1, null, undefined, {}, [], '']) {
      expect(share.parseBreakerFlag(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('treats an absent flag row as not paused and a malformed value as unavailable', () => {
    expect(share.evaluateCircuitBreaker(undefined)).toEqual({ ok: true, paused: false })
    expect(share.evaluateCircuitBreaker(null)).toEqual({ ok: true, paused: false })
    expect(share.evaluateCircuitBreaker(false)).toEqual({ ok: true, paused: false })
    expect(share.evaluateCircuitBreaker('false')).toEqual({ ok: true, paused: false })

    expect(share.evaluateCircuitBreaker(true)).toEqual({
      ok: false,
      code: 'creation_paused',
      message: expect.any(String)
    })
    expect(share.evaluateCircuitBreaker('true')).toEqual({
      ok: false,
      code: 'creation_paused',
      message: expect.any(String)
    })

    for (const value of ['yes', 1, 0, {}, [], '']) {
      const result = share.evaluateCircuitBreaker(value)
      expect(result.ok, JSON.stringify(value)).toBe(false)
      if (!result.ok) expect(result.code, JSON.stringify(value)).toBe('breaker_unavailable')
    }
  })

  it('parses the multiplier from env-style strings and rejects unusable values', () => {
    expect(share.parseBreakerMultiplier(3)).toBe(3)
    expect(share.parseBreakerMultiplier('3')).toBe(3)
    expect(share.parseBreakerMultiplier(' 2.5 ')).toBe(2.5)

    for (const value of [0, -1, '0', 'abc', '', '   ', null, undefined, Number.NaN, {}]) {
      expect(share.parseBreakerMultiplier(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('computes the trailing baseline window in PocketBase datetime format', () => {
    expect(share.breakerBaselineWindow(NOW, 7)).toEqual({
      since: '2026-09-25 00:00:00.000Z',
      until: '2026-10-02 00:00:00.000Z'
    })
    expect(share.breakerBaselineWindow(new Date('2026-10-01T00:00:00.000Z'), 1)).toEqual({
      since: '2026-09-30 00:00:00.000Z',
      until: '2026-10-01 00:00:00.000Z'
    })

    for (const days of [0, -1, 1.5, 366, '7', null]) {
      expect(share.breakerBaselineWindow(NOW, days), String(days)).toBeNull()
    }
    expect(share.breakerBaselineWindow('today', 7)).toBeNull()
  })
})

describe('share hook lib: breaker trip decision (task 2.5)', () => {
  it('trips only when today exceeds multiplier x trailing baseline', () => {
    const atThreshold = share.evaluateBreakerTrip({
      todayCreates: 300,
      baselineTotal: 700,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    })
    expect(atThreshold).toEqual({
      ok: true,
      trip: false,
      todayCreates: 300,
      baselineTotal: 700,
      baselineDays: 7,
      baselineDaily: 100,
      effectiveBaseline: 100,
      threshold: 300
    })

    const aboveThreshold = share.evaluateBreakerTrip({
      todayCreates: 301,
      baselineTotal: 700,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    })
    expect(aboveThreshold.ok).toBe(true)
    if (aboveThreshold.ok) {
      expect(aboveThreshold.trip).toBe(true)
      expect(aboveThreshold.threshold).toBe(300)
    }
  })

  it('applies the baseline floor so a quiet system cannot trip on trivial counts', () => {
    const quiet = share.evaluateBreakerTrip({
      todayCreates: 30,
      baselineTotal: 0,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    })
    expect(quiet).toEqual({
      ok: true,
      trip: false,
      todayCreates: 30,
      baselineTotal: 0,
      baselineDays: 7,
      baselineDaily: 0,
      effectiveBaseline: 10,
      threshold: 30
    })

    const flooded = share.evaluateBreakerTrip({
      todayCreates: 31,
      baselineTotal: 0,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    })
    expect(flooded.ok).toBe(true)
    if (flooded.ok) expect(flooded.trip).toBe(true)
  })

  it('uses the floor only when the trailing average is lower', () => {
    const result = share.evaluateBreakerTrip({
      todayCreates: 15,
      baselineTotal: 14,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.baselineDaily).toBe(2)
      expect(result.effectiveBaseline).toBe(10)
      expect(result.threshold).toBe(30)
      expect(result.trip).toBe(false)
    }
  })

  it('fails closed on invalid inputs', () => {
    const valid = {
      todayCreates: 10,
      baselineTotal: 70,
      baselineDays: 7,
      multiplier: 3,
      minimumBaseline: 10
    }

    const invalid: unknown[] = [
      undefined,
      null,
      'breaker',
      { ...valid, todayCreates: -1 },
      { ...valid, todayCreates: 1.5 },
      { ...valid, todayCreates: '10' },
      { ...valid, baselineTotal: -1 },
      { ...valid, baselineTotal: 1.5 },
      { ...valid, baselineDays: 0 },
      { ...valid, baselineDays: 366 },
      { ...valid, multiplier: 0 },
      { ...valid, multiplier: Number.NaN },
      { ...valid, multiplier: '3' },
      { ...valid, minimumBaseline: -1 },
      { ...valid, minimumBaseline: 1.5 }
    ]

    for (const input of invalid) {
      const result = share.evaluateBreakerTrip(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) expect(result.code, JSON.stringify(input)).toBe('breaker_input_invalid')
    }
  })
})

describe('share hook lib: breaker baseline job (task 2.5)', () => {
  it('does not trip below threshold and queries today + trailing window', () => {
    const harness = createJobHarness({ todayCreates: 10, baselineTotal: 21 })
    const result = share.runBreakerBaselineJob(harness.input)

    expect(result).toEqual({
      ok: true,
      tripped: false,
      todayCreates: 10,
      baselineTotal: 21,
      baselineDaily: 3,
      effectiveBaseline: 10,
      threshold: 30
    })
    expect(harness.tripCalls).toHaveLength(0)
    expect(harness.countCalls).toEqual([
      { since: '2026-10-02 00:00:00.000Z', until: null },
      { since: '2026-09-25 00:00:00.000Z', until: '2026-10-02 00:00:00.000Z' }
    ])
  })

  it('trips above threshold and passes the evidence to the trip callback', () => {
    const harness = createJobHarness({ todayCreates: 31, baselineTotal: 0 })
    const result = share.runBreakerBaselineJob(harness.input)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.tripped).toBe(true)
    expect(harness.tripCalls).toEqual([
      {
        todayCreates: 31,
        baselineTotal: 0,
        baselineDays: 7,
        baselineDaily: 0,
        effectiveBaseline: 10,
        threshold: 30,
        multiplier: 3
      }
    ])
  })

  it('never auto-resets: an already paused flag skips the run entirely', () => {
    const harness = createJobHarness({ currentPaused: true, todayCreates: 0 })
    const result = share.runBreakerBaselineJob(harness.input)

    expect(result).toEqual({ ok: true, tripped: false, skipped: 'already_paused' })
    expect(harness.countCalls).toHaveLength(0)
    expect(harness.tripCalls).toHaveLength(0)
  })

  it('fails closed without tripping when the counts cannot be computed', () => {
    const throwing = createJobHarness({ countThrows: true })
    const failed = share.runBreakerBaselineJob(throwing.input)
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.code).toBe('breaker_job_count_failed')
    expect(throwing.tripCalls).toHaveLength(0)

    const garbage = createJobHarness({})
    garbage.input.countCreates = () => -1
    const invalid = share.runBreakerBaselineJob(garbage.input)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe('breaker_job_count_failed')
    expect(garbage.tripCalls).toHaveLength(0)
  })

  it('reports a trip-write failure instead of claiming success', () => {
    const harness = createJobHarness({ todayCreates: 31, baselineTotal: 0, tripThrows: true })
    const result = share.runBreakerBaselineJob(harness.input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('breaker_job_trip_failed')
  })

  it('fails closed on invalid job inputs', () => {
    const valid = createJobHarness({}).input
    const invalid: unknown[] = [
      undefined,
      null,
      'job',
      { ...valid, now: 'yesterday' },
      { ...valid, baselineDays: 0 },
      { ...valid, baselineDays: 366 },
      { ...valid, multiplier: 0 },
      { ...valid, multiplier: Number.NaN },
      { ...valid, minimumBaseline: -1 },
      { ...valid, currentPaused: 'false' },
      { ...valid, countCreates: undefined },
      { ...valid, trip: undefined }
    ]

    for (const input of invalid) {
      const result = share.runBreakerBaselineJob(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) expect(result.code, JSON.stringify(input)).toBe('breaker_job_input_invalid')
    }
  })
})

const RULE_KEYS = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'] as const
const RULE_ASSIGNMENT = /"(listRule|viewRule|createRule|updateRule|deleteRule)"\s*:\s*([^,\n}]+)/g

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

describe('system_config migration + schema (task 2.5)', () => {
  it('locks every system_config rule and seeds the breaker flag as false', () => {
    const file = readdirSync(`${root}/pb_migrations`).find((name) =>
      name.endsWith('_created_system_config.js')
    )
    if (!file) throw new Error('_created_system_config.js migration is missing from pb_migrations')
    const source = readFileSync(`${root}/pb_migrations/${file}`, 'utf-8') as string

    const assignments = [...source.matchAll(RULE_ASSIGNMENT)]
    expect(assignments.length).toBeGreaterThan(0)
    for (const assignment of assignments) {
      expect(assignment[2]?.trim(), `system_config ${assignment[1]}`).toBe('null')
    }

    expect(source).toContain('CREATE UNIQUE INDEX `idx_system_config_key`')
    expect(source).toContain('"key":"public_creation_paused"')
    expect(source).toContain('"value":false')
  })

  it('registers a locked system_config collection in pb_schema.json', () => {
    const parsed: unknown = JSON.parse(readFileSync(`${root}/pb_schema.json`, 'utf-8'))

    const collection = Array.isArray(parsed)
      ? parsed.find(
          (entry): entry is Record<string, unknown> =>
            isRecord(entry) && entry['name'] === 'system_config'
        )
      : undefined

    expect(collection, 'system_config collection missing from pb_schema.json').toBeDefined()
    if (!collection) return

    for (const key of RULE_KEYS) {
      expect(collection[key], `pb_schema.json system_config.${key}`).toBeNull()
    }
  })
})
