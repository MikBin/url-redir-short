import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

class AdminMetrics {
  public registry: Registry;
  public requestsTotal: Counter;
  public requestDuration: Histogram;
  public sseClients: Gauge;
  public linksTotal: Gauge;
  public analyticsIngestionTotal: Counter;
  public rateLimitRejections: Counter;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'admin_' });

    this.requestsTotal = new Counter({
      name: 'admin_requests_total',
      help: 'API requests by endpoint and status',
      labelNames: ['endpoint', 'status', 'method'],
      registers: [this.registry]
    });

    this.requestDuration = new Histogram({
      name: 'admin_request_duration_seconds',
      help: 'API latency distribution',
      labelNames: ['endpoint', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.sseClients = new Gauge({
      name: 'admin_sse_clients_connected',
      help: 'Number of connected engine clients',
      registers: [this.registry]
    });

    this.linksTotal = new Gauge({
      name: 'admin_links_total',
      help: 'Total managed links',
      registers: [this.registry]
    });

    this.analyticsIngestionTotal = new Counter({
      name: 'admin_analytics_ingestion_total',
      help: 'Analytics events ingested',
      registers: [this.registry]
    });

    this.rateLimitRejections = new Counter({
      name: 'admin_rate_limit_rejections_total',
      help: 'Rate limit rejections',
      labelNames: ['endpoint'],
      registers: [this.registry]
    });
  }
}

export const metrics = new AdminMetrics();
