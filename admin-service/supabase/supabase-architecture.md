# Admin Service Architecture (Supabase Implementation)

## 1. Introduction
This document details the architecture of the **Admin Service** when configured with **Supabase** as the backing infrastructure. While the core domain logic remains agnostic, this implementation specifies how the application integrates with Supabase for Authentication, Persistence, and Real-time events.

The service uses **NestJS** and follows **Hexagonal Architecture (Ports & Adapters)**.

## 2. Architectural Overview
In this configuration, Supabase provides the **PostgreSQL** database and **Authentication** services. The Admin Service acts as the authoritative gateway that manages these resources and synchronizes state to the edge.

### Key Decisions
*   **Auth Offloading:** User management and token generation are handled by Supabase Auth (GoTrue). The Admin Service verifies tokens.
*   **Reactive State:** The Admin Service subscribes to Supabase Realtime (Postgres Changes) to detect data mutations, ensuring that changes made directly in the Supabase Dashboard are still propagated to the Edge Nodes.
*   **One-Way Sync:** The Admin Service maintains the standard SSE (Server-Sent Events) channel to push updates to Redirector Engines.

## 3. System Components (C4 Component)

```mermaid
graph TD
    User[Admin User] -->|Login/Manage| UI[Nuxt Web Dashboard]
    UI -->|Auth Request| SupabaseAuth[Supabase Auth]
    UI -->|API Request (Bearer Token)| API

    subgraph "Admin Service (NestJS)"
        Core[Core Domain Logic]
        API[REST Controllers]
        SubaAdapter[Supabase Adapter]
        SSE[SSE Emitter]
    end

    API --> Core
    Core --> SubaAdapter
    Core --> SSE

    SubaAdapter -->|REST/Websocket| SupabaseDB[(Supabase Postgres)]

    SupabaseDB -.->|Realtime Event| SubaAdapter

    SSE -->|One-Way Sync| Edge1[Redirector Engine 1]
    SSE -->|One-Way Sync| EdgeN[Redirector Engine N]
```

## 4. Hexagonal Implementation Details

### 4.1. Domain Layer (The Core)
*Unchanged from the generic architecture.*
*   **Entities:** `Link`, `User`, `Domain`.
*   **Ports:** `RepositoryPort`, `AuthProviderPort`, `SyncEmitterPort`.

### 4.2. Adapters Layer (Supabase Specifics)

#### A. Persistence Adapter (`SupabaseRepository`)
Implements `RepositoryPort`.
*   **Technology:** `@supabase/supabase-js`.
*   **Responsibility:** Maps Domain Entities to Supabase Table rows.
*   **Tables:**
    *   `public.links`: Stores redirection rules.
    *   `public.domains`: Stores custom domain configs.
    *   `auth.users`: Managed internally by Supabase, referenced by ID.

#### B. Auth Adapter (`SupabaseAuthProvider`)
Implements `AuthProviderPort`.
*   **Strategy:**
    1.  Extracts the `Authorization: Bearer <token>` header.
    2.  Uses `supabase.auth.getUser(token)` to validate the JWT signature and expiration against the Supabase project.
    3.  Returns a standardized `User` entity to the Core if valid.

#### C. Synchronization Adapter
Implements `SyncEmitterPort`.
*   **Technology:** NestJS `Observable` / `Sse`.
*   **Flow:**
    1.  Maintains a list of active connections from Redirector Engines.
    2.  Pushes JSON payloads matching the internal event format.

### 4.3. The "Reactive Loop" (Supabase Realtime)
To robustly support the "Source of Truth" requirement, the Supabase Adapter also acts as an *Event Source* for the application itself.

1.  **Subscription:** On startup, the `SupabaseAdapter` subscribes to `INSERT`, `UPDATE`, `DELETE` events on the `links` table via Supabase Realtime.
2.  **Detection:** If a row is modified (via API *or* Supabase Dashboard), Supabase sends a socket message to the Adapter.
3.  **Broadcast:** The Adapter triggers the `SyncEmitterPort` to broadcast this change to all Engines.
    *   *Benefit:* Guarantees consistency even if the API is bypassed.

## 5. Data Flows

### 5.1. Creating a Link
1.  **Client** sends `POST /links` with a Bearer Token.
2.  **AuthGuard** uses `SupabaseAuthProvider` to verify the token.
3.  **Controller** calls `LinkService.create()`.
4.  **Service** applies business rules (e.g., validation, collision checks).
5.  **Service** calls `RepositoryPort.save()`.
6.  **SupabaseRepository** performs the `INSERT` into Postgres.
7.  **Supabase Realtime** detects the insert and notifies the **SupabaseRepository**.
8.  **SupabaseRepository** passes the event to the **SyncManager**.
9.  **SyncManager** pushes the event via **SSE** to all connected Engines.

### 5.2. Querying Analytics
*   **Admin Service** is NOT involved.
*   **Dashboard** queries the Analytics Service directly, filtering by the IDs stored in Supabase.

## 6. Configuration Requirements
To enable this architecture, the following Environment Variables are required:

```env
# Server Config
PORT=3000

# Database / Auth Provider
DB_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...  # Required for Admin administrative actions
SUPABASE_ANON_KEY=ey...          # Used for client-side context if needed
```

## 7. Security Considerations
*   **Service Role Key:** The Admin Service requires the `SERVICE_ROLE_KEY` to bypass Row Level Security (RLS) when performing administrative tasks or bulk operations.
*   **RLS Policies:** Should still be configured on the Postgres level to protect data from accidental public exposure, even if the Admin Service bypasses them.
*   **SSE Security:** The SSE endpoint (`/sync/stream`) should be protected by an API Key or internal token mechanism to prevent unauthorized clients from listening to the stream.

## 8. Frontend Architecture (Nuxt)
When using Supabase, the **Admin Dashboard** is built with **Nuxt** to leverage deeper integration with the ecosystem.

*   **Role:** Provides a server-side rendered (SSR) or statically generated (SSG) interface.
*   **Integration:**
    *   **Supabase Module:** Uses `@nuxtjs/supabase` for seamless authentication and client management.
    *   **Auth:** Direct integration with Supabase Auth for login/signup flows. The session token is then forwarded to the Admin Service for API requests.
    *   **Data Fetching:**
        *   **Via Admin Service:** All write operations (Create/Update/Delete) go through the Admin Service API to ensure validation and event triggering.
        *   **Read Operations:** May query Supabase directly for read-heavy views (e.g. lists) if strict consistency is not required, or continue to use the Admin Service API for a unified data layer.
    *   **Analytics:** Queries the Analytics Service directly.
