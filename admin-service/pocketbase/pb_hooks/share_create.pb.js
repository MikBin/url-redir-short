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

  // TODO(tasks 2.3-2.9): verify Turnstile, enforce the per-IP quota and
  // circuit breaker, generate the slug, persist, publish to KV.
  return e.json(501, {
    code: "not_implemented",
    message: "Create pipeline is not implemented yet"
  })
}, $apis.bodyLimit(4096))
