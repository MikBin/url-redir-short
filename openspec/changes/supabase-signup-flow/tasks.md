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
