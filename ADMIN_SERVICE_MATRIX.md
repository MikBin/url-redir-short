# Admin Service Quick Reference Matrix

## Feature Availability

| Feature Category | Feature | Supabase | PocketBase | File Reference |
|---|---|---|---|---|
| **Authentication** | Magic Links | ✅ | ❌ | [login.vue (Supabase)](admin-service/supabase/app/pages/login.vue) |
| | Email/Password | ❌ | ✅ | [login.vue (PocketBase)](admin-service/pocketbase/app/pages/login.vue) |
| | User Registration | ❌ | ✅ | [register.vue](admin-service/pocketbase/app/pages/register.vue) |
| | Session Management | Supabase Auth | pb_auth cookie | [app.vue](admin-service/supabase/app/app.vue) vs [pocketbase.ts](admin-service/pocketbase/server/utils/pocketbase.ts) |
| **Link Management** | Create Link | ✅ | ✅ | [create.post.ts](admin-service/supabase/server/api/links/create.post.ts) |
| | Read Links | ✅ | ✅ | [index.vue](admin-service/supabase/app/pages/index.vue) |
| | Update Link | ✅ | ✅ | [id].patch.ts files |
| | Delete Link | ✅ | ✅ | [id].delete.ts files |
| | Link Expiration | ✅ | ✅ | schema.sql / pb_schema.json |
| | Max Clicks Limit | ✅ | ✅ | schema.sql / pb_schema.json |
| **Link Features** | Password Protection | ✅ | ✅ | schema.sql / pb_schema.json |
| | HSTS Headers | ✅ | ✅ | schema.sql / pb_schema.json |
| | Targeting Rules | ✅ | ✅ | schema.sql / pb_schema.json |
| | A/B Testing | ✅ | ✅ | schema.sql / pb_schema.json |
| **Domain Management** | Create Domain | Schema only | ✅ | [domains/index.vue](admin-service/pocketbase/app/pages/domains/index.vue) |
| | Domain UI | ❌ | ✅ | [domains/index.vue](admin-service/pocketbase/app/pages/domains/index.vue) |
| **Analytics** | Dashboard | ✅ Full | 🚧 Basic | [analytics.vue](admin-service/supabase/app/pages/analytics.vue) |
| | Charts | ✅ | 🚧 | [analytics.vue](admin-service/supabase/app/pages/analytics.vue) |
| | Exports | ✅ Defined | ❌ | [export/[format].get.ts](admin-service/supabase/server/api/analytics/export/[format].get.ts) |
| | Top Links | ✅ | ❌ | [dashboard.get.ts](admin-service/supabase/server/api/analytics/dashboard.get.ts) |
| **Utilities** | Bulk Import | ✅ | ❌ | [bulk.post.ts](admin-service/supabase/server/api/bulk.post.ts) |
| | QR Code Gen | ✅ | ❌ | [qr.get.ts](admin-service/supabase/server/api/qr.get.ts) |
| | UTM Builder | ✅ | ❌ | [UtmBuilder.vue](admin-service/supabase/app/components/UtmBuilder.vue) |
| | Audit Log | ✅ | 🚧 | [audit.ts](admin-service/supabase/server/utils/audit.ts) |
| **System** | Health Check | ✅ | ❌ | [health.get.ts](admin-service/supabase/server/api/health.get.ts) |
| | Metrics | ✅ | ❌ | [metrics.get.ts](admin-service/supabase/server/api/metrics.get.ts) |
| | Status Page | ✅ | ❌ | [status.vue](admin-service/supabase/app/pages/status.vue) |
| **Security** | CORS Headers | ✅ | ⚠️ | [security.ts](admin-service/supabase/server/middleware/security.ts) |
| | Rate Limiting | ✅ | ❌ | [rate-limit.ts](admin-service/supabase/server/utils/rate-limit.ts) |
| | Input Sanitization | ✅ | ✅ | [sanitizer.ts](admin-service/supabase/server/utils/sanitizer.ts) |
| **Real-time Sync** | SSE Stream | ✅ | ✅ | [stream.get.ts](admin-service/supabase/server/api/sync/stream.get.ts) |
| | Auto-trigger | ✅ PostgreSQL | 🚧 Manual | [realtime.ts](admin-service/supabase/server/plugins/realtime.ts) |
| | Data Transform | ✅ | ✅ | [transformer.ts](admin-service/supabase/server/utils/transformer.ts) |
| **Testing** | Unit Tests | ✅ 10+ | ✅ 3 | [tests/](admin-service/supabase/tests/) |
| | Integration Tests | ✅ | ❌ | [tests/integration/](admin-service/supabase/tests/integration/) |
| | Perf Tests | ✅ | ❌ | [tests/perf/](admin-service/supabase/tests/perf/) |

