# PocketBase Admin Service - Task Specification

This document outlines all tasks required to create a Nuxt + PocketBase admin service that is API-compatible with the existing `redir-engine` SSE sync protocol.

---

## Project Overview

**Goal**: Replace `admin-service/supabase` with `admin-service/pocketbase` using Nuxt 4 + PocketBase SDK, maintaining 100% API compatibility with the existing engine sync protocol.

**Key Compatibility Requirements**:
- SSE endpoint at `/api/sync/stream` must emit events in the exact same format
- Analytics collection endpoint must accept the same payload schema
- All SSE event types (`create`, `update`, `delete`) must match the existing transformer output

---

## Task Dependencies Graph

```
T1: Project Setup (prereq: none)
├── T2: PocketBase Schema Setup (prereq: T1)
│   ├── T3: Create PocketBase Collections (prereq: T2)
│   │   ├── T4: Implement SSE Sync Endpoint (prereq: T3)
│   │   │   └── T8: Integration Testing (prereq: T4, T7)
│   │   └── T5: Implement Analytics Collection Endpoint (prereq: T3)
│   │       └── T8: Integration Testing (prereq: T4, T7)
│   ├── T6: Implement Links CRUD API (prereq: T3)
│   │   ├── T7: Implement Auth/Sessions (prereq: T6)
│   └── T9: Implement QR & Metrics APIs (prereq: T3)
└── T10: Update Package Scripts (prereq: T1)
    └── T11: Update Root Dev Script (prereq: T10)
```

---

## Task T1: Project Setup

**File**: `admin-service/pocketbase/TASKS.md` (this file)

**Description**: Initialize Nuxt 4 project with PocketBase SDK

**Commands**:
```bash
cd admin-service
npx nuxi@latest init pocketbase --force --packageManager npm
cd pocketbase
npm install @nuxtjs/tailwindcss
npm install pocketbase
npm install -D @types/node
```

**Deliverables**:
- `package.json` with Nuxt 4, @nuxtjs/tailwindcss, pocketbase
- `nuxt.config.ts` with TailwindCSS module
- `.nuxtrc` with compatibility date
- `tsconfig.json`

**Acceptance Criteria**:
- `npm run dev` starts Nuxt dev server without errors
- TailwindCSS is properly configured

---

## Task T2: PocketBase Schema Setup

**File**: `admin-service/pocketbase/pb_schema.json`

**Description**: Create PocketBase schema that mirrors the Supabase `schema.sql`

**Deliverables**: JSON schema file with collections:
- `domains` (mirrors Supabase domains table)
- `links` (mirrors Supabase links table)
- `analytics_events` (mirrors Supabase analytics_events table)
- `analytics_aggregates` (mirrors Supabase analytics_aggregates table)
- `sessions` (mirrors Supabase sessions table)

**Field Mapping** (Supabase → PocketBase):
| Supabase | PocketBase |
|----------|------------|
| `uuid default gen_random_uuid()` | `id` (auto-generated) |
| `timestamptz default now()` | `created`, `updated` (auto) |
| `references auth.users` | Relation to `_pb_users_` or separate users collection |
| `jsonb` | `json` |
| `unique(slug, domain_id)` | Rule + unique index |

**Acceptance Criteria**:
- All Supabase table structures are represented
- All indexes are defined
- JSONB fields use PocketBase `json` type
- Users authentication uses PocketBase built-in auth

---

## Task T3: Create PocketBase Collections

**File**: `admin-service/pocketbase/pb_init.js`

**Description**: Script to initialize PocketBase collections programmatically

**Deliverables**:
- `pb_init.js` - Node script using PocketBase JS SDK to create collections
- Alternative: Provide manual setup instructions in `POCKETBASE_SETUP.md`

**Implementation**:
```javascript
import PocketBase from 'pocketbase'

const pb = new PocketBase('http://127.0.0.1:8090')

// Admin authentication
await pb.admins.authWithPassword('admin@example.com', 'password')

// Create collections programmatically
// See pb_schema.json for structure
```

**Acceptance Criteria**:
- Collections can be created via script
- OR manual instructions are clear and complete

---

## Task T4: Implement SSE Sync Endpoint

