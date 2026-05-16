## Why

The Supabase admin service has no user registration page or server-side signup endpoint. Authentication uses magic-link only (`supabase.auth.signInWithOtp`), which implicitly creates new accounts without any server-controlled gate. This blocks quota enforcement (planned in `usage-quotas`) and creates a feature asymmetry with the PocketBase admin service, which has a complete registration flow. A server-mediated signup path is required before any usage limits can be enforced.

## What Changes

- Add `register.vue` page to `admin-service/supabase/app/pages/` with email + password signup form, matching the UX of the PocketBase equivalent
- Add `POST /api/auth/register` endpoint to `admin-service/supabase/server/api/auth/` that calls the Supabase Admin API (`supabase.auth.admin.createUser`) using the service role key — ensuring all signups flow through our server
- The magic-link flow on `login.vue` remains unchanged for returning users
- Add a link from `login.vue` to the new register page ("Don't have an account? Sign up")
- Add navigation link from `app.vue` when the user is not authenticated (mirroring PocketBase's nav)
- New registrations created via the Admin API do not send a magic link — the user receives a confirmation email (configurable in Supabase dashboard)
- Existing users authenticated via magic link are not affected

## Capabilities

### New Capabilities

- `supabase-user-registration`: A server-side registration endpoint and corresponding UI page for the Supabase admin service. Accepts email and password, creates the user via Supabase Admin API, returns session. Enforces all future quota checks at this layer.

### Modified Capabilities

- `05-security-compliance`: The Supabase authentication surface is extended — the new register endpoint must apply the same rate limiting and security headers as all other API routes.

## Impact

- **New files**: `admin-service/supabase/app/pages/register.vue`, `admin-service/supabase/server/api/auth/register.post.ts`
- **Modified files**: `admin-service/supabase/app/pages/login.vue` (add sign-up link), `admin-service/supabase/app/app.vue` (add register nav link when unauthenticated)
- **Env dependency**: `SUPABASE_SERVICE_KEY` must be present (already required by `realtime.ts` plugin)
- **No schema changes**: User creation goes through Supabase Auth — no new tables needed
- **Enables**: `usage-quotas` change — quota checks on registration can only be implemented once this endpoint exists
- **No breaking changes** to existing magic-link login flow