---

## API Endpoint Comparison

### Supabase Endpoints
```
POST   /api/links/create
PATCH  /api/links/[id]
DELETE /api/links/[id]

GET    /api/analytics/dashboard
GET    /api/analytics/stats
GET    /api/analytics/links/overview
GET    /api/analytics/links/[linkId]
GET    /api/analytics/export/[format]
GET    /api/analytics/v1/*

GET    /api/health
GET    /api/metrics
POST   /api/bulk
GET    /api/qr

GET    /api/sync/stream (SSE)
```

### PocketBase Endpoints
```
POST   /api/links/create
GET    /api/links/index
PATCH  /api/links/[id]
DELETE /api/links/[id]

POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout

GET    /api/domains (implied)
POST   /api/domains (implied)

GET    /api/analytics/v1/* (planned)

GET    /api/sync/stream (SSE)
```

---

## Database Schema Comparison

### Core Tables (Both)
| Table | Supabase | PocketBase |
|---|---|---|
| domains | ✅ | ✅ |
| links | ✅ | ✅ |
| sessions | ✅ | ✅ |
| analytics_events | ✅ | ✅ |
| users | auth.users (managed) | users collection |

### Additional Tables
| Table | Supabase | PocketBase |
|---|---|---|
| analytics_aggregates | ✅ Hourly/daily aggregates | ❌ |
| link_analytics_overview | ✅ View for quick stats | ❌ |

---

## Dependency Comparison

### Supabase
```json
{
  "@nuxtjs/supabase": "^2.0.3",
  "@supabase/supabase-js": "^2.89.0",
  "@nuxtjs/tailwindcss": "^6.14.0",
  "nuxt": "^4.2.2",
  "vue": "^3.5.26",
  "vue-router": "^4.6.4",
  "zod": "^3.24.0",
  "qrcode": "^1.5.4",
  "chart.js": "^4.5.1",
  "vue-chartjs": "^5.3.3",
  "pino": "^10.3.1",
  "ioredis": "^5.9.2"
}
```

### PocketBase
```json
{
  "nuxt": "^4.4.2",
  "@nuxtjs/tailwindcss": "^6.14.0",
  "vue": "^3.5.31",
  "vue-router": "^5.0.4",
  "pocketbase": "^0.26.8",
  "zod": "^4.3.6"
}
```

**Key Differences:**
- Supabase: includes Supabase client, charting, Redis/pino logging
- PocketBase: includes PocketBase SDK, minimal dependencies

---

## File Structure Comparison

### Supabase
```
admin-service/supabase/
├── app/
│   ├── pages/
│   │   ├── index.vue           (Dashboard with full link CRUD)
│   │   ├── analytics.vue       (Analytics with charts)
│   │   ├── login.vue           (Magic link login)
│   │   └── status.vue          (System health)
│   ├── components/
│   │   ├── UtmBuilder.vue
│   │   └── AuditLog.vue
│   ├── composables/
│   │   └── useUtmTemplates.ts
│   └── types/
│       └── database.types.ts
├── server/
│   ├── api/
│   │   ├── links/              (CRUD)
│   │   ├── analytics/          (Dashboard, stats, export, v1)
│   │   ├── sync/               (SSE stream)
│   │   ├── bulk.post.ts
│   │   ├── health.get.ts
│   │   ├── metrics.get.ts
│   │   └── qr.get.ts
│   ├── middleware/
│   │   ├── error.ts
│   │   ├── security.ts
│   │   └── rate-limit.ts
│   ├── plugins/
│   │   └── realtime.ts
│   └── utils/
│       ├── audit.ts
│       ├── broadcaster.ts
│       ├── config.ts
│       ├── error-handler.ts
│       ├── hash.ts
│       ├── logger.ts
│       ├── monitoring.ts
│       ├── qr.ts
│       ├── rate-limit.ts
│       ├── sanitizer.ts
│       ├── storage.ts
│       └── transformer.ts
├── tests/
│   ├── broadcaster.test.ts
│   ├── bulk.test.ts
│   ├── hash.test.ts
│   ├── qr.test.ts
│   ├── rate-limit.test.ts
│   ├── sanitizer.property.test.ts
│   ├── targeting.test.ts
│   ├── transformer.property.test.ts
│   ├── transformer.test.ts
│   ├── components/
│   ├── integration/
│   └── perf/
└── schema.sql
```