**File**: `admin-service/pocketbase/server/api/sync/stream.get.ts`

**Description**: Implement Server-Sent Events endpoint that broadcasts link changes

**SSE Protocol Specification** (MUST match existing engine):

### Endpoint: `GET /api/sync/stream`

**Headers**:
- `Authorization: Bearer {SYNC_API_KEY}`
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

**Event Format** (MUST match existing):
```typescript
// Initial connection
event: (none)
data: {"type":"connected","timestamp":1234567890}

// Create event
event: create
data: {"id":"uuid","path":"/slug","destination":"https://...","code":301,...}

// Update event
event: update
data: {"id":"uuid","path":"/slug","destination":"https://...","code":301,...}

// Delete event
event: delete
data: {"id":"uuid","path":"/slug",...}
```

**RedirectRule Interface** (from `transformer.ts`):
```typescript
interface RedirectRule {
  id: string;
  path: string;        // Must start with '/'
  destination: string;
  code: 301 | 302;
  
  targeting?: {
    enabled: boolean;
    rules: Array<{
      id: string;
      target: 'language' | 'device' | 'country';
      value: string;   // lowercase
      destination: string;
    }>;
  };
  
  ab_testing?: {
    enabled: boolean;
    variations: Array<{
      id: string;
      destination: string;
      weight: number;
    }>;
  };
  
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  
  password_protection?: {
    enabled: boolean;
    password: string;
  };
  
  expiresAt?: number;   // Unix timestamp (ms)
  maxClicks?: number;
}
```

**Implementation Requirements**:
1. Authenticate via `SYNC_API_KEY` environment variable
2. Subscribe to PocketBase realtime for `links` collection
3. Transform PocketBase records to `RedirectRule` format using same logic as `transformer.ts`
4. Ensure `path` always starts with `/`
5. Ensure targeting values are lowercase
6. Convert `expires_at` ISO string to Unix timestamp in `expiresAt`
7. Broadcast via SSE to all connected clients

**Dependencies**:
- PocketBase realtime subscription
- Auth middleware
- Event transformer (reuse/adapt from `transformer.ts`)

**Acceptance Criteria**:
- SSE events match existing format exactly
- Engine receives and processes events correctly
- Authorization works with existing `SYNC_API_KEY`

---

## Task T5: Implement Analytics Collection Endpoint

**File**: `admin-service/pocketbase/server/api/analytics/v1/collect.post.ts`

**Description**: Implement analytics collection endpoint that matches existing API

### Endpoint: `POST /api/analytics/v1/collect`

**Payload Schema** (MUST match existing - from `collect.post.ts`):
```typescript
{
  path: string;           // required, max 2048 chars
  destination: string;     // required, valid URL, max 2048 chars
  timestamp?: string;      // ISO datetime, optional
  ip?: string;            // valid IP, optional
  user_agent?: string;    // max 500 chars, nullable
  referrer?: string;       // valid URL, nullable
  referrer_source?: 'explicit' | 'implicit' | 'none';
  status: number;          // 100-599
  session_id?: string;    // UUID
  country?: string;       // 2-char ISO code
  city?: string;          // max 100 chars
  device_type?: 'desktop' | 'mobile' | 'tablet' | 'bot';
  browser?: string;       // max 50 chars
  os?: string;            // max 50 chars
}
```

**Response** (MUST match existing):
```typescript
{
  success: true,
  queued: true,
  timestamp: string  // ISO datetime
}
```

**Implementation Requirements**:
1. Validate payload using Zod schema
2. Hash IP addresses using same algorithm (SHA256 with salt)
3. Sanitize inputs same as existing (remove `<>`, keep URL-safe chars)
4. Store in `analytics_events` collection
5. Update `analytics_aggregates` (atomic increment)
6. Background processing using `event.waitUntil()`
7. Rate limiting (100 requests/minute per IP)
8. Return same response format

**Dependencies**:
- PocketBase SDK for database operations
- Rate limiting middleware
- Zod validation

**Acceptance Criteria**:
- Response format matches exactly
- Data is stored correctly in PocketBase
- Aggregates are updated correctly

---

## Task T6: Implement Links CRUD API

