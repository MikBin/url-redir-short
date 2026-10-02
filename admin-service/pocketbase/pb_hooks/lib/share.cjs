'use strict'

const CREATE_PATH = '/api/share/create'

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

module.exports = {
  CREATE_PATH: CREATE_PATH,
  normalizeOrigin: normalizeOrigin,
  parseContentReference: parseContentReference,
  resolveAllowedOrigins: resolveAllowedOrigins,
  decideOrigin: decideOrigin
}
