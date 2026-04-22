# Admin Service API

The Admin Service exposes a RESTful API built with Nuxt Server Routes to manage links, retrieve analytics, and synchronize state with the Redirect Engine.

All routes are prefixed with `/api`.

## Authentication

Most API endpoints (except health and public analytics collection) require authentication via Supabase session cookies.

**SSE Sync Authentication:**
The `/api/sync/stream` endpoint requires a Bearer token matching the server's `SYNC_API_KEY`.
`Authorization: Bearer <SYNC_API_KEY>`

## Endpoints

### 1. Link Management (`/api/links`)

#### Create a Link
- **POST** `/api/links`
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

### 2. Bulk Operations (`/api/bulk`)

#### Bulk Import
- **POST** `/api/bulk`
- **Content-Type:** `multipart/form-data`
- **Body:** A CSV file containing headers: `path`, `destination`, `title`, etc.
- **Response:** Summary of imported rows.

### 3. Analytics (`/api/analytics`)

#### Ingest Event (Used by Engine)
- **POST** `/api/analytics/v1/collect`
- **Body:** Analytics payload containing request details (User-Agent, IP, matched path, execution time).

#### Dashboard Overview
- **GET** `/api/analytics/dashboard`
- **Query Params:** `timeframe=24h|7d|30d`
- **Response:** Aggregated counts (total clicks, unique visitors) using PostgreSQL RPCs.

#### Detailed Link Stats
- **GET** `/api/analytics/links/[linkId]/detailed`
- **Response:** Time-series arrays and multidimensional breakdowns (browsers, devices, OS).

#### Export Data
- **GET** `/api/analytics/export/[csv|json]`
- **Response:** Raw or aggregated analytics data formatted as requested.

### 4. Utilities

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

#### Engine Synchronization Stream
- **GET** `/api/sync/stream`
- **Headers:** `Authorization: Bearer <key>`
- **Response:** Text/Event-Stream (SSE) pushing JSON representations of `RedirectRule` objects on creation, update, or deletion.
