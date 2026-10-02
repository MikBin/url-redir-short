/// <reference path="../pb_data/types.d.ts" />

// Task 2.7: KV publisher (ported from admin-service/supabase cloudflare-kv.ts).
// Persisted `links` records are mirrored to the host-keyed KV namespace as
// `${share_host}:${path}` (path = `/${slug}`) and their keys removed on delete
// (admin takedown now, the §4.1 purge cron later). The publisher lives in
// after-success record hooks so every create path — the anonymous route (2.9),
// the admin UI, seeds — shares one publisher, and a KV failure can never fail
// the record operation: it is warn-logged with the cumulative failure counters
// (not silent); the read-through fallback (2.8/3.5) covers the missed key.
// Unset CF env keeps the publisher off (local-dev default, design Decision 6).
//
// PocketBase's JSVM keeps no hook-file top-level bindings inside registered
// callbacks, so every helper below lives inside its callback (the share.cjs
// module cache carries the process-wide failure counter).

onRecordAfterCreateSuccess((e) => {
  const share = require(`${__hooks}/lib/share.cjs`)
  const metrics = share.kvPublishMetrics()
  const record = e.record
  const config = share.kvConfigFromEnv($os.getenv)

  // Legacy pre-pivot rows (owner/domain scoped, no `app` relation) are not
  // share links: they are skipped, not counted as failures.
  const resolveTarget = () => {
    const appId = record.getString("app")
    if (appId.length === 0) {
      return { kind: "skipped" }
    }

    const path = share.kvSlugPath(record.getString("slug"))
    if (path === null) {
      return { kind: "failed", code: "kv_input_invalid" }
    }

    let shareHost = ""
    try {
      shareHost = $app.findRecordById("apps", appId).getString("share_host")
    } catch (err) {
      return { kind: "failed", code: "kv_app_lookup_failed" }
    }
    if (shareHost.length === 0) {
      return { kind: "failed", code: "kv_app_lookup_failed" }
    }

    return { kind: "resolved", shareHost: shareHost, path: path }
  }

  const report = (result) => {
    if (result.ok) {
      $app.logger().debug("share KV publish ok", "key", result.key)
      return
    }
    if (result.skipped) {
      $app.logger().debug("share KV publisher off, skipped", "contextId", record.id)
      return
    }
    // Every real failure warns and carries the running counters, so the log
    // trail shows both the incident and how often the edge cache has drifted.
    // The JSVM logger is slog-backed: pass alternating key/value args.
    $app.logger().warn(
      "share KV publish failed",
      "code", result.code,
      "status", result.status === undefined || result.status === null ? "" : result.status,
      "contextId", record.id,
      "metrics", JSON.stringify(metrics.snapshot())
    )
  }

  // is_active is mirrored into the RedirectRule value (transformer parity)
  // rather than gating the publish: PocketBase stores unset bools as false,
  // so a gate here would silently drop every record that never set the field.
  const target = resolveTarget()
  if (target.kind === "skipped") {
    $app.logger().debug("share KV publish skipped non-share link", "contextId", record.id)
    return
  }
  if (target.kind === "failed") {
    metrics.recordPublishFailure(target.code)
    report({ ok: false, code: target.code })
    return
  }

  // destination_url is the share-pivot field; legacy rows fall back to
  // `destination` so operator-created links publish identically.
  const destination = record.getString("destination_url") || record.getString("destination")

  const result = share.publishShareLinkToKV(
    {
      shareHost: target.shareHost,
      path: target.path,
      id: record.id,
      destination: destination,
      isActive: record.get("is_active") !== false
    },
    { send: $http.send, config: config, metrics: metrics }
  )
  report(result)
}, "links")

onRecordAfterDeleteSuccess((e) => {
  const share = require(`${__hooks}/lib/share.cjs`)
  const metrics = share.kvPublishMetrics()
  const record = e.record
  const config = share.kvConfigFromEnv($os.getenv)

  const resolveTarget = () => {
    const appId = record.getString("app")
    if (appId.length === 0) {
      return { kind: "skipped" }
    }

    const path = share.kvSlugPath(record.getString("slug"))
    if (path === null) {
      return { kind: "failed", code: "kv_input_invalid" }
    }

    let shareHost = ""
    try {
      shareHost = $app.findRecordById("apps", appId).getString("share_host")
    } catch (err) {
      return { kind: "failed", code: "kv_app_lookup_failed" }
    }
    if (shareHost.length === 0) {
      return { kind: "failed", code: "kv_app_lookup_failed" }
    }

    return { kind: "resolved", shareHost: shareHost, path: path }
  }

  const report = (result) => {
    if (result.ok) {
      $app.logger().debug("share KV delete ok", "key", result.key)
      return
    }
    if (result.skipped) {
      $app.logger().debug("share KV publisher off, skipped", "contextId", record.id)
      return
    }
    $app.logger().warn(
      "share KV delete failed",
      "code", result.code,
      "status", result.status === undefined || result.status === null ? "" : result.status,
      "contextId", record.id,
      "metrics", JSON.stringify(metrics.snapshot())
    )
  }

  const target = resolveTarget()
  if (target.kind === "skipped") {
    $app.logger().debug("share KV delete skipped non-share link", "contextId", record.id)
    return
  }
  if (target.kind === "failed") {
    metrics.recordDeleteFailure(target.code)
    report({ ok: false, code: target.code })
    return
  }

  const result = share.deleteShareLinkFromKV(
    { shareHost: target.shareHost, path: target.path },
    { send: $http.send, config: config, metrics: metrics }
  )
  report(result)
}, "links")
