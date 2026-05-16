## Context

The Supabase admin service uses `@nuxtjs/supabase` with magic-link authentication (`signInWithOtp`). When a new email is sent an OTP and clicks it, Supabase Auth silently creates the user — no code in the Nuxt server is executed during user creation. This means: (a) there is no interception point for quota checks, (b) there is no register page for new users to discover, and (c) there is a feature gap with the PocketBase service which has a full custom registration flow.

The fix is to introduce a server-side registration path that uses the Supabase Admin API (service role key) to create users, so all user creation flows through our Nuxt server where business logic (quotas, rate limiting, audit logging) can be applied.

## Goals / Non-Goals

**Goals:**
- Add a `POST /api/auth/register` endpoint to the Supabase admin service that creates users via Supabase Admin API
- Add a `register.vue` page with a standard email/password form
- Make the login page aware of the register page (add a link)
- Preserve the existing magic-link login flow for returning users completely unchanged
- Make the registration endpoint a clean interception point for future quota checks

**Non-Goals:**
- Replacing magic-link login with password-based login
- Email verification flow configuration (handled in Supabase dashboard, not in code)
- OAuth / social login providers
- Password reset / forgot password flow (separate concern)

## Decisions

### Decision 1: Supabase Admin API vs. Auth Hook

**Chosen:** Use `supabase.auth.admin.createUser()` from the service-role client in a Nuxt server endpoint. This creates the user with a temporary password; the user can log in via magic link thereafter.

**Alternative considered:** Supabase Auth Hook (`before_user_created` edge function deployed to Supabase). Rejected for this change because: (a) it requires deploying a separate Supabase Edge Function, (b) it cannot easily return user-friendly error messages, (c) it is harder to test locally. The hook approach can be added as a future hardening step but is not necessary to unblock quota enforcement.

**Alternative considered:** `supabase.auth.signUp()` (client-callable). Rejected because it does not go through our server — a malicious client can call it directly, bypassing all quota and rate limiting checks.

### Decision 2: Password handling after Admin API creation

The Admin API creates the user with `email_confirm: true` (bypassing email verification) and an auto-generated password. After creation, the user logs in via their usual magic link (they never set a password directly). This simplifies the UX — registration just requires email, and logging in follows the same magic-link flow.

**Alternative considered:** Full password-based auth (register with password, login with password). Rejected because it would require replacing the magic-link login page and adding password reset flows — too large a scope for this change. The existing magic-link UX works well for the beta.

### Decision 3: Session handling after registration

After a successful `POST /api/auth/register`, the server sends the user a magic link (via `supabase.auth.admin.generateLink`) and returns a `201` response. The UI shows "Check your email to complete registration." This mirrors the existing login UX and requires no special session cookie logic on the server side.

**Alternative considered:** Auto-login the user immediately after registration (like PocketBase does). This requires session cookie handling and is complex with Supabase's cookie-based auth module. Deferred — consistent with the magic-link model.

## Risks / Trade-offs

- **Service role key exposure** → The `SUPABASE_SERVICE_KEY` is already used in `realtime.ts`. The new endpoint must only use it server-side (never expose to client). This is guaranteed by Nuxt's server-only file convention for `server/api/` routes.
- **Supabase Admin API rate limits** → The Admin API has rate limits. For a beta with a daily signup cap, this is not a concern.
- **Bypassing email verification** → Using `email_confirm: true` means users are created without verifying their email. This is intentional for beta simplicity but should be revisited before public launch.
- **Magic link as the only login** → Users registered via the new endpoint cannot log in with a password (they don't have one set). If magic link delivery fails (spam filter), the user is locked out. Mitigation: clear UI messaging and an email deliverability check during deployment.

## Migration Plan

1. Add `register.vue` page (no backend dependency)
2. Add `POST /api/auth/register` endpoint — uses existing `SUPABASE_SERVICE_KEY`
3. Update `login.vue` to link to `/register`
4. Update `app.vue` to show Register link in nav when unauthenticated
5. No schema migration required — users are created in `auth.users` by Supabase Auth

Rollback: removing the register page and endpoint restores the previous state. No data migration needed.

## Open Questions

- Should the register endpoint send a magic link immediately after creating the user, or show a "Registration complete, request a login link" flow? (Sending immediately is friendlier UX)
- Should `email_confirm: true` be a config flag so operators can require email verification? (Good for post-beta; flag it as an env var `REQUIRE_EMAIL_CONFIRM=false` by default)
