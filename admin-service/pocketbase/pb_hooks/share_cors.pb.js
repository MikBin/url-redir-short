/// <reference path="../pb_data/types.d.ts" />

routerUse(new Middleware((e) => {
  const share = require(`${__hooks}/lib/share.cjs`)

  if (e.request.url.path !== share.CREATE_PATH) {
    return e.next()
  }

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

  if (e.request.method === "OPTIONS") {
    if (decision.kind === "allowed") {
      e.response.header().set("Access-Control-Allow-Origin", decision.origin)
      e.response.header().set("Access-Control-Allow-Methods", "POST")
      e.response.header().set(
        "Access-Control-Allow-Headers",
        e.request.header.get("Access-Control-Request-Headers") || "content-type"
      )
      e.response.header().set("Access-Control-Max-Age", "600")
    }
    e.response.header().set("Vary", "Origin")
    return e.noContent(204)
  }

  return e.next()
}, -1100, "shareCors"))
