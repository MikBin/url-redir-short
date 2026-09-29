# Implementation Tasks: Centralized Observability Stack

## Task 1: Engine Prometheus Metrics
**Files:** `redir-engine/src/adapters/metrics/prometheus.ts`, `redir-engine/src/adapters/http/server.ts`
- [ ] Install `prom-client` package
- [ ] Create metrics registry with default metrics
- [ ] Add request counter with labels: method, path_pattern, status
- [ ] Add request duration histogram with labels: method, path_pattern
- [ ] Add cache hit ratio gauge updated on each request
- [ ] Add SSE connection status gauge
- [ ] Add heap memory gauge
- [ ] Expose `/metrics` endpoint returning Prometheus text format
- [ ] Unit tests for metric increment/gauge logic

## Task 2: Admin Service Prometheus Metrics
**Files:** `admin-service/supabase/server/utils/metrics.ts`, `admin-service/supabase/server/api/metrics.get.ts`
- [ ] Install `prom-client` package
- [ ] Create Nuxt server middleware to track request metrics
- [ ] Add request counter, latency histogram
- [ ] Add SSE clients connected gauge (integrate with broadcaster)
- [ ] Add analytics ingestion counter
- [ ] Add rate limit rejection counter
- [ ] Expose `/api/metrics` endpoint
- [ ] Unit tests for metric collection

## Task 3: Docker Compose Observability Stack
**File:** `docker-compose.observability.yml`
- [ ] Add Prometheus service with scrape config targeting admin:3000/api/metrics and engine:3000/metrics
- [ ] Add Grafana service with provisioned datasources (Prometheus, Loki)
- [ ] Add Loki service for log aggregation
- [ ] Add Promtail service configured to collect Docker container logs
- [ ] Create `infra/prometheus/prometheus.yml` scrape config
- [ ] Create `infra/grafana/dashboards/system-overview.json`
- [ ] Create `infra/grafana/dashboards/engine-performance.json`
- [ ] Create `infra/grafana/provisioning/` datasource and dashboard configs

## Task 4: Alerting Rules
**Files:** `infra/prometheus/alerts.yml`, `infra/alertmanager/alertmanager.yml`
- [ ] Define alert rules for high error rate, SSE disconnect, high memory, high latency
- [ ] Configure Alertmanager with webhook/email receiver
- [ ] Test alert rules with Prometheus unit testing
- [ ] Create `docs/runbooks/` with alert response procedures

## Review Log

**Date:** 2026-09-29 · **Reviewer:** nw-platform-architect-reviewer (Kilo) + nw-software-crafter-reviewer (Kilo)
**Verdict:** NEEDS_REVISION — backlog false negative: Tasks 1–3 are ~75% implemented in reality (0% claimed). Task 4 (alerting) genuinely 0%.

**Findings (priority order):**

- `issue (blocking):` Task 4 has zero implementation: no `infra/prometheus/alerts.yml`, no Alertmanager anywhere in `infra/`, and `docs/operations/observability.md` admits alerting rules are "still pending".
- `issue (blocking, security):` `docker-compose.observability.yml:48` — Grafana admin password hardcoded as `admin` with port 3004 published; Prometheus (9090) and Loki (3100) also published unauthenticated. Use a file secret and bind observability ports to localhost (or drop in prod overlay).
- `issue (blocking):` Shipped dashboard is broken: `infra/grafana/dashboards/system-overview.json:28` references datasource `uid: "Prometheus"`, but `infra/grafana/provisioning/datasources/datasources.yml` provisions no `uid:` — panels resolve to a nonexistent datasource and render empty.
- `suggestion (non-blocking):` `docker-compose.observability.yml:62-64` hardcodes external network name `url-redir-short_url-redir-net` (breaks under podman-compose naming and when the base stack is down); `infra/loki/loki-config.yaml:28` sets `enforce_metric_name`, removed in Loki 3.x, and images are `:latest` — the observability stack likely won't boot as pinned. Pin versions and update config.
- `suggestion (non-blocking):` Task checkbox hygiene: Tasks 1–3 largely implemented (`redir-engine/src/adapters/metrics/prometheus.ts`, `/metrics` endpoint, `admin-service/supabase/server/utils/metrics.ts`, `/api/metrics`, compose stack, system-overview dashboard + tests exist). Stale unchecked boxes make the roadmap untrustworthy for planning — reconcile status with reality.
- `nitpick (non-blocking):` Only one of the three dashboards (Task 3) exists; `engine-performance.json` is missing.
- `praise:` Metric exporters match the spec tables exactly, dashboard queries reference real metric names, and `observability.md` carries an honest implementation-status banner. Careful work most repos of this size never get right.
