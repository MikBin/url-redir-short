# Admin Service API

The Admin Service exposes a RESTful API built with Nuxt Server Routes to manage links, retrieve analytics, and synchronize state with the Redirect Engine.

All routes are prefixed with `/api`.

> **Note:** The Admin Service has two variants — **Supabase** and **PocketBase** — with an identical API surface. Authentication differs between variants (Supabase JWT vs. PocketBase cookie). See [ADR-005](../architecture/adrs/005-dual-admin-service.md) for details.

## Authentication

Most API endpoints (except health and public analytics collection) require authentication.

| Variant | Method |
|---------|--------|
| Supabase | Supabase session cookies (JWT) |
| PocketBase | PocketBase session cookie |

**SSE Sync Authentication:**
The `/api/sync/stream` endpoint requires a Bearer token matching the server's `SYNC_API_KEY`.
`Authorization: Bearer <SYNC_API_KEY>`

## Endpoints

### 1. Authentication (`/api/auth`)

> Available in both Supabase and PocketBase variants.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate user, create session |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/auth/register` | Create new user account |

### 2. Link Management (`/api/links`)

#### List Links
- **GET** `/api/links`
- **Response:** Array of link objects.

#### Create a Link
- **POST** `/api/links/create`
- **Body:**
  ```json
  {
    "path": "my-promo",
    "destination": "https://example.com/promo-2024",
    "title": "Summer Promo",
    "is_active": true
  }
  ```
- **Response (200 OK):** The created link object.

#### Update a Link
- **PATCH** `/api/links/[id]`
- **Body:** Partial link object (e.g., `{"is_active": false}`).

#### Delete a Link
- **DELETE** `/api/links/[id]`

#### Link History
- **GET** `/api/links/[id]/history`
- **Response:** Audit trail of changes to the link.

### 3. Bulk Operations (`/api/bulk`)

#### Bulk Import
- **POST** `/api/bulk`
- **Content-Type:** `multipart/form-data`
- **Body:** A JSON file containing an array of link objects.
- **Response:** Summary of imported rows.

> **Note:** CSV bulk import (CHANGE-001) is not yet implemented. Currently only JSON format is supported.

### 4. Analytics (`/api/analytics`)

#### Ingest Event (Used by Engine)
- **POST** `/api/analytics/v1/collect`
- **Body:** Analytics payload containing request details (User-Agent, IP, matched path, execution time).

#### Dashboard Overview
- **GET** `/api/analytics/dashboard`
- **Query Params:** `timeframe=24h|7d|30d`
- **Response:** Aggregated counts (total clicks, unique visitors).

#### Stats Summary
- **GET** `/api/analytics/stats`
- **Response:** High-level statistics for the requested timeframe.

#### Links Overview
- **GET** `/api/analytics/links/overview`
- **Response:** Per-link click summaries.

#### Detailed Link Stats
- **GET** `/api/analytics/links/[linkId]/detailed`
- **Response:** Time-series arrays and multidimensional breakdowns (browsers, devices, OS).

#### Export Data
- **GET** `/api/analytics/export/[csv|json]`
- **Response:** Raw or aggregated analytics data formatted as requested.

### 5. Utilities

#### Generate QR Code
- **GET** `/api/qr`
- **Query Params:** `url`, `size`, `margin`, `format`
- **Response:** Binary image data (PNG/SVG) representing the QR code.

#### System Health
- **GET** `/api/health`
- **Response:**
  ```json
  {
    "status": "ok",
    "db": "connected"
  }
  ```

#### System Metrics
- **GET** `/api/metrics`
- **Response:** System performance metrics (richer in Supabase variant).

#### Engine Synchronization Stream
- **GET** `/api/sync/stream`
- **Headers:** `Authorization: Bearer <key>`
- **Response:** Text/Event-Stream (SSE) pushing JSON representations of `RedirectRule` objects on creation, update, or deletion.