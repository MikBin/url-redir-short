'use strict'

const CREATE_PATH = '/api/share/create'

const TURNSTILE_TOKEN_FIELD = 'turnstileToken'
const DEFAULT_TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TURNSTILE_TOKEN_LENGTH = 2048
const DEFAULT_TURNSTILE_TIMEOUT_SECONDS = 5
const MAX_TURNSTILE_TIMEOUT_SECONDS = 10

const APP_ID_PATTERN = /^[a-z][a-z0-9_]*$/
const TYPE_PATTERN = /^[a-z][a-z0-9_-]*$/
const CONTENT_ID_PATTERN = /^[A-Za-z0-9._~-]+$/
const PARAM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

const MAX_APP_ID_LENGTH = 64
const MAX_TYPE_LENGTH = 64
const MAX_CONTENT_ID_LENGTH = 128
const MAX_PARAM_KEYS = 16
const MAX_PARAM_STRING_LENGTH = 256
const MAX_PARAMS_JSON_LENGTH = 1024
const MAX_DESTINATION_LENGTH = 2048
const MAX_HOST_LENGTH = 253
const MAX_LABEL_LENGTH = 63
const DEFAULT_HTTPS_PORT = 443

const DEFAULT_DAILY_CREATE_LIMIT = 100
const MAX_CLIENT_IP_LENGTH = 64
const IP_HASH_PATTERN = /^[0-9a-f]{64}$/
const CLIENT_IP_PATTERN = /^[0-9a-fA-F:.]+$/
const QUOTA_QUERY_EXPRESSION = 'app = {:app} AND created_from_ip = {:ip} AND created >= {:since}'

const SYSTEM_CONFIG_COLLECTION = 'system_config'
const BREAKER_FLAG_KEY = 'public_creation_paused'
const DEFAULT_BREAKER_MULTIPLIER = 3
const DEFAULT_BREAKER_BASELINE_DAYS = 7
const DEFAULT_BREAKER_MIN_BASELINE = 10
const MAX_BREAKER_BASELINE_DAYS = 365
const TODAY_CREATES_QUERY_EXPRESSION = 'created >= {:since}'
const BASELINE_CREATES_QUERY_EXPRESSION = 'created >= {:since} AND created < {:until}'
const MILLISECONDS_PER_DAY = 86400000

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
const NUMERIC_HOST_PATTERN = /^\d+(\.\d+)*$/
const HEX_HOST_PATTERN = /^0x[0-9a-f]+$/i
const URL_UNSAFE_PATTERN = /[^\x21-\x7e]/

const KNOWN_SHORTENER_HOSTS = [
  '1pt.co',
  'adf.ly',
  'b.link',
  'bc.vc',
  'bit.do',
  'bit.ly',
  'buff.ly',
  'clck.ru',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'j.mp',
  'lnkd.in',
  'lnk.to',
  'mcaf.ee',
  'ow.ly',
  'po.st',
  'qps.ru',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'short.io',
  'shorte.st',
  'shorturl.at',
  'shrtco.de',
  'soo.gd',
  'surl.li',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
  'trib.al',
  'u.to',
  'v.gd',
  'vk.cc',
  'x.co'
]

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(field, message) {
  return { field: field, message: message }
}

function normalizeOrigin(origin) {
  if (typeof origin !== 'string') return ''
  const normalized = origin.trim().toLowerCase().replace(/\/+$/, '')
  return normalized
}

function validateParams(params) {
  const errors = []
  const keys = Object.keys(params)

  if (keys.length > MAX_PARAM_KEYS) {
    errors.push(issue('params', 'must contain at most ' + MAX_PARAM_KEYS + ' entries'))
  }

  for (const key of keys) {
    if (!PARAM_KEY_PATTERN.test(key)) {
      errors.push(issue('params.' + key, 'parameter names must start with a letter and contain only letters, digits and underscores'))
      continue
    }

    const value = params[key]
    const valid =
      (typeof value === 'string' && value.length <= MAX_PARAM_STRING_LENGTH) ||
      (typeof value === 'number' && isFinite(value)) ||
      typeof value === 'boolean'

    if (!valid) {
      errors.push(issue('params.' + key, 'must be a string (at most ' + MAX_PARAM_STRING_LENGTH + ' characters), a finite number, or a boolean'))
    }
  }

  if (errors.length === 0) {
    let serialized = ''
    try {
      serialized = JSON.stringify(params) || ''
    } catch (err) {
      return [issue('params', 'must be JSON-serializable')]
    }
    if (serialized.length > MAX_PARAMS_JSON_LENGTH) {
      errors.push(issue('params', 'serialized size must not exceed ' + MAX_PARAMS_JSON_LENGTH + ' characters'))
    }
  }

  return errors
}

function parseContentReference(body) {
  if (!isPlainObject(body)) {
    return { ok: false, errors: [issue('body', 'request body must be a JSON object')] }
  }

  const errors = []
  const appId = body.appId
  const type = body.type
  const contentId = body.contentId
  const params = body.params === undefined ? {} : body.params

  if (typeof appId !== 'string' || appId.length === 0 || appId.length > MAX_APP_ID_LENGTH || !APP_ID_PATTERN.test(appId)) {
    errors.push(issue('appId', 'must be a lowercase app id of at most ' + MAX_APP_ID_LENGTH + ' characters'))
  }

  if (typeof type !== 'string' || type.length === 0 || type.length > MAX_TYPE_LENGTH || !TYPE_PATTERN.test(type)) {
    errors.push(issue('type', 'must be a lowercase share type of at most ' + MAX_TYPE_LENGTH + ' characters'))
  }

  if (
    typeof contentId !== 'string' ||
    contentId.length === 0 ||
    contentId.length > MAX_CONTENT_ID_LENGTH ||
    !CONTENT_ID_PATTERN.test(contentId) ||
    contentId === '.' ||
    contentId === '..'
  ) {
    errors.push(issue('contentId', 'must be a URL-safe identifier of at most ' + MAX_CONTENT_ID_LENGTH + ' characters'))
  }

  if (!isPlainObject(params)) {
    errors.push(issue('params', 'must be a JSON object when provided'))
  } else {
    const paramErrors = validateParams(params)
    for (const paramError of paramErrors) {
      errors.push(paramError)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors }
  }

  return { ok: true, value: { appId: appId, type: type, contentId: contentId, params: params } }
}

function resolveAllowedOrigins(rows) {
  const origins = []
  if (!Array.isArray(rows)) return origins

  for (const row of rows) {
    if (!isPlainObject(row) || row.active !== true) continue
    const host = row.allowed_host
    if (typeof host !== 'string' || host.length === 0) continue

    const origin = normalizeOrigin('https://' + host)
    if (origin.length > 0 && origins.indexOf(origin) === -1) {
      origins.push(origin)
    }
  }

  origins.sort()
  return origins
}

function decideOrigin(origin, allowedOrigins) {
  const normalized = normalizeOrigin(origin)
  if (normalized.length === 0) {
    return { kind: 'absent' }
  }
  if (Array.isArray(allowedOrigins) && allowedOrigins.indexOf(normalized) !== -1) {
    return { kind: 'allowed', origin: normalized }
  }
  return { kind: 'denied', origin: normalized }
}

function extractTurnstileToken(body) {
  if (!isPlainObject(body)) return null

  const token = body[TURNSTILE_TOKEN_FIELD]
  if (typeof token !== 'string') return null

  const trimmed = token.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_TURNSTILE_TOKEN_LENGTH) return null

  return trimmed
}

function clampTurnstileTimeout(seconds) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) {
    return DEFAULT_TURNSTILE_TIMEOUT_SECONDS
  }

  const floored = Math.floor(seconds)
  if (floored < 1) return 1
  if (floored > MAX_TURNSTILE_TIMEOUT_SECONDS) return MAX_TURNSTILE_TIMEOUT_SECONDS
  return floored
}

function interpretSiteverify(response) {
  if (!isPlainObject(response)) {
    return {
      ok: false,
      code: 'turnstile_unavailable',
      message: 'Turnstile verification returned no usable response'
    }
  }

  if (response.statusCode !== 200) {
    return {
      ok: false,
      code: 'turnstile_unavailable',
      message: 'Turnstile verification is temporarily unavailable'
    }
  }

  const payload = response.json
  if (!isPlainObject(payload) || typeof payload.success !== 'boolean') {
    return {
      ok: false,
      code: 'turnstile_unavailable',
      message: 'Turnstile verification returned an unexpected payload'
    }
  }

  if (payload.success === true) {
    return { ok: true }
  }

  const errorCodes = Array.isArray(payload['error-codes']) ? payload['error-codes'] : []
  let reason = 'invalid'
  for (let i = 0; i < errorCodes.length; i++) {
    if (errorCodes[i] === 'timeout-or-duplicate') {
      reason = 'expired_or_duplicate'
      break
    }
  }

  return {
    ok: false,
    code: 'turnstile_failed',
    reason: reason,
    message:
      reason === 'expired_or_duplicate'
        ? 'Turnstile token has expired or was already used'
        : 'Turnstile token verification failed'
  }
}

