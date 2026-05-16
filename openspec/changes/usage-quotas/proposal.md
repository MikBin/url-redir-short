## Why

During the beta release, both admin services are publicly accessible with no limits on resource consumption. Without guardrails, a small number of users could exhaust database capacity (storage, rows, connections) and drive up hosting costs. We need configurable per-account and system-wide quotas to operate a safe, cost-controlled beta before moving to a paid tier model.

## What Changes

- Add a `user_quotas` table (Supabase) / PocketBase collection to store per-user quota overrides; global defaults come from environment variables
- Add a `system_config` table (Supabase) / collection for runtime-editable system-wide settings (e.g., daily signup limit)
- Enforce quota checks in `POST /api/auth/register` (PocketBase) and equivalent Supabase signup path before user creation
- Enforce quota checks in `POST /api/links` before insert: reject with HTTP 429 when per-user link cap is reached
- Enforce quota checks in `POST /api/domains` before insert: reject with HTTP 429 when per-user domain cap is reached
- Add `GET /api/quota/me` endpoint returning current user's usage and limits (both services)
- Add admin-only `GET /api/admin/users` and `PATCH /api/admin/users/:id/quota` endpoints for managing per-user overrides
- Add a new `/admin` page in both admin UIs: user list with usage stats and inline quota editing
- Add a quota usage indicator (progress bar) to the dashboard/links index page for the authenticated user
- Both admin services must expose identical quota features and API surface

## Capabilities

### New Capabilities

- `usage-quotas`: Quota enforcement engine — global defaults via env vars, per-user overrides in DB, enforced at API layer on registration, link creation, and domain creation. Returns `HTTP 429` with a descriptive message on limit breach.
- `quota-admin-ui`: Superadmin management panel (`/admin` page) listing all users with current usage (links count, domains count) and controls to override individual user limits. Available in both PocketBase and Supabase admin services.
- `quota-user-indicator`: Per-user quota usage indicator displayed in the main dashboard showing consumed vs. allowed links and domains. Driven by `GET /api/quota/me`.

### Modified Capabilities

- `03-link-management`: Link creation now has a per-user maximum enforced server-side before insert.
- `05-security-compliance`: Registration now has a system-wide daily cap enforced server-side before user creation.

## Impact

- **Schema changes**: New tables in Supabase (`user_quotas`, `system_config`) with RLS policies; new PocketBase collections
- **New API endpoints**: `/api/quota/me`, `/api/admin/users`, `/api/admin/users/:id/quota` (both services)
- **Modified endpoints**: `POST /api/links`, `POST /api/domains`, registration flow (both services)
- **New env vars**: `MAX_LINKS_PER_USER`, `MAX_DOMAINS_PER_USER`, `DAILY_SIGNUP_LIMIT` (with sane defaults)
- **New UI pages/components**: `/admin` page, `QuotaBar` component (both services)
- **Config files**: Both `server/utils/config.ts` files updated with new quota env vars
- **Dependency**: `supabase-signup-flow` change — Supabase must have a server-side registration endpoint before quota enforcement can be wired in on that stack
