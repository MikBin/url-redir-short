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