function verifyTurnstileToken(token, deps) {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, code: 'turnstile_missing', message: 'A Turnstile token is required' }
  }

  if (!isPlainObject(deps) || typeof deps.send !== 'function') {
    return { ok: false, code: 'turnstile_not_configured', message: 'Turnstile verification is not configured' }
  }

  const secret = typeof deps.secret === 'string' ? deps.secret.trim() : ''
  if (secret.length === 0) {
    return { ok: false, code: 'turnstile_not_configured', message: 'Turnstile verification is not configured' }
  }

  const payload = { secret: secret, response: token }
  if (typeof deps.remoteIp === 'string' && deps.remoteIp.length > 0) {
    payload.remoteip = deps.remoteIp
  }

  let response
  try {
    response = deps.send({
      url:
        typeof deps.verifyUrl === 'string' && deps.verifyUrl.length > 0
          ? deps.verifyUrl
          : DEFAULT_TURNSTILE_VERIFY_URL,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: clampTurnstileTimeout(deps.timeout)
    })
  } catch (err) {
    return {
      ok: false,
      code: 'turnstile_unavailable',
      message: 'Turnstile verification is temporarily unavailable'
    }
  }

  return interpretSiteverify(response)
}

function canonicalizeHost(host) {
  if (typeof host !== 'string') return null
  let value = host.trim().toLowerCase()
  if (value.length > MAX_HOST_LENGTH) return null
  if (value.length > 0 && value.charAt(value.length - 1) === '.') {
    value = value.slice(0, -1)
  }
  if (value.length === 0) return null
  return value
}

function isValidHostname(host) {
  const labels = host.split('.')
  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH) return false
    if (!HOSTNAME_LABEL_PATTERN.test(label)) return false
  }
  return true
}

function hasPunycodeLabel(host) {
  const labels = host.split('.')
  for (const label of labels) {
    if (label.indexOf('xn--') === 0) return true
  }
  return false
}

function isKnownShortenerHost(host) {
  for (const shortener of KNOWN_SHORTENER_HOSTS) {
    if (host === shortener) return true
    const suffix = '.' + shortener
    if (host.length > suffix.length && host.slice(-suffix.length) === suffix) {
      return true
    }
  }
  return false
}

function renderDestination(template, reference) {
  if (typeof template !== 'string' || template.length === 0) {
    return { ok: false, code: 'invalid_template', message: 'url_template must be a non-empty string' }
  }
  if (template.indexOf('{contentId}') === -1) {
    return { ok: false, code: 'invalid_template', message: 'url_template must contain the {contentId} placeholder' }
  }
  if (!isPlainObject(reference) || typeof reference.contentId !== 'string' || reference.contentId.length === 0) {
    return { ok: false, code: 'invalid_reference', message: 'content reference must provide a non-empty contentId' }
  }

  const params = reference.params === undefined ? {} : reference.params
  if (!isPlainObject(params)) {
    return { ok: false, code: 'invalid_reference', message: 'content reference params must be a JSON object' }
  }

  let failure = null
  const destination = template.replace(PLACEHOLDER_PATTERN, (match, name) => {
    if (name === 'contentId') {
      return encodeURIComponent(reference.contentId)
    }
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      const value = params[name]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return encodeURIComponent(String(value))
      }
    }
    if (failure === null) {
      failure = {
        ok: false,
        code: 'missing_placeholder_value',
        message: 'url_template placeholder {' + name + '} has no value'
      }
    }
    return match
  })
  if (failure !== null) return failure

  return { ok: true, destination: destination }
}