**Files**: 
- `server/api/links/create.post.ts`
- `server/api/links/[id].patch.ts`
- `server/api/links/[id].delete.ts`
- `server/api/links/index.get.ts`

**Description**: Implement CRUD endpoints for links management

### POST /api/links/create

**Request Body** (from `create.post.ts`):
```typescript
{
  slug: string;           // /^[a-zA-Z0-9-_]+$/
  destination: string;     // valid URL
  expires_at?: string;     // ISO datetime
  max_clicks?: number;
  password_protection?: {
    enabled: boolean;
    password?: string;
  };
  hsts?: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  targeting?: {
    enabled: boolean;
    rules: any[];
  };
  ab_testing?: {
    enabled: boolean;
    variations: any[];
  };
}
```

**Requirements**:
- Authenticate user via PocketBase auth
- Validate with Zod schema
- Insert into `links` collection
- Trigger SSE broadcast for `create` event
- Audit logging

### PATCH /api/links/[id]

**Requirements**:
- Authenticate user
- Update link record
- Trigger SSE broadcast for `update` event

### DELETE /api/links/[id]

**Requirements**:
- Authenticate user
- Delete link record
- Trigger SSE broadcast for `delete` event

### GET /api/links

**Requirements**:
- Authenticate user
- Return list of user's links

**Acceptance Criteria**:
- CRUD operations work correctly
- SSE events are broadcast on every change
- Auth is enforced

---

## Task T7: Implement Auth/Sessions

**Files**:
- `server/api/auth/login.post.ts`
- `server/api/auth/logout.post.ts`
- `server/api/sessions/[id].get.ts`
- `server/middleware/auth.ts`

**Description**: Implement authentication using PocketBase auth

**Requirements**:
1. Use PocketBase built-in `users` collection
2. Session management via PocketBase auth
3. Middleware to protect routes
4. Audit logging for auth events

**Session Schema** (PocketBase `sessions` collection):
```typescript
{
  session_id: string;
  user_id: string;
  device_fingerprint?: string;
  expires_at: string;
  last_activity_at: string;
}
```

**Acceptance Criteria**:
- Users can register/login/logout
- Protected routes require auth
- Sessions are tracked

---

## Task T8: Integration Testing

**Files**:
- `tests/integration/sync-stream.test.ts`
- `tests/integration/analytics-collect.test.ts`
- `tests/e2e/engine-compatibility.test.ts`

**Description**: Verify API compatibility with existing engine

**Test Cases**:

### SSE Sync Test
1. Create link via API
2. Verify SSE event is broadcast with correct format
3. Update link via API
4. Verify SSE event format matches `transformer.ts` output
5. Delete link via API
6. Verify SSE event format

### Engine Compatibility Test
1. Start PocketBase admin service
2. Start engine with `ADMIN_SERVICE_URL` pointing to PocketBase
3. Create link in PocketBase
4. Verify engine receives and processes SSE event
5. Test redirect works
6. Test all advanced features (targeting, A/B, etc.)

### Analytics Test
1. Send analytics event to `/api/analytics/v1/collect`
2. Verify response format matches
3. Verify data is stored correctly
4. Verify aggregates are updated

**Dependencies**:
- Task T4 (SSE endpoint)
- Task T5 (Analytics endpoint)
- Task T7 (Auth)

**Acceptance Criteria**:
- All tests pass
- Engine works with PocketBase admin without changes

---

## Task T9: Implement QR & Metrics APIs

**Files**:
- `server/api/qr.get.ts`
- `server/api/metrics.get.ts`

**Description**: Implement auxiliary endpoints

### GET /api/qr

**Query Parameters**:
- `url`: URL to encode
- `size`: Optional size (default 300)
- `format`: `png` | `svg`

**Implementation**: Use `qrcode` npm package

### GET /api/metrics

**Description**: Return service metrics

**Response**:
```typescript
{
  uptime: number;
  memoryUsage: object;
  requestCount: number;
}
```

**Acceptance Criteria**:
- Endpoints work correctly
- Return expected response formats

---

## Task T10: Update Package Scripts

**File**: `admin-service/pocketbase/package.json`