### PocketBase
```
admin-service/pocketbase/
├── app/
│   ├── pages/
│   │   ├── index.vue           (Home)
│   │   ├── analytics.vue       (Analytics - basic)
│   │   ├── login.vue           (Email/password login)
│   │   ├── register.vue        (Registration)
│   │   └── domains/
│   │       └── index.vue       (Domain list/crud)
├── server/
│   ├── api/
│   │   ├── links/              (CRUD)
│   │   ├── auth/               (login, register, logout)
│   │   ├── analytics/          (v1 planned)
│   │   └── sync/               (SSE stream)
│   ├── middleware/
│   │   └── auth.ts             (Auth guard)
│   ├── plugins/
│   │   └── realtime.ts         (Empty)
│   └── utils/
│       ├── broadcaster.ts
│       ├── pocketbase.ts
│       ├── targeting.ts
│       └── transformer.ts
├── tests/
│   ├── broadcaster.test.ts
│   ├── targeting.test.ts
│   └── transformer.test.ts
├── pb_schema.json
├── pb_init.js
└── pb_seed.js
```

---

## Decision Matrix: Which to Use?

| Scenario | Recommendation | Reason |
|----------|---|---|
| Need production analytics | ✅ Supabase | Full dashboard, exports, metrics |
| Self-contained deployment | ✅ PocketBase | No external DB, embedded SQLite |
| Need user self-registration | ✅ PocketBase | Built-in registration UI |
| Want no password management | ✅ Supabase | Magic links only |
| Need domain management UI | ✅ PocketBase | Full domain CRUD interface |
| Require audit logging | ✅ Supabase | Comprehensive audit system |
| Want bulk data import | ✅ Supabase | CSV bulk import provided |
| Need QR codes | ✅ Supabase | QR code generation built-in |
| Simple auth needed | ✅ PocketBase | Password-based is simpler |
| Cloud database preferred | ✅ Supabase | PostgreSQL on Supabase |
| Self-hosted database | ✅ PocketBase | SQLite embedded |

---

## Implementation Roadmap

### Supabase - To Production
- ✅ Core features complete
- 🚧 Missing: Domain management UI (can add if needed)
- ⚠️ Note: Verify analytics_aggregates are being populated correctly

### PocketBase - To Feature Parity
1. ✅ Link CRUD (90% complete)
2. 🚧 Analytics Dashboard (20% complete - needs full implementation)
3. ❌ Bulk Import (not started)
4. ❌ QR Code Generation (not started)
5. ❌ UTM Builder (not started)
6. ❌ Health/Metrics Endpoints (not started)
7. 🚧 Comprehensive Testing (30% complete)

---

## References

**Supabase Implementation:**
- Main Schema: [schema.sql](admin-service/supabase/schema.sql)
- Real-time Architecture: [realtime.ts](admin-service/supabase/server/plugins/realtime.ts)
- All API Endpoints: [server/api/](admin-service/supabase/server/api/)

**PocketBase Implementation:**
- Schema Definition: [pb_schema.json](admin-service/pocketbase/pb_schema.json)
- Setup Guide: [README.md](admin-service/pocketbase/README.md)
- All API Endpoints: [server/api/](admin-service/pocketbase/server/api/)

**Shared Documentation:**
- Full Comparison: [ADMIN_SERVICE_COMPARISON.md](ADMIN_SERVICE_COMPARISON.md)
