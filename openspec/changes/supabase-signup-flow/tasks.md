## 1. Server Endpoint

- [ ] 1.1 Create `admin-service/supabase/server/api/auth/register.post.ts`: validate body (`email`, `password`, `passwordConfirm`, optional `name`), check passwords match, call `supabase.auth.admin.createUser({ email, password, email_confirm: true })` using service-role client, generate magic link via `supabase.auth.admin.generateLink({ type: 'magiclink', email })` and send, return HTTP 201
- [ ] 1.2 Handle error cases in the register endpoint: duplicate email → 409, validation failure → 400, Supabase API error → 500 with sanitized message
- [ ] 1.3 Write unit/integration tests for `register.post.ts`: successful registration, duplicate email, passwords mismatch, missing fields, unauthenticated request proceeds normally

## 2. UI: Registration Page

- [ ] 2.1 Create `admin-service/supabase/app/pages/register.vue`: form with email, password, confirm-password, optional name fields; submit calls `POST /api/auth/register`; on success show confirmation message; on error show inline error from server response
- [ ] 2.2 Add redirect guard in `register.vue`: if user is already authenticated (`useSupabaseUser()` returns a value), redirect to `/`

## 3. UI: Navigation Updates

- [ ] 3.1 Update `admin-service/supabase/app/pages/login.vue`: add "Don't have an account? Sign up" link below the form that navigates to `/register`
- [ ] 3.2 Update `admin-service/supabase/app/app.vue`: add "Register" nav link visible only when `user.value` is null (unauthenticated state), linking to `/register`

## 4. Tests & Verification

- [ ] 4.1 Verify existing magic-link login flow (`/login` + `supabase.auth.signInWithOtp`) is completely unchanged and all existing login tests still pass
- [ ] 4.2 Verify security middleware (rate limiting, security headers) is applied to the new `/api/auth/register` endpoint
- [ ] 4.3 Add `SUPABASE_SERVICE_KEY` to test setup env in `vitest.config.ts` if not already present (it is needed by the register endpoint)
- [ ] 4.4 Document in `admin-service/supabase/README.md` that magic-link is still used for login; the register endpoint creates the user and sends a login link

## Review Log

**Date:** 2026-09-29 · **Reviewer:** nw-software-crafter-reviewer (Kilo)
**Verdict:** NOT STARTED — backlog status is truthful. No `server/api/auth/register.post.ts` in the Supabase service, no `register.vue`, no signup link in `login.vue`.

**Findings (priority order):**

- `issue (blocking, security):` Task 1.1 creates an unauthenticated registration endpoint using the service-role client. It must be wired behind the existing rate-limit middleware from day one (4.2 acknowledges this — make it a Task 1 acceptance criterion, not a later verification), and `email_confirm: true` + immediate magic-link send must be reviewed against the security spec's signup requirements. `usage-quotas` Task 3.2 later adds `DAILY_SIGNUP_LIMIT` enforcement — without rate limiting + signup quotas, this endpoint is an account-creation firehose.
- `suggestion (non-blocking):` 1.3's "unauthenticated request proceeds normally" test phrasing is ambiguous — clarify it means the endpoint is public by design and that auth'd users hitting it still get processed (or are rejected with 400).
- `nitpick (non-blocking):` 4.3 patches `vitest.config.ts` env for `SUPABASE_SERVICE_KEY` — ensure the test value is a dummy and never a real key; `.env.example` should document it as test-only.
- `praise:` Task 4.1's explicit "existing magic-link flow completely unchanged" regression gate is exactly the right guardrail for additive auth changes.
