/// <reference path="../pb_data/types.d.ts" />

// Task 2.8: public read-through resolve source (GET /api/share/resolve,
// profile §5.2). The Worker calls this on a KV miss (task 3.5) and populates
// KV from the response. Hardened per the binding profile: GET-only, exact-key
// lookup (host + path) against active apps and active links, Bearer secret
// (WORKER_RESOLVE_SECRET) with missing/wrong credentials indistinguishable,
// endpoint-local rate limit per CF-Connecting-IP, and the minimum response
// (destination + redirect code) — no listing, no filtering, no enumeration
// surface beyond what random slugs + the rate limit already preclude.
//
// Lookups use named parameters (never string interpolation) so a crafted
// host/slug cannot escape the filter, and both misses (unknown host, unknown
// slug, inactive or expired link) collapse into the same 404 payload.

routerAdd("GET", "/api/share/resolve", (e) => {
  const share = require(`${__hooks}/lib/share.cjs`)

  e.response.header().set("Cache-Control", "no-store")

  // Cheapest gate first: the local fixed-window limiter sheds floods before
  // the bearer compare or any DB work. The edge WAF rule (task 4.3) is the
  // outer layer; this one bounds direct-to-origin and local-dev traffic.
  const rate = share
    .resolveRateLimiter($os.getenv)
    .take(share.resolveRateKey(e.request.header.get("CF-Connecting-IP")))
  if (!rate.allowed) {
    e.response.header().set("Retry-After", String(rate.retryAfterSeconds))
    return e.json(429, {
      code: "rate_limited",
      message: "Resolve rate limit exceeded",
      retryAfterSeconds: rate.retryAfterSeconds
    })
  }

  const auth = share.evaluateResolveAuth(
    e.request.header.get("Authorization"),
    $os.getenv(share.RESOLVE_SECRET_ENV),
    $security.hs256
  )
  if (!auth.ok) {
    if (auth.code === "resolve_not_configured") {
      return e.json(503, {
        code: auth.code,
        message: auth.message
      })
    }
    return e.json(401, {
      code: "unauthorized",
      message: auth.message
    })
  }

  const query = share.parseResolveQuery({
    host: e.request.url.query().get("host"),
    path: e.request.url.query().get("path")
  })
  if (!query.ok) {
    return e.json(400, {
      code: "invalid_request",
      message: query.message,
      fields: query.fields
    })
  }

  // Host-keyed routing source (spec): the share host selects the app, the
  // slug is scoped per app (idx_links_app_slug), so the same slug on two
  // share hosts stays independent — exactly like the `${share_host}:${path}`
  // KV key space the publisher writes.
  let apps = []
  try {
    apps = $app.findRecordsByFilter(
      "apps",
      share.RESOLVE_APP_QUERY_EXPRESSION,
      "",
      1,
      0,
      { host: query.host }
    )
  } catch (err) {
    apps = []
  }
  if (apps.length === 0) {
    return e.json(404, {
      code: "not_found",
      message: "No such link"
    })
  }

  let links = []
  try {
    links = $app.findRecordsByFilter(
      "links",
      share.RESOLVE_LINK_QUERY_EXPRESSION,
      "",
      1,
      0,
      { app: apps[0].id, slug: query.slug }
    )
  } catch (err) {
    links = []
  }
  if (links.length === 0) {
    return e.json(404, {
      code: "not_found",
      message: "No such link"
    })
  }

  // Edge parity: the engine drops isActive=false rules and expired links
  // (handleRequest), so resolve must not resurrect them via read-through.
  const resolvable = share.evaluateLinkResolvable({
    isActive: links[0].get("is_active") === true,
    expiresAt: links[0].getString("expires_at"),
    now: new Date()
  })
  if (!resolvable.resolvable) {
    return e.json(404, {
      code: "not_found",
      message: "No such link"
    })
  }

  // destination_url is the share-pivot field; legacy rows fall back to
  // `destination` (same precedence as the KV publisher).
  const destination = links[0].getString("destination_url") || links[0].getString("destination")
  if (destination.length === 0 || destination.length > share.MAX_DESTINATION_LENGTH) {
    return e.json(404, {
      code: "not_found",
      message: "No such link"
    })
  }

  return e.json(200, {
    destination: destination,
    code: share.KV_REDIRECT_CODE
  })
})
