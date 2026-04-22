# Implementation Plan: Centralized Observability Stack

## Phase 1: Prometheus Metrics — Redirect Engine
- [ ] Add `prom-client` dependency to redir-engine
- [ ] Create metrics middleware in `redir-engine/src/adapters/metrics/prometheus.ts`
- [ ] Add `/metrics` endpoint to Hono server
- [ ] Instrument: request counter, latency histogram, cache gauges, SSE status
- [ ] Unit tests for metrics collection

## Phase 2: Prometheus Metrics — Admin Service
- [ ] Add metrics utility in `admin-service/supabase/server/utils/metrics.ts`
- [ ] Create Nuxt server middleware for request metrics
- [ ] Add `/api/metrics` endpoint (Prometheus format)
- [ ] Instrument: request counter, latency, SSE clients, link counts
- [ ] Unit tests for metrics collection

## Phase 3: Grafana + Loki Stack
- [ ] Create `docker-compose.observability.yml` overlay
- [ ] Add Prometheus service with scrape config
- [ ] Add Grafana service with provisioned dashboards
- [ ] Add Loki + Promtail for log aggregation
- [ ] Create dashboard JSON files in `infra/grafana/dashboards/`

## Phase 4: Alerting
- [ ] Create Prometheus alert rules in `infra/prometheus/alerts.yml`
- [ ] Configure Alertmanager for notifications (email/webhook)
- [ ] Test alert firing and resolution
- [ ] Document alert runbooks
