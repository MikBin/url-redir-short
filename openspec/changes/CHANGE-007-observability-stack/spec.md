# Specification: Centralized Observability Stack

## Metrics (Prometheus)

### Redirect Engine Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `engine_requests_total` | Counter | Total redirect requests by status code |
| `engine_request_duration_seconds` | Histogram | Request latency distribution |
| `engine_cuckoo_filter_lookups_total` | Counter | Cuckoo filter lookups (hit/miss) |
| `engine_radix_tree_size` | Gauge | Number of routes in radix tree |
| `engine_cache_hit_ratio` | Gauge | LRU cache hit ratio |
| `engine_cache_entries` | Gauge | Current cache entries |
| `engine_sse_connection_status` | Gauge | SSE connection state (0=disconnected, 1=connected) |
| `engine_memory_heap_mb` | Gauge | Heap memory usage |

### Admin Service Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `admin_requests_total` | Counter | API requests by endpoint and status |
| `admin_request_duration_seconds` | Histogram | API latency distribution |
| `admin_sse_clients_connected` | Gauge | Number of connected engine clients |
| `admin_links_total` | Gauge | Total managed links |
| `admin_analytics_ingestion_total` | Counter | Analytics events ingested |
| `admin_rate_limit_rejections_total` | Counter | Rate limit rejections |

## Logging (Loki)
- Existing `createLogger()` output forwarded to Loki via Docker log driver or Promtail
- Labels: `service`, `level`, `correlationId`
- Retention: 30 days default

## Dashboards (Grafana)
1. **System Overview**: Request rate, error rate, latency P50/P95/P99, SSE status
2. **Engine Performance**: Cache hit ratio, cuckoo filter efficiency, memory usage
3. **Admin Operations**: Link CRUD rates, analytics ingestion, rate limit hits

## Alerting Rules
| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | >5% 5xx responses in 5min | Critical |
| SSE Disconnected | Engine disconnected >2min | Critical |
| High Memory | Heap >80% of limit | Warning |
| High Latency | P99 >500ms for 5min | Warning |
| Rate Limit Spike | >100 rejections/min | Info |
