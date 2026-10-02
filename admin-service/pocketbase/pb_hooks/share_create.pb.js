/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/share/create", (e) => {
  const share = require(`${__hooks}/lib/share.cjs`)

  const rows = []
  const records = $app.findRecordsByFilter("apps", "active = true", "", 100, 0)
  for (let i = 0; i < records.length; i++) {
    rows.push({
      allowed_host: records[i].get("allowed_host"),
      active: records[i].get("active")
    })
  }

  const decision = share.decideOrigin(e.request.header.get("Origin"), share.resolveAllowedOrigins(rows))

  if (decision.kind === "denied") {
    e.response.header().del("Access-Control-Allow-Origin")
    return e.json(403, {
      code: "origin_not_allowed",
      message: "Origin is not allowed to call this endpoint"
    })
  }

  if (decision.kind === "allowed") {
    e.response.header().set("Access-Control-Allow-Origin", decision.origin)
    e.response.header().set("Vary", "Origin")
  }

  e.response.header().set("Cache-Control", "no-store")

  let body = null
  try {
    body = JSON.parse(toString(e.request.body) || "")
  } catch (err) {
    return e.json(400, {
      code: "invalid_json",
      message: "Request body must be valid JSON"
    })
  }

  // Task 2.5: global circuit breaker. Checked before any create work so a
  // paused system rejects every well-formed request with 503 — including
  // requests without a Turnstile token — while clicks never touch PocketBase
  // and remain unaffected. The flag lives in a T0-locked system_config row;
  // an absent row means "not paused" (seed default).
  let breakerRaw = null
  try {
    const breakerRecord = $app.findFirstRecordByFilter(
      "system_config",
      "key = '" + share.BREAKER_FLAG_KEY + "'"
    )
    breakerRaw = breakerRecord.getString("value")
  } catch {
    // Absent row means "not configured" -> stays null (not paused).
  }

  const breaker = share.evaluateCircuitBreaker(breakerRaw)
  if (!breaker.ok) {
    return e.json(503, {
      code: breaker.code,
      message: breaker.message
    })
  }

  const turnstile = share.verifyTurnstileToken(share.extractTurnstileToken(body), {
    secret: $os.getenv("TURNSTILE_SECRET"),
    verifyUrl: $os.getenv("TURNSTILE_VERIFY_URL"),
    remoteIp: e.request.header.get("CF-Connecting-IP"),
    send: $http.send
  })

  if (!turnstile.ok) {
    if (turnstile.code === "turnstile_missing" || turnstile.code === "turnstile_failed") {
      return e.json(403, {
        code: turnstile.code,
        reason: turnstile.reason,
        message: turnstile.message
      })
    }
    return e.json(503, {
      code: turnstile.code,
      message: turnstile.message
    })
  }

  const parsed = share.parseContentReference(body)
  if (!parsed.ok) {
    return e.json(400, {
      code: "invalid_request",
      message: "Request body is not a valid content reference",
      fields: parsed.errors
    })
  }

  let appRecord = null
  try {
    appRecord = $app.findFirstRecordByFilter(
      "apps",
      'app_id = "' + parsed.value.appId + '" && active = true'
    )
  } catch (err) {
    appRecord = null
  }
  if (appRecord === null) {
    return e.json(400, {
      code: "unknown_app",
      message: "Unknown or inactive app"
    })
  }

  // Task 2.4: per-IP daily quota, keyed by CF-Connecting-IP + app. Turnstile
  // already ran, so bots pay before touching the quota query.
  const clientIp = share.normalizeClientIp(e.request.header.get("CF-Connecting-IP"))
  const ipHash = share.hashClientIp(clientIp, $os.getenv("IP_HASH_SALT"), $security.hs256)
  if (ipHash === null) {
    return e.json(503, {
      code: "quota_unavailable",
      message: "Daily quota could not be evaluated"
    })
  }

  const now = new Date()
  const quotaQuery = share.dailyQuotaQuery({
    appId: appRecord.id,
    ipHash: ipHash,
    now: now
  })
  if (quotaQuery === null) {
    return e.json(503, {
      code: "quota_unavailable",
      message: "Daily quota could not be evaluated"
    })
  }

  let used = -1
  try {
    used = $app.countRecords("links", $dbx.exp(quotaQuery.expression, quotaQuery.params))
  } catch (err) {
    used = -1
  }
  if (used < 0) {
    return e.json(503, {
      code: "quota_unavailable",
      message: "Daily quota could not be evaluated"
    })
  }

  const quota = share.evaluateDailyQuota({
    used: used,
    limit: appRecord.getInt("daily_create_limit") || share.DEFAULT_DAILY_CREATE_LIMIT,
    now: now
  })
  if (!quota.ok) {
    if (quota.code === "quota_exceeded") {
      e.response.header().set("Retry-After", String(quota.retryAfterSeconds))
      return e.json(429, {
        code: "quota_exceeded",
        message: "Daily creation quota exceeded for this app",
        limit: quota.limit,
        used: quota.used,
        resetAt: quota.resetAt
      })
    }
    return e.json(503, {
      code: "quota_unavailable",
      message: "Daily quota could not be evaluated"
    })
  }

  let templates = null
  try {
    templates = JSON.parse(appRecord.getString("url_template"))
  } catch (err) {
    templates = null
  }
  if (templates === null || typeof templates !== "object" || Array.isArray(templates)) {
    return e.json(500, {
      code: "template_error",
      message: "App registry url_template is not a JSON object"
    })
  }

  const template = Object.prototype.hasOwnProperty.call(templates, parsed.value.type)
    ? templates[parsed.value.type]
    : undefined
  if (typeof template !== "string" || template.length === 0) {
    return e.json(400, {
      code: "unknown_type",
      message: "Unknown share type for this app"
    })
  }

  const rendered = share.renderDestination(template, parsed.value)
  if (!rendered.ok) {
    return e.json(500, {
      code: "template_error",
      reason: rendered.code,
      message: rendered.message
    })
  }

  const destination = share.validateDestination(rendered.destination, appRecord.get("allowed_host"))
  if (!destination.ok) {
    return e.json(400, {
      code: "destination_not_allowed",
      reason: destination.code,
      message: destination.message
    })
  }

  // Task 2.6: random slug — client-supplied slug/url fields are never read
  // (parseContentReference drops unknown fields), so custom slugs are
  // impossible by construction. Collision scope is per app, matching the
  // idx_links_app_slug unique index and host-keyed KV namespace.
  const slug = share.generateSlugWithCollisionRetry({
    generate: () =>
      share.generateSlug((length, alphabet) => $security.randomStringWithAlphabet(length, alphabet)),
    exists: (candidate) => {
      const collisionQuery = share.slugCollisionQuery(appRecord.id, candidate)
      if (collisionQuery === null) {
        throw new Error("invalid slug collision query")
      }
      return $app.countRecords("links", $dbx.exp(collisionQuery.expression, collisionQuery.params)) > 0
    },
    maxRetries: share.MAX_SLUG_COLLISION_RETRIES
  })
  if (!slug.ok) {
    return e.json(500, {
      code: slug.code,
      message: slug.message
    })
  }

  // TODO(task 2.9): persist the record (with the hashed IP that task 2.4
  // already keys the quota on) and apply create idempotency. The KV publish
  // is handled by the pb_hooks/share_kv.pb.js record hooks, so persisting is
  // all that remains before the response can carry the short URL.
  return e.json(501, {
    code: "not_implemented",
    message: "Create pipeline is not implemented yet"
  })
}, $apis.bodyLimit(4096))