function parseDestination(destination) {
  if (typeof destination !== 'string') {
    return { ok: false, code: 'invalid_destination', message: 'destination must be a string' }
  }

  const value = destination.trim()
  if (value.length === 0) {
    return { ok: false, code: 'invalid_destination', message: 'destination must not be empty' }
  }
  if (value.length > MAX_DESTINATION_LENGTH) {
    return {
      ok: false,
      code: 'destination_too_long',
      message: 'destination must be at most ' + MAX_DESTINATION_LENGTH + ' characters'
    }
  }
  if (URL_UNSAFE_PATTERN.test(value) || value.indexOf('\\') !== -1) {
    return {
      ok: false,
      code: 'invalid_characters',
      message: 'destination must not contain whitespace, control characters, or backslashes'
    }
  }
  if (!/^https:\/\//i.test(value)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return { ok: false, code: 'insecure_scheme', message: 'destination must use the https scheme' }
    }
    return { ok: false, code: 'missing_scheme', message: 'destination must be an absolute URL' }
  }

  return { ok: true, value: value }
}

function validateDestination(destination, allowedHost) {
  const parsed = parseDestination(destination)
  if (!parsed.ok) return parsed

  const allowed = canonicalizeHost(allowedHost)
  if (allowed === null || !isValidHostname(allowed)) {
    return { ok: false, code: 'invalid_allowed_host', message: 'allowed_host is not a valid hostname' }
  }

  const rest = parsed.value.slice(8)
  let authorityEnd = rest.length
  for (const terminator of ['/', '?', '#']) {
    const index = rest.indexOf(terminator)
    if (index !== -1 && index < authorityEnd) authorityEnd = index
  }
  const authority = rest.slice(0, authorityEnd)
  const remainder = rest.slice(authorityEnd)

  if (authority.length === 0) {
    return { ok: false, code: 'invalid_host', message: 'destination must include a hostname' }
  }
  if (authority.indexOf('@') !== -1) {
    return { ok: false, code: 'userinfo_not_allowed', message: 'destination must not include userinfo' }
  }
  if (authority.indexOf('[') !== -1 || authority.indexOf(']') !== -1) {
    return { ok: false, code: 'ip_literal_not_allowed', message: 'destination must not use an IP-literal host' }
  }

  const colon = authority.indexOf(':')
  if (colon !== -1 && colon !== authority.lastIndexOf(':')) {
    return { ok: false, code: 'invalid_host', message: 'destination host is malformed' }
  }

  let hostPart = authority
  if (colon !== -1) {
    hostPart = authority.slice(0, colon)
    const port = authority.slice(colon + 1)
    if (!/^\d+$/.test(port) || port !== String(DEFAULT_HTTPS_PORT)) {
      return { ok: false, code: 'port_not_allowed', message: 'destination must use the default https port' }
    }
  }

  const host = canonicalizeHost(hostPart)
  if (host === null) {
    return { ok: false, code: 'invalid_host', message: 'destination host is malformed' }
  }
  if (NUMERIC_HOST_PATTERN.test(host) || HEX_HOST_PATTERN.test(host)) {
    return { ok: false, code: 'ip_literal_not_allowed', message: 'destination must not use an IP-literal host' }
  }
  if (!isValidHostname(host)) {
    return { ok: false, code: 'invalid_host', message: 'destination host is malformed' }
  }
  if (hasPunycodeLabel(host)) {
    return { ok: false, code: 'punycode_not_allowed', message: 'destination must not use a punycode or IDN host' }
  }
  if (isKnownShortenerHost(host)) {
    return { ok: false, code: 'shortener_not_allowed', message: 'destination must not be another URL shortener' }
  }
  if (host !== allowed) {
    return { ok: false, code: 'host_not_allowed', message: 'destination host is not on the app allowlist' }
  }

  return { ok: true, destination: 'https://' + host + remainder }
}

// Task 2.4: per-IP daily quota. Bucket key is (app, HMAC(clientIp)) over the
// UTC day. The client IP is trusted only because L1 (CF proxy + firewall)
// guarantees it; shape checks below exist to fail closed on absent/garbage
// values, not as the trust boundary. Hashing follows the A2 contract pinned in
// design.md: HMAC-SHA256 with the stored IP_HASH_SALT, lowercase hex (64 chars),
// never a raw IP (`hash` is injected so this stays pure/testable).
function isDateLike(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.getTime === 'function' &&
    isFinite(value.getTime())
  )
}

