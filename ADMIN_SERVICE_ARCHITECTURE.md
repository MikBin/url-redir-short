# Admin Service Architecture Comparison

## Visual Architecture Diagrams

### Supabase Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Admin Service                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Vue 3 Frontend │  │  Dashboard   │  │  Auth Pages     │   │
│  │  (Nuxt 4)       │  │  - index.vue │  │  - login.vue    │   │
│  │                 │  │  - analytics │  │  (Magic Links)  │   │
│  │  ┌───────────┐  │  │  - status    │  │  - register: NO │   │
│  │  │ Components│  │  │              │  │                 │   │
│  │  │ - UtmBuilder  │  │  Advanced    │  │                 │   │
│  │  │ - AuditLog    │  │  Features    │  │                 │   │
│  │  └───────────┘  │  │  - Targeting │  │                 │   │
│  │                 │  │  - A/B Test  │  │                 │   │
│  │  useSupabaseUser()  │  - HSTS      │  │                 │   │
│  │  useSupabaseClient()│  - Password  │  │                 │   │
│  │                 │  │  - Expiry    │  │                 │   │
│  └─────────────────┘  └──────────────┘  └─────────────────┘   │
│           │                                                      │
│           └──────────────────────┬───────────────────────────┘  │
│                                  │                              │
│                    ┌─────────────┴─────────────┐                │
│                    │                           │                │
│              useSupabaseClient()         Supabase Module        │
│              (JWT in Authorization)     (Implicit Auth)         │
│                    │                           │                │
└────────────────────┼───────────────────────────┼────────────────┘
                     │                           │
                     └─────────────┬─────────────┘
                                   │
                  ┌────────────────▼─────────────────┐
                  │   Nitro Server (Nuxt Backend)    │
                  ├──────────────────────────────────┤
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Security Middleware        │ │
                  │  │  - CORS, CSP, HSTS headers  │ │
                  │  │  - Rate limiting            │ │
                  │  │  - Input sanitization       │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  API Endpoints              │ │
                  │  │  - /api/links/*             │ │
                  │  │  - /api/analytics/*         │ │
                  │  │  - /api/bulk (CSV import)   │ │
                  │  │  - /api/qr (QR generation)  │ │
                  │  │  - /api/health, /metrics    │ │
                  │  │  - /api/sync/stream (SSE)   │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Realtime Plugin            │ │
                  │  │  (server/plugins/          │ │
                  │  │   realtime.ts)              │ │
                  │  │  - Listen to postgres_     │ │
                  │  │    changes events           │ │
                  │  │  - Emit to broadcaster      │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Utilities                  │ │
                  │  │  - transformer.ts           │ │
                  │  │  - broadcaster.ts           │ │
                  │  │  - audit.ts                 │ │
                  │  │  - rate-limit.ts            │ │
                  │  │  - sanitizer.ts             │ │
                  │  │  - monitoring.ts            │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  └────────┬───────────────┬─────────┘
                           │               │
            ┌──────────────┘               └──────────────┐
            │                                             │
    ┌───────▼──────────────┐              ┌──────────────▼────┐
    │  Supabase Realtime   │              │  PostgreSQL DB    │
    │  (Client)            │              │  (Cloud)          │
    │                      │              │                   │
    │ Subscribes to:       │              │  Tables:          │
    │ - postgres_changes   │              │  - domains        │
    │   on links table     │              │  - links          │
    │ - postgres_changes   │              │  - sessions       │
    │   on domains table   │              │  - analytics_     │
    │                      │              │    events         │
    │ Emits events to      │              │  - analytics_     │
    │ broadcaster via      │              │    aggregates     │
    │ realtime.ts plugin   │              │                   │
    └──────────────────────┘              │  RLS Enabled      │
                                          │  Realtime Enabled │
                                          └───────────────────┘

            ┌─────────────────────────────────────────┐
            │   Redir-Engine (Separate Service)       │
            │   Connects to: /api/sync/stream (SSE)   │
            │   Receives: Create/Update/Delete events │
            │   Applies: Link rules to routing engine │
            └─────────────────────────────────────────┘
```

---

### PocketBase Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 PocketBase Admin Service                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Vue 3 Frontend │  │  Pages       │  │  Auth Pages     │   │
│  │  (Nuxt 4)       │  │  - index.vue │  │  - login.vue    │   │
│  │                 │  │  - analytics │  │  - register.vue │   │
│  │  ┌───────────┐  │  │  - domains   │  │  ✅ Has both    │   │
│  │  │ No Reusable   │  │              │  │                 │   │
│  │  │ Components│  │  │  Advanced    │  │                 │   │
│  │  │ (yet)     │  │  │  Features    │  │                 │   │
│  │  └───────────┘  │  │  - Targeting │  │                 │   │
│  │                 │  │  - A/B Test  │  │                 │   │
│  │  useCookie      │  │  - HSTS      │  │                 │   │
│  │  ('pb_auth')    │  │  - Password  │  │                 │   │
│  │                 │  │  - Expiry    │  │                 │   │
│  └─────────────────┘  └──────────────┘  └─────────────────┘   │
│           │                                                      │
│           └──────────────────────┬───────────────────────────┘  │
│                                  │                              │
│                           pb_auth Cookie                        │
│                        (httpOnly, 7-day)                        │
│                                  │                              │
└────────────────────────────────────────────────────────────────┘
                                   │
                  ┌────────────────▼─────────────────┐
                  │   Nitro Server (Nuxt Backend)    │
                  ├──────────────────────────────────┤
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Auth Middleware            │ │
                  │  │  - Check /api/* routes      │ │
                  │  │  - Validate pb_auth cookie  │ │
                  │  │  - Load user from DB        │ │
                  │  │  - Attach to context        │ │
                  │  │  (Skip /api/auth/*, /api/  │ │
                  │  │   sync/*)                   │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  API Endpoints              │ │
                  │  │  - /api/links/* (CRUD)      │ │
                  │  │  - /api/auth/* (login,      │ │
                  │  │    register, logout)        │ │
                  │  │  - /api/analytics/* (basic) │ │
                  │  │  - /api/sync/stream (SSE)   │ │
                  │  │  - /api/domains (implied)   │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Manual Broadcaster         │ │
                  │  │  (In API handlers)          │ │
                  │  │  - Each endpoint calls      │ │
                  │  │    broadcaster.broadcast()  │ │
                  │  │  - Emits to EventEmitter    │ │
                  │  │  - No automatic triggers    │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  │  ┌─────────────────────────────┐ │
                  │  │  Utilities                  │ │
                  │  │  - pocketbase.ts (SDK)      │ │
                  │  │  - transformer.ts           │ │
                  │  │  - broadcaster.ts           │ │
                  │  │  - targeting.ts             │ │
                  │  │  (minimal compared to      │ │
                  │  │   Supabase)                 │ │
                  │  └─────────────────────────────┘ │
                  │                                  │
                  └────────┬───────────────┬─────────┘
                           │               │
            ┌──────────────┘               └──────────────┐
            │                                             │
    ┌───────▼──────────────┐              ┌──────────────▼────┐
    │  EventEmitter        │              │  SQLite DB        │
    │  (In-Memory)         │              │  (Embedded)       │
    │                      │              │                   │
    │ Receives from:       │              │  Collections:     │
    │ - API endpoints call │              │  - domains        │
    │   broadcaster.       │              │  - links          │
    │   broadcast()        │              │  - sessions       │
    │                      │              │  - analytics_     │
    │ Emits to:            │              │    events         │
    │ - SSE stream handler │              │  - users          │
    │                      │              │                   │
    │ Note: ONLY emits     │              │  Access Control:  │
    │ when manually called │              │  - Custom rules   │
    │ from endpoint        │              │    per collection │
    └──────────────────────┘              │  - No RLS         │
                                          │  - Rule engine    │
                                          │    built-in       │
                                          └───────────────────┘

            ┌─────────────────────────────────────────┐
            │   Redir-Engine (Separate Service)       │
            │   Connects to: /api/sync/stream (SSE)   │
            │   Receives: Create/Update/Delete events │
            │   Applies: Link rules to routing engine │
            │                                         │
            │   Note: Depends on proper manual        │
            │   broadcasting in all endpoints         │
            └─────────────────────────────────────────┘
```

---

## Real-time Sync Flow Comparison

### Supabase Real-time Sync Flow

```
┌──────────────────┐
│  Admin Creates   │
│  a Link via UI   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│  Frontend HTTP POST       │
│  /api/links/create       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Nitro Handler (create.post.ts)  │
│  - Validates with Zod            │
│  - Inserts into Supabase         │
│  - Returns success               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  PostgreSQL (Supabase)       │
│  - Row inserted              │
│  - Triggers enabled          │
│  - REPLICA IDENTITY FULL     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  PostgreSQL Triggers emit    │
│  postgres_changes event      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Supabase Realtime Client    │
│  (In server plugin)          │
│  - Receives event            │
│  - Calls transformation      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  transformer.ts              │
│  - Converts snake_case to    │
│    camelCase                 │
│  - Formats for engine        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  broadcaster.emit()          │
│  - EventEmitter broadcasts   │
│    to all listeners          │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  SSE Stream Handler          │
│  (/api/sync/stream)          │
│  - Listens to events         │
│  - Sends to client via SSE   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Redir-Engine                │
│  - Receives SSE event        │
│  - Updates routing table     │
│  - Ready to serve new URL    │
└──────────────────────────────┘

⏱️  TOTAL: ~100-200ms (automatic)
✅ AUTOMATIC: Triggered by DB insert
❌ NO MANUAL CALLS NEEDED
```

### PocketBase Real-time Sync Flow

```
┌──────────────────┐
│  Admin Creates   │
│  a Link via UI   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  Frontend HTTP POST          │
│  /api/links/create           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Nitro Handler (create.post.ts)  │
│  - Validates with Zod            │
│  - Checks authentication          │
│  - Inserts into PocketBase        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  PocketBase SDK              │
│  collection.create()         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  SQLite (embedded)           │
│  - Row inserted              │
│  - ⚠️ NO AUTOMATIC TRIGGER   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  ⚠️ MANUAL STEP:             │
│  broadcaster.broadcast()     │
│  MUST be called by endpoint  │
│  - Transforms data           │
│  - Emits to EventEmitter     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  EventEmitter                │
│  - Broadcasts to listeners   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  SSE Stream Handler          │
│  (/api/sync/stream)          │
│  - Listens to events         │
│  - Sends to client via SSE   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Redir-Engine                │
│  - Receives SSE event        │
│  - Updates routing table     │
│  - Ready to serve new URL    │
└──────────────────────────────┘

⏱️  TOTAL: ~100-200ms (if called)
⚠️  MANUAL: Must call broadcaster.broadcast()
❌ RISK: If not called, no sync happens
💡 SOLUTION: Ensure ALL endpoints call broadcaster
```

---

## Data Transformation Pipeline

Both implementations transform data from database format to engine format:

```
DATABASE (snake_case)          TRANSFORMATION           ENGINE (camelCase)
┌──────────────────┐           ┌─────────┐           ┌──────────────────┐
│ {                │  ────────►│         │  ────────►│ {                │
│   "slug": "foo", │           │transformer.ts         │   "path": "/foo",│
│   "destination": │           │                       │   "destination": │
│   "https://...", │  ────────►│ - Adds "/" to path   │   "https://...", │
│   "is_active": │           │ - Converts to         │   "code": 301,   │
│   true,         │  ────────►│   RedirectRule        │   "targeting":   │
│   "targeting": │           │ - Preserves JSON      │   {...},         │
│   {...},        │  ────────►│   fields (targeting,  │   "ab_testing":  │
│   "ab_testing": │           │   ab_testing, etc)    │   {...},         │
│   {...},        │  ────────►│ - Converts dates      │   "expires_at":  │
│   "expires_at": │           │                       │   1234567890,    │
│   "2025-...",   │  ────────►│                       │   "max_clicks":  │
│   "max_clicks":  │           │                       │   100            │
│   100           │  ────────►│                       │ }                │
│ }               │           │                       └──────────────────┘
└──────────────────┘           └─────────┘

BOTH IMPLEMENTATIONS USE IDENTICAL TRANSFORMATION:
- Supabase: server/utils/transformer.ts
- PocketBase: server/utils/transformer.ts
- Interface names differ (SupabaseLink vs PocketBaseLink) but logic identical
```

---

## Key Architectural Differences

| Aspect | Supabase | PocketBase |
|--------|----------|-----------|
| **Database Triggers** | ✅ Automatic PostgreSQL triggers | ❌ Manual in API handlers |
| **Real-time Subscription** | ✅ Built-in Supabase Realtime | ⚠️ Manual EventEmitter |
| **Deployment** | Cloud-based | Self-hosted/embedded |
| **Database Type** | PostgreSQL (managed) | SQLite (embedded) |
| **Complexity** | Higher (more layers) | Lower (fewer layers) |
| **Reliability** | DB-level guarantees | App-level responsibility |
| **Scalability** | Scales with Supabase | Limited by single-instance |
| **Feature Completeness** | ~90% | ~50% |
| **User Auth** | Magic links (no password) | Email/password |

---

## Sync Reliability Analysis

### Supabase - High Reliability ✅
- **Trigger Level:** Database triggers are atomic
- **No Missed Events:** PostgreSQL guarantees all changes trigger
- **Ordering:** Events maintain order from DB
- **Failure Recovery:** Realtime reconnects automatically
- **Monitoring:** Can monitor via database audit logs

### PocketBase - Medium Reliability ⚠️
- **Implementation Level:** Manual broadcasts in code
- **Risk of Missing Events:** If developer forgets to call `broadcaster.broadcast()`
- **No Atomic Guarantee:** App crashes before broadcast = missed event
- **Developer Discipline:** Requires consistent implementation
- **Solution:** Use interceptors/middleware to ensure broadcasts happen

---

## Recommendation: When to Use Each

### Use **Supabase** When:
- ✅ Production system with high reliability needs
- ✅ Need automatic change detection
- ✅ Want comprehensive audit logging
- ✅ Have experienced DevOps team (cloud management)
- ✅ Need advanced analytics
- ✅ Scalability is important

### Use **PocketBase** When:
- ✅ Simple self-contained deployment
- ✅ Small team or solo development
- ✅ Want all features in one binary
- ✅ Don't want cloud infrastructure management
- ⚠️ BUT: Add comprehensive testing for broadcaster calls
- ⚠️ BUT: Document sync flow clearly for team

---

## Migration Path (If Needed)

If migrating between implementations:

```
SUPABASE → POCKETBASE                    POCKETBASE → SUPABASE
┌─────────────────────────┐             ┌─────────────────────┐
│ 1. Export PostgreSQL    │             │ 1. Export SQLite    │
│    schema + data        │             │    collections      │
├─────────────────────────┤             ├─────────────────────┤
│ 2. Map schema (mostly   │             │ 2. Map schema       │
│    compatible, minor    │             │    (compatible)     │
│    adjustments)         │             │                     │
├─────────────────────────┤             ├─────────────────────┤
│ 3. Replace auth layer   │             │ 3. Replace auth     │
│    (Magic Links →       │             │    (Email/Password  │
│    Email/Password)      │             │    → Magic Links)   │
├─────────────────────────┤             ├─────────────────────┤
│ 4. Update frontend      │             │ 4. Update frontend  │
│    auth checks          │             │    auth checks      │
├─────────────────────────┤             ├─────────────────────┤
│ 5. Migrate broadcaster  │             │ 5. Migrate to       │
│    to manual calls      │             │    Supabase         │
│                         │             │    Realtime plugin  │
├─────────────────────────┤             ├─────────────────────┤
│ 6. Remove unneeded      │             │ 6. Add features     │
│    features             │             │    (analytics,      │
│    (domains UI)         │             │    bulk import,     │
│                         │             │    audit logging)   │
├─────────────────────────┤             ├─────────────────────┤
│ 7. Test thoroughly      │             │ 7. Test thoroughly  │
│                         │             │                     │
└─────────────────────────┘             └─────────────────────┘

EFFORT: ~2-3 weeks for full migration
RISK: Medium (schema compatible, auth layer is main challenge)
DOWNTIME: Can do zero-downtime with dual-write strategy
```

