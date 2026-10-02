/// <reference path="../pb_data/types.d.ts" />

// Task 2.5: daily circuit-breaker baseline job. Computes the trailing baseline
// (default 7 days) and trips `public_creation_paused` when today's total
// creates exceed multiplier x max(trailing daily average, floor). Clicks are
// never affected (they are served entirely at the edge); the operator resets
// the flag via the PocketBase admin UI. Task 4.2 owns the richer admin-log
// notification; this job records a trip line to the app log.
cronAdd("share_breaker_daily", "0 0 * * *", () => {
  const share = require(`${__hooks}/lib/share.cjs`)
  const app = $app

  const readFlag = () => {
    try {
      const record = app.findFirstRecordByFilter(
        "system_config",
        "key = '" + share.BREAKER_FLAG_KEY + "'"
      )
      return share.parseBreakerFlag(record.getString("value"))
    } catch {
      // Absent row means "not configured" -> treat as not paused.
      return false
    }
  }

  const configuredMultiplier = share.parseBreakerMultiplier($os.getenv("BREAKER_MULTIPLIER"))

  const result = share.runBreakerBaselineJob({
    now: new Date(),
    baselineDays: share.DEFAULT_BREAKER_BASELINE_DAYS,
    multiplier:
      configuredMultiplier === null ? share.DEFAULT_BREAKER_MULTIPLIER : configuredMultiplier,
    minimumBaseline: share.DEFAULT_BREAKER_MIN_BASELINE,
    currentPaused: readFlag() === true,
    countCreates: (since, until) => {
      if (until === null) {
        return app.countRecords(
          "links",
          $dbx.exp(share.TODAY_CREATES_QUERY_EXPRESSION, { since: since })
        )
      }
      return app.countRecords(
        "links",
        $dbx.exp(share.BASELINE_CREATES_QUERY_EXPRESSION, { since: since, until: until })
      )
    },
    trip: (info) => {
      const record = app.findFirstRecordByFilter(
        "system_config",
        "key = '" + share.BREAKER_FLAG_KEY + "'"
      )
      record.set("value", true)
      app.save(record)
      app.logger().warn("share circuit breaker tripped", info)
    }
  })

  if (!result.ok) {
    app.logger().error("share circuit breaker job failed", result)
    return
  }

  // Per-run trail for ops (the daily job is otherwise invisible) and the
  // behavioral completion signal the CI gate waits on.
  app.logger().info("share circuit breaker job finished", {
    tripped: result.tripped,
    skipped: result.skipped === undefined ? "" : result.skipped,
    todayCreates: result.todayCreates === undefined ? -1 : result.todayCreates,
    baselineTotal: result.baselineTotal === undefined ? -1 : result.baselineTotal,
    threshold: result.threshold === undefined ? -1 : result.threshold
  })
})