function isInteger(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value
}

function formatPbDateTime(year, month, day, hours, minutes, seconds, milliseconds) {
  const pad2 = (value) => (value < 10 ? '0' + value : String(value))
  const pad3 = (value) => (value < 10 ? '00' + value : value < 100 ? '0' + value : String(value))
  return (
    String(year) +
    '-' +
    pad2(month) +
    '-' +
    pad2(day) +
    ' ' +
    pad2(hours) +
    ':' +
    pad2(minutes) +
    ':' +
    pad2(seconds) +
    '.' +
    pad3(milliseconds) +
    'Z'
  )
}

function normalizeClientIp(value) {
  if (typeof value !== 'string') return null

  let trimmed = value.trim()
  if (trimmed.length > 1 && trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') {
    trimmed = trimmed.slice(1, -1)
  }
  if (trimmed.length === 0 || trimmed.length > MAX_CLIENT_IP_LENGTH) return null
  if (!CLIENT_IP_PATTERN.test(trimmed)) return null
  if (trimmed.indexOf(':') === -1 && trimmed.indexOf('.') === -1) return null

  return trimmed.toLowerCase()
}

function hashClientIp(ip, salt, hash) {
  if (typeof ip !== 'string' || ip.length === 0) return null
  if (typeof salt !== 'string' || salt.length === 0) return null
  if (typeof hash !== 'function') return null

  let digest = null
  try {
    digest = hash(ip, salt)
  } catch (err) {
    return null
  }

  if (typeof digest !== 'string' || !IP_HASH_PATTERN.test(digest)) return null
  return digest
}

function pbDay(date) {
  return formatPbDateTime(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, 0, 0)
}

function utcDayStart(now) {
  if (!isDateLike(now)) return null
  return pbDay(now)
}

function nextUtcMidnight(now) {
  if (!isDateLike(now)) return null
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
}

function dailyQuotaQuery(input) {
  if (!isPlainObject(input)) return null

  const appId = input.appId
  if (typeof appId !== 'string' || appId.length === 0 || appId.length > MAX_APP_ID_LENGTH) return null

  const ipHash = input.ipHash
  if (typeof ipHash !== 'string' || !IP_HASH_PATTERN.test(ipHash)) return null

  const since = utcDayStart(input.now)
  if (since === null) return null

  return {
    expression: QUOTA_QUERY_EXPRESSION,
    params: { app: appId, ip: ipHash, since: since }
  }
}

function evaluateDailyQuota(input) {
  if (!isPlainObject(input)) {
    return { ok: false, code: 'quota_input_invalid', message: 'quota input must be an object' }
  }

  const used = input.used
  const limit = input.limit
  const now = input.now

  if (!isInteger(used) || used < 0) {
    return { ok: false, code: 'quota_input_invalid', message: 'used must be a non-negative integer' }
  }
  if (!isInteger(limit) || limit < 1) {
    return { ok: false, code: 'quota_input_invalid', message: 'limit must be a positive integer' }
  }

  const resetAt = nextUtcMidnight(now)
  if (resetAt === null) {
    return { ok: false, code: 'quota_input_invalid', message: 'now must be a valid date' }
  }

  if (used >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
    return {
      ok: false,
      code: 'quota_exceeded',
      used: used,
      limit: limit,
      resetAt: resetAt.toISOString(),
      retryAfterSeconds: retryAfterSeconds
    }
  }

  return { ok: true, used: used, limit: limit, remaining: limit - used }
}

// Task 2.5: global circuit breaker. The flag lives in a T0-locked
// `system_config` row (`public_creation_paused`); the create hook checks it
// before any create work and returns 503 while paused. `value` is a JSON field,
// so the JSVM hands it back as raw text (`"true"`/`"false"`) via getString;
// booleans are accepted too so the helpers stay pure and directly unit-testable.
function parseBreakerFlag(value) {
  if (value === true || value === false) return value

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
  }

  return null
}

function evaluateCircuitBreaker(value) {
  // An absent row (`undefined`/`null`) means the flag was never configured:
  // default to not paused, mirroring the seeded `false`.
  if (value === undefined || value === null) {
    return { ok: true, paused: false }
  }

  const paused = parseBreakerFlag(value)
  if (paused === null) {
    return {
      ok: false,
      code: 'breaker_unavailable',
      message: 'Circuit breaker flag is not a boolean'
    }
  }

  if (paused) {
    return {
      ok: false,
      code: 'creation_paused',
      message: 'Public creation is paused by the circuit breaker'
    }
  }

  return { ok: true, paused: false }
}

