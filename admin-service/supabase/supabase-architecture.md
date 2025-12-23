# Admin Service Architecture (Supabase + Nuxt Standalone)

## 1. Introduction
This document details the architecture of the **Admin Service** when configured with the **Supabase** stack. In this configuration, the traditional NestJS backend is completely replaced by a **Nuxt 3** application (leveraging Nitro for server-side logic).

This implementation provides a streamlined, "Supabase-native" approach where the frontend interacts directly with the database, and the server-side layer focuses strictly on synchronization with Redirector Engines.

## 2. Architectural Overview
The system relies on **Supabase** as the heavy lifter for Authentication, Persistence, and Realtime events. The **Nuxt** application serves two distinct roles:
1.  **Frontend (Client):** A web dashboard for managing links and domains, writing directly to Supabase.
2.  **Backend (Nitro):** A lightweight server process that bridges Supabase Realtime events to the Redirector Engines via Server-Sent Events (SSE).

### Key Decisions
*   **No Middleware API for Writes:** The Nuxt Client writes directly to Supabase tables. Data integrity and security are enforced via **Postgres Row Level Security (RLS)** policies, not application code.
*   **Auth Offloading:** Authentication is handled entirely by Supabase Auth (GoTrue).
*   **Nitro as Sync Hub:** The Nuxt server-side engine (Nitro) maintains the persistent SSE connections with Edge Nodes, ensuring they receive updates even if the changes originated from the Supabase Dashboard directly.

## 3. System Components (C4 Component)

```mermaid
graph TD
    User[Admin User] -->|Manage| UI[Nuxt Web Client]
    UI -->|Direct Write (HTTPS)| SupabaseDB[(Supabase Postgres)]
    UI -->|Auth| SupabaseAuth[Supabase Auth]

    subgraph "Nuxt Application"
        UI
        Nitro[Nitro Server Engine]
    end

    subgraph "External Infrastructure"
        SupabaseDB
        SupabaseAuth
    end

    SupabaseDB -.->|Realtime Event (Socket)| Nitro
    Nitro -->|SSE (One-Way Sync)| Edge1[Redirector Engine 1]
    Nitro -->|SSE (One-Way Sync)| EdgeN[Redirector Engine N]
```

## 4. Implementation Details

### 4.1. Nuxt Client (The Dashboard)
*   **Responsibility:** UI rendering, User Authentication, Data Management.
*   **Technology:** Vue.js 3, Nuxt 3, `@nuxtjs/supabase`.
*   **Data Access:**
    *   Uses the Supabase JS Client to perform `SELECT`, `INSERT`, `UPDATE`, `DELETE` operations directly against the database.
    *   **Security:** Relies on the user's JWT (handled automatically by the Supabase module) to authorize actions against Postgres RLS policies.

### 4.2. Nuxt Server (Nitro)
*   **Responsibility:** Synchronization Hub (Source of Truth to Edge).
*   **Endpoints:**
    *   `GET /api/sync/stream`: The SSE endpoint that Redirector Engines connect to.
*   **The Sync Loop:**
    1.  **Startup:** On server initialization, Nitro creates a service-role Supabase client.
    2.  **Subscription:** It subscribes to the `public` schema (specifically `links` and `domains` tables) via Supabase Realtime.
    3.  **Broadcast:** When a Realtime event is received (e.g., a new link is created), Nitro transforms the payload into the standard Sync Event format and pushes it to all active SSE connections.

### 4.3. Database (Supabase)
*   **Schema:**
    *   `public.links`: Stores redirection rules.
    *   `public.domains`: Stores custom domain configurations.
*   **Security (RLS):**
    *   **ENABLE RLS** on all tables.
    *   **Policies:** Define strict rules (e.g., "Users can only update links where `owner_id` matches their `auth.uid()`").
    *   This ensures that even though the client writes directly, they cannot modify unauthorized data.

## 5. Data Flows

### 5.1. Creating a Link
1.  **User** fills out the form in the Nuxt Dashboard.
2.  **Nuxt Client** calls `supabase.from('links').insert({ ... })`.
3.  **Supabase** checks the RLS Policy. If valid, the row is inserted.
4.  **Supabase Realtime** emits an `INSERT` event to subscribers.
5.  **Nitro Server** (subscribed via service-role) receives the event.
6.  **Nitro Server** pushes the event via **SSE** to all connected **Redirector Engines**.

### 5.2. Querying Analytics
*   **Nuxt Client** queries the **Analytics Service** API directly.
*   The Admin Service (Nuxt) does not proxy analytics traffic.

## 6. Configuration Requirements
To enable this architecture, the Nuxt application requires the following environment variables:

```env
# Server Config
PORT=3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=ey...              # Anon Key (publicly safe)
SUPABASE_SERVICE_KEY=ey...      # Service Role Key (Server-side only, for Realtime subscription)
```

## 7. Security Considerations
*   **Service Role Safety:** The `SUPABASE_SERVICE_KEY` must **never** be exposed to the client bundle. It is used strictly within the Nitro server context to bypass RLS when listening for global changes.
*   **RLS is Critical:** Since there is no backend validation layer for writes, RLS policies are the *only* line of defense. They must be rigorously tested.
*   **SSE Protection:** The `/api/sync/stream` endpoint should be protected (e.g., via a shared secret or API key) to ensure only valid Redirector Engines can subscribe to updates.
