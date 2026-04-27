# Observability Stack Guide

The URL Redirector & Shortener service includes a centralized observability stack based on Prometheus, Loki, and Grafana.

## Components

- **Prometheus**: Collects and stores time-series metrics from the Admin Service and Redirect Engine.
- **Loki**: Aggregates logs from all containers.
- **Grafana**: Provides a visual dashboard for monitoring system health and performance.
- **Promtail**: Forwards logs from Docker containers to Loki.

## Getting Started

### 1. Start the Stack
The observability stack is defined in a separate Docker Compose file. To start it alongside the main service:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

### 2. Access Dashboards
- **Grafana**: [http://localhost:3004](http://localhost:3004)
  - **User**: `admin`
  - **Password**: `admin` (change on first login)
- **Prometheus**: [http://localhost:9090](http://localhost:9090)
- **Loki API**: [http://localhost:3100](http://localhost:3100)

## Available Dashboards

### System Overview
Located in Grafana under the "General" folder (or via UID `system-overview`).
- **Request Rate**: Real-time throughput for Engine and Admin.
- **Latency (P95)**: 95th percentile response times.
- **Error Rates**: 4xx and 5xx response tracking.
- **SSE Status**: Real-time connection state of the Redirect Engines.

## Metrics Reference

### Redirect Engine (`engine_`)
- `engine_requests_total`: Total requests by status and method.
- `engine_request_duration_seconds`: Latency distribution.
- `engine_cuckoo_filter_lookups_total`: Filter hit/miss ratio.
- `engine_radix_tree_size`: Current number of active routes.
- `engine_cache_hit_ratio`: LRU cache efficiency.
- `engine_sse_connection_status`: 1 = connected, 0 = disconnected.

### Admin Service (`admin_`)
- `admin_requests_total`: API request throughput.
- `admin_sse_clients_connected`: Number of active Redirect Engine connections.
- `admin_links_total`: Total links in the database.
- `admin_analytics_ingestion_total`: Rate of analytics event processing.
- `admin_rate_limit_rejections_total`: Number of blocked requests.

## Troubleshooting

### No Metrics in Grafana
1. Verify Prometheus can scrape targets at [http://localhost:9090/targets](http://localhost:9090/targets).
2. Ensure the `url-redir-net` network is shared between the main services and the observability stack.
3. Check service logs: `docker compose logs prometheus`.

### No Logs in Grafana/Loki
1. Verify Promtail is running: `docker compose logs promtail`.
2. Ensure Promtail has access to `/var/run/docker.sock` and `/var/log`.