**Description**: Add standard npm scripts

**Deliverables**:
```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "test": "vitest",
    "pb:start": "pocketbase serve",
    "pb:init": "node pb_init.js"
  }
}
```

**Acceptance Criteria**:
- Scripts are standard and match project conventions

---

## Task T11: Update Root Dev Script

**File**: `package.json`

**Description**: Update root `package.json` to support PocketBase admin

**Changes**:
```json
{
  "scripts": {
    "dev:admin": "cd admin-service/pocketbase && npm run dev",
    "dev:admin:supabase": "cd admin-service/supabase && npm run dev"
  }
}
```

**Acceptance Criteria**:
- `npm run dev` starts PocketBase admin by default
- `npm run dev:admin:supabase` still works for Supabase version

---

## Implementation Order Summary

| Order | Task | Description | Est. Time |
|-------|------|-------------|-----------|
| 1 | T1 | Project Setup | 10 min |
| 2 | T2 | PocketBase Schema | 30 min |
| 3 | T3 | Create Collections | 20 min |
| 4 | T6 | Links CRUD | 45 min |
| 5 | T7 | Auth/Sessions | 30 min |
| 6 | T4 | SSE Sync | 60 min |
| 7 | T5 | Analytics | 45 min |
| 8 | T9 | QR/Metrics | 20 min |
| 9 | T10 | Package Scripts | 5 min |
| 10 | T11 | Root Scripts | 5 min |
| 11 | T8 | Integration Testing | 60 min |

---

## Environment Variables

Required in `.env`:
```
# PocketBase
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=password

# Sync (must match engine)
SYNC_API_KEY=local-dev-sync-key

# Rate Limiting
IP_HASH_SALT=change-this-in-production
RATE_LIMIT_SALT=change-this-in-production

# Logging
LOG_LEVEL=info
SERVICE_NAME=admin-service-pocketbase
```

---

## File Structure

```
admin-service/pocketbase/
├── .env.example
├── .gitignore
├── .nuxtrc
├── nuxt.config.ts
├── package.json
├── pb_init.js
├── pb_schema.json
├── POCKETBASE_SETUP.md
├── tsconfig.json
├── vitest.config.ts
├── app/
│   └── app.vue
├── server/
│   ├── api/
│   │   ├── analytics/
│   │   │   └── v1/
│   │   │       └── collect.post.ts
│   │   ├── auth/
│   │   │   ├── login.post.ts
│   │   │   └── logout.post.ts
│   │   ├── links/
│   │   │   ├── [id].delete.ts
│   │   │   ├── [id].patch.ts
│   │   │   ├── create.post.ts
│   │   │   └── index.get.ts
│   │   ├── metrics.get.ts
│   │   ├── qr.get.ts
│   │   └── sync/
│   │       └── stream.get.ts
│   ├── middleware/
│   │   └── auth.ts
│   └── utils/
│       ├── broadcaster.ts
│       ├── config.ts
│       ├── logger.ts
│       ├── rate-limit.ts
│       ├── storage.ts
│       └── transformer.ts
└── tests/
    ├── integration/
    │   ├── analytics-collect.test.ts
    │   └── sync-stream.test.ts
    └── unit/
        └── transformer.test.ts
```

---

## Notes for Jules Agent

1. **Priority**: SSE sync (T4) and Analytics (T5) are the most critical for engine compatibility
2. **Testing**: Use existing E2E tests in `redir-engine/e2e-suite` to verify compatibility
3. **Reuse**: Copy `transformer.ts` logic directly - it must produce identical output
4. **PocketBase Realtime**: Use PocketBase SSE client to subscribe to changes
5. **Auth**: Use PocketBase built-in auth, don't recreate user management
6. **SSE Format**: The format is defined by existing `stream.get.ts` and `broadcaster.ts`

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npm run dev` starts both Nuxt and PocketBase
- [ ] Engine connects to `/api/sync/stream` and receives events
- [ ] Event format matches exactly (test with `redir-engine/e2e-suite`)
- [ ] Analytics collection works
- [ ] All CRUD operations work
- [ ] Auth is enforced on protected routes
- [ ] QR code generation works
- [ ] Metrics endpoint works
