# Change Proposal: Centralized Observability Stack

> [!NOTE]
> **POSTPONED (2026-09-30, ADR-007):** deferred in favor of the `public-share-shortener` goal (which carries its own minimal ops: PB backup cron, Analytics Engine dashboard, runbook). See `openspec/roadmap.md`.

## Problem
The system has structured JSON logging via `createLogger()` but no log aggregation, metrics export, or alerting. In production, diagnosing issues across distributed Admin Service and multiple Engine instances requires centralized observability.

## Opportunity
Adding Prometheus metrics endpoints, structured log forwarding, and Grafana dashboards provides real-time visibility into system health, performance, and errors.

## Success Metrics
- Prometheus `/metrics` endpoints on both Admin Service and Redirect Engine
- Key metrics exported: request rate, latency percentiles, error rate, SSE connection status, cache hit ratio
- Grafana dashboard with system overview
- Log aggregation via Loki or similar
- Alert rules for critical conditions (high error rate, SSE disconnection, high memory)

## Scope
- Prometheus metrics middleware for both services
- Grafana dashboard configuration
- Docker Compose observability overlay
- Alert rule definitions
- Log forwarding configuration
