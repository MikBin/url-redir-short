## Context

Both admin services (Supabase and PocketBase) have no limit on resource consumption: users can register freely, create unlimited links, and add unlimited custom domains. During the beta phase (where the product is free), this poses a direct cost risk — database storage, row counts, and connection quotas can be exhausted by a small number of high-volume users or bots.

The quota system must be consistent across both admin service stacks. The PocketBase service has a clean server-side registration endpoint; the Supabase service does not (addressed separately in `supabase-signup-flow`). Both services already have a centralized `server/utils/config.ts` with Zod-validated env vars — this is the natural place for quota defaults.

## Goals / Non-Goals

**Goals:**
- Enforce a system-wide daily cap on new user registrations in both services
- Enforce per-user caps on total links and total custom domains
- Allow operators to override per-user limits via an admin UI without redeployment
- Show each user their current usage relative to their quota in the main dashboard
- Provide a superadmin `/admin` page in both UIs for managing user quotas

**Non-Goals:**
- Tiered pricing or billing integration — this is a beta cost control mechanism only
- Real-time quota updates pushed to the client (polling or page refresh is sufficient)
- Quota enforcement in the redirect engine itself (it does not create resources)
- PocketBase admin panel superadmin auth (PocketBase has native admin accounts; the `/admin` page is superadmin-only via a separate mechanism)

## Decisions

### Decision 1: Env-var defaults with DB-level per-user overrides

**Chosen:** Global defaults come from environment variables (`MAX_LINKS_PER_USER`, `MAX_DOMAINS_PER_USER`, `DAILY_SIGNUP_LIMIT`). Per-user overrides are stored in a `user_quotas` table (Supabase) / PocketBase collection. If no per-user row exists, the env default applies.

**Alternative considered:** All limits in DB only (no env vars). Rejected because it requires a DB migration and an initial seed step just to set defaults — env vars give operators immediate control without any DB dependency.

**Alternative considered:** Hard-coded constants. Rejected — not operator-configurable without code changes.

### Decision 2: Quota check at the API layer, not DB triggers

**Chosen:** Quota enforcement happens in the Nuxt server API handlers — before insert, count existing resources and compare against the user's effective limit. Rejection is an HTTP 429 with a descriptive message.

**Alternative considered:** Postgres triggers / PocketBase hooks that raise an exception on insert. Rejected because DB-level errors produce generic messages that are hard to map to user-friendly responses. The API-layer check gives us full control over the error message, status code, and response format.

**Trade-off:** The API-layer check has a race condition under concurrent inserts (two requests could both pass the check and both insert). For beta purposes, this is acceptable — the margin of overshoot is small and the data is not financial.

### Decision 3: Daily signup count via DB query, no dedicated counter

**Chosen:** To check the daily signup limit, query `auth.users` (Supabase) / `users` collection (PocketBase) for records created since midnight UTC today. No separate counter table.

**Alternative considered:** A dedicated `daily_signup_counter` table with an upsert. Rejected as over-engineering for beta — a simple count query on registration (which is not a hot path) is sufficient.

### Decision 4: `GET /api/quota/me` — inline in response vs. separate endpoint

**Chosen:** Dedicated `GET /api/quota/me` endpoint returning `{ links: { used, max }, domains: { used, max } }`. The dashboard QuotaBar component calls this on mount.

**Alternative considered:** Embed quota fields in the existing `GET /api/links` response. Rejected because it couples unrelated concerns and would require updating the PocketBase service to match.

### Decision 5: Superadmin identity

**Supabase:** A user is superadmin if their `auth.users` record has `app_metadata.role = 'superadmin'`. Set via Supabase Admin API. The `/api/admin/*` endpoints check this field via the service role client.

**PocketBase:** PocketBase has native admin accounts (separate from regular users). The `/admin` page is gated to logged-in PocketBase admins using the existing `pb.authStore.isAdmin` check.

## Risks / Trade-offs

- **Race condition on insert** → Acceptable for beta; document the known margin. Mitigate later with a DB-level unique constraint or a Redis-based atomic counter if needed.
- **Supabase dependency** → The registration quota check requires `supabase-signup-flow` to be implemented first. Without a server-side register endpoint, there is no gate for signup limits on the Supabase stack. Track as an explicit dependency.
- **Superadmin bootstrapping** → The first superadmin must be designated manually (setting `app_metadata.role` via Supabase dashboard or CLI). Document this in deployment README.
- **PocketBase admin auth** → PocketBase admin credentials are separate from user accounts. The `/admin` page must not leak user data to regular users even if the route is guessed. Enforce via middleware check.

## Migration Plan

1. Add new env vars with safe defaults (e.g., `MAX_LINKS_PER_USER=500`, `DAILY_SIGNUP_LIMIT=50`) to `.env.example` and both `config.ts` files
2. Run Supabase migration: add `user_quotas` and `system_config` tables with RLS
3. Run PocketBase schema: add `user_quotas` collection
4. Deploy updated API handlers (backward-compatible — existing users simply get the env default quota)
5. Deploy updated UI with QuotaBar component and `/admin` page

Rollback: removing the quota env vars restores unlimited behavior; the DB tables are additive and non-breaking.

## Open Questions

- Should the daily signup limit reset at midnight UTC or per-rolling-24h window? (UTC midnight is simpler; rolling window is more accurate but harder to query)
- Should users see a "request more quota" button that sends an email to the admin? (Deferred to post-beta)
- For PocketBase, should the `/admin` page be a separate Nuxt route or a section within the existing app? (Prefer same app, route-guarded)