function parseBreakerMultiplier(value) {
  let parsed = null
  if (typeof value === 'number') {
    parsed = value
  } else if (typeof value === 'string' && value.trim().length > 0) {
    parsed = Number(value)
  }

  if (parsed === null || !isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function breakerBaselineWindow(now, days) {
  if (!isDateLike(now)) return null
  if (!isInteger(days) || days < 1 || days > MAX_BREAKER_BASELINE_DAYS) return null

  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const start = new Date(end.getTime() - days * MILLISECONDS_PER_DAY)
  return { since: pbDay(start), until: pbDay(end) }
}

function evaluateBreakerTrip(input) {
  if (!isPlainObject(input)) {
    return { ok: false, code: 'breaker_input_invalid', message: 'breaker input must be an object' }
  }

  const todayCreates = input.todayCreates
  const baselineTotal = input.baselineTotal
  const baselineDays = input.baselineDays
  const multiplier = input.multiplier
  const minimumBaseline = input.minimumBaseline

  if (!isInteger(todayCreates) || todayCreates < 0) {
    return { ok: false, code: 'breaker_input_invalid', message: 'todayCreates must be a non-negative integer' }
  }
  if (!isInteger(baselineTotal) || baselineTotal < 0) {
    return { ok: false, code: 'breaker_input_invalid', message: 'baselineTotal must be a non-negative integer' }
  }
  if (!isInteger(baselineDays) || baselineDays < 1 || baselineDays > MAX_BREAKER_BASELINE_DAYS) {
    return { ok: false, code: 'breaker_input_invalid', message: 'baselineDays must be a positive integer' }
  }
  if (typeof multiplier !== 'number' || !isFinite(multiplier) || multiplier <= 0) {
    return { ok: false, code: 'breaker_input_invalid', message: 'multiplier must be a positive number' }
  }
  if (!isInteger(minimumBaseline) || minimumBaseline < 0) {
    return { ok: false, code: 'breaker_input_invalid', message: 'minimumBaseline must be a non-negative integer' }
  }

  const baselineDaily = baselineTotal / baselineDays
  // The floor keeps a quiet (or brand-new) system from tripping on trivially
  // small counts: multiplier is applied to max(trailing average, floor).
  const effectiveBaseline = Math.max(baselineDaily, minimumBaseline)
  const threshold = multiplier * effectiveBaseline

  return {
    ok: true,
    trip: todayCreates > threshold,
    todayCreates: todayCreates,
    baselineTotal: baselineTotal,
    baselineDays: baselineDays,
    baselineDaily: baselineDaily,
    effectiveBaseline: effectiveBaseline,
    threshold: threshold
  }
}

function runBreakerBaselineJob(input) {
  const invalid = {
    ok: false,
    code: 'breaker_job_input_invalid',
    message: 'breaker job input is invalid'
  }

  if (!isPlainObject(input)) return invalid
  if (!isDateLike(input.now)) return invalid
  if (typeof input.currentPaused !== 'boolean') return invalid
  if (typeof input.countCreates !== 'function') return invalid
  if (typeof input.trip !== 'function') return invalid
  if (!isInteger(input.baselineDays) || input.baselineDays < 1 || input.baselineDays > MAX_BREAKER_BASELINE_DAYS) {
    return invalid
  }
  if (typeof input.multiplier !== 'number' || !isFinite(input.multiplier) || input.multiplier <= 0) {
    return invalid
  }
  if (!isInteger(input.minimumBaseline) || input.minimumBaseline < 0) return invalid

  // Never auto-reset: the operator owns the reset via the admin UI.
  if (input.currentPaused) {
    return { ok: true, tripped: false, skipped: 'already_paused' }
  }

  const window = breakerBaselineWindow(input.now, input.baselineDays)
  if (window === null) return invalid

  let todayCreates = -1
  let baselineTotal = -1
  try {
    todayCreates = input.countCreates(utcDayStart(input.now), null)
    baselineTotal = input.countCreates(window.since, window.until)
  } catch (err) {
    return {
      ok: false,
      code: 'breaker_job_count_failed',
      message: 'Circuit breaker baseline could not be computed'
    }
  }

  const decision = evaluateBreakerTrip({
    todayCreates: todayCreates,
    baselineTotal: baselineTotal,
    baselineDays: input.baselineDays,
    multiplier: input.multiplier,
    minimumBaseline: input.minimumBaseline
  })
  if (!decision.ok) {
    return {
      ok: false,
      code: 'breaker_job_count_failed',
      message: 'Circuit breaker baseline could not be computed'
    }
  }
  if (!decision.trip) {
    return {
      ok: true,
      tripped: false,
      todayCreates: decision.todayCreates,
      baselineTotal: decision.baselineTotal,
      baselineDaily: decision.baselineDaily,
      effectiveBaseline: decision.effectiveBaseline,
      threshold: decision.threshold
    }
  }

  try {
    input.trip({
      todayCreates: decision.todayCreates,
      baselineTotal: decision.baselineTotal,
      baselineDays: decision.baselineDays,
      baselineDaily: decision.baselineDaily,
      effectiveBaseline: decision.effectiveBaseline,
      threshold: decision.threshold,
      multiplier: input.multiplier
    })
  } catch (err) {
    return {
      ok: false,
      code: 'breaker_job_trip_failed',
      message: 'Circuit breaker flag could not be set'
    }
  }

  return {
    ok: true,
    tripped: true,
    todayCreates: decision.todayCreates,
    baselineTotal: decision.baselineTotal,
    baselineDaily: decision.baselineDaily,
    effectiveBaseline: decision.effectiveBaseline,
    threshold: decision.threshold
  }
}

module.exports = {
  CREATE_PATH: CREATE_PATH,
  MAX_DESTINATION_LENGTH: MAX_DESTINATION_LENGTH,
  KNOWN_SHORTENER_HOSTS: KNOWN_SHORTENER_HOSTS,
  TURNSTILE_TOKEN_FIELD: TURNSTILE_TOKEN_FIELD,
  DEFAULT_TURNSTILE_VERIFY_URL: DEFAULT_TURNSTILE_VERIFY_URL,
  MAX_TURNSTILE_TOKEN_LENGTH: MAX_TURNSTILE_TOKEN_LENGTH,
  DEFAULT_DAILY_CREATE_LIMIT: DEFAULT_DAILY_CREATE_LIMIT,
  normalizeOrigin: normalizeOrigin,
  parseContentReference: parseContentReference,
  resolveAllowedOrigins: resolveAllowedOrigins,
  decideOrigin: decideOrigin,
  extractTurnstileToken: extractTurnstileToken,
  interpretSiteverify: interpretSiteverify,
  verifyTurnstileToken: verifyTurnstileToken,
  renderDestination: renderDestination,
  validateDestination: validateDestination,
  normalizeClientIp: normalizeClientIp,
  hashClientIp: hashClientIp,
  utcDayStart: utcDayStart,
  nextUtcMidnight: nextUtcMidnight,
  dailyQuotaQuery: dailyQuotaQuery,
  evaluateDailyQuota: evaluateDailyQuota,
  SYSTEM_CONFIG_COLLECTION: SYSTEM_CONFIG_COLLECTION,
  BREAKER_FLAG_KEY: BREAKER_FLAG_KEY,
  DEFAULT_BREAKER_MULTIPLIER: DEFAULT_BREAKER_MULTIPLIER,
  DEFAULT_BREAKER_BASELINE_DAYS: DEFAULT_BREAKER_BASELINE_DAYS,
  DEFAULT_BREAKER_MIN_BASELINE: DEFAULT_BREAKER_MIN_BASELINE,
  TODAY_CREATES_QUERY_EXPRESSION: TODAY_CREATES_QUERY_EXPRESSION,
  BASELINE_CREATES_QUERY_EXPRESSION: BASELINE_CREATES_QUERY_EXPRESSION,
  parseBreakerFlag: parseBreakerFlag,
  evaluateCircuitBreaker: evaluateCircuitBreaker,
  parseBreakerMultiplier: parseBreakerMultiplier,
  breakerBaselineWindow: breakerBaselineWindow,
  evaluateBreakerTrip: evaluateBreakerTrip,
  runBreakerBaselineJob: runBreakerBaselineJob
}
