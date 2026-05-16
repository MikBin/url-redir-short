## 1. Config & Schema

- [ ] 1.1 Add `MAX_LINKS_PER_USER`, `MAX_DOMAINS_PER_USER`, `DAILY_SIGNUP_LIMIT` env vars to `.env.example` with documented defaults
- [ ] 1.2 Update `admin-service/supabase/server/utils/config.ts` Zod schema to include the three new quota env vars with defaults
- [ ] 1.3 Update `admin-service/pocketbase/server/utils/config.ts` Zod schema to include the three new quota env vars with defaults
- [ ] 1.4 Write and apply Supabase migration: create `user_quotas` table (`user_id`, `max_links nullable`, `max_domains nullable`) with RLS policies (superadmin full access, users read-only own row)
- [ ] 1.5 Write and apply Supabase migration: create `system_config` table (`key text PK`, `value jsonb`) for future runtime config (seed with quota defaults if desired)
- [ ] 1.6 Add `user_quotas` collection to PocketBase schema (`pb_schema.json`) with equivalent fields

## 2. Quota Enforcement Utilities (shared)

- [ ] 2.1 Create `admin-service/supabase/server/utils/quota.ts` — pure function `getUserEffectiveQuota(userId, client)` that reads `user_quotas` override row (or returns env defaults if no row), and `checkDailySignups(client)` that counts `auth.users` created since midnight UTC
- [ ] 2.2 Create equivalent `admin-service/pocketbase/server/utils/quota.ts` with the same interface, using PocketBase collection queries
- [ ] 2.3 Write unit tests for `quota.ts` in both services (pure function — mock DB client, cover: no override row, partial override, full override, daily limit not reached, daily limit reached)

## 3. Registration Quota Enforcement

- [ ] 3.1 Update `admin-service/pocketbase/server/api/auth/register.post.ts`: call `checkDailySignups()` before `pb.collection('users').create()`, throw 429 if limit reached
- [ ] 3.2 Update `admin-service/supabase/server/api/auth/register.post.ts` (created by `supabase-signup-flow`): call `checkDailySignups()` before user creation, throw 429 if limit reached
- [ ] 3.3 Write tests: registration blocked at limit (PocketBase), registration succeeds below limit (PocketBase), same for Supabase

## 4. Link & Domain Creation Quota Enforcement

- [ ] 4.1 Update `admin-service/supabase/server/api/links/create.post.ts`: call `getUserEffectiveQuota()` and count user's existing links before insert, throw 429 if at limit
- [ ] 4.2 Update `admin-service/pocketbase/server/api/links/create.post.ts` (or equivalent): same quota check
- [ ] 4.3 Update Supabase domain creation endpoint: add quota check for `max_domains`
- [ ] 4.4 Update PocketBase domain creation endpoint: add quota check for `max_domains`
- [ ] 4.5 Write tests: link creation blocked at quota, link creation succeeds below quota (both services)
- [ ] 4.6 Write tests: domain creation blocked at quota, domain creation succeeds below quota (both services)

## 5. Quota Status API

- [ ] 5.1 Create `admin-service/supabase/server/api/quota/me.get.ts`: authenticated endpoint returning `{ links: { used, max }, domains: { used, max } }` using `getUserEffectiveQuota()` and count queries
- [ ] 5.2 Create `admin-service/pocketbase/server/api/quota/me.get.ts`: equivalent endpoint
- [ ] 5.3 Write tests for `GET /api/quota/me`: authenticated returns correct data, unauthenticated returns 401 (both services)

## 6. Admin API Endpoints

- [ ] 6.1 Create `admin-service/supabase/server/api/admin/users.get.ts`: superadmin-only endpoint listing all users with usage stats (email, links_used, domains_used, max_links, max_domains); check `app_metadata.role === 'superadmin'` via service-role client
- [ ] 6.2 Create `admin-service/supabase/server/api/admin/users/[id]/quota.patch.ts`: superadmin-only, upsert `user_quotas` row
- [ ] 6.3 Create equivalent PocketBase admin API endpoints, using `pb.authStore.isAdmin` for superadmin check
- [ ] 6.4 Write tests: superadmin fetch user list, superadmin update quota, non-superadmin rejected with 403 (both services)

## 7. Quota Admin UI Page

- [ ] 7.1 Create `admin-service/supabase/app/pages/admin/index.vue`: superadmin-only page with user table (email, links used/max, domains used/max) and inline edit controls for quota overrides; redirects non-superadmins to `/`
- [ ] 7.2 Create equivalent `admin-service/pocketbase/app/pages/admin/index.vue`
- [ ] 7.3 Add `/admin` link to navigation in `admin-service/supabase/app/app.vue` (visible only when user is superadmin)
- [ ] 7.4 Add `/admin` link to navigation in `admin-service/pocketbase/app/app.vue` (visible only when PocketBase admin is logged in)

## 8. Quota User Indicator (Dashboard)

- [ ] 8.1 Create `QuotaBar.vue` component in `admin-service/supabase/app/components/`: accepts `{ used, max, label }` props, renders a progress bar with usage text and warning state when near/at limit
- [ ] 8.2 Create equivalent `QuotaBar.vue` in `admin-service/pocketbase/app/components/`
- [ ] 8.3 Update `admin-service/supabase/app/pages/index.vue`: call `GET /api/quota/me` on mount, render two `QuotaBar` components (links, domains); disable "Create Link" button when links quota is full
- [ ] 8.4 Update `admin-service/pocketbase/app/pages/index.vue`: same quota bar integration
- [ ] 8.5 Handle error case: if `GET /api/quota/me` fails, hide QuotaBar but do not break the link list

## 9. Tests & Cleanup

- [ ] 9.1 Add `DAILY_SIGNUP_LIMIT`, `MAX_LINKS_PER_USER`, `MAX_DOMAINS_PER_USER` to test setup env in both services' `vitest.config.ts`
- [ ] 9.2 Ensure all new server utils are covered by unit tests (quota.ts)
- [ ] 9.3 Document superadmin bootstrapping in `README.md` or deployment docs (how to set first superadmin's `app_metadata.role`)
- [ ] 9.4 Update `.env.example` with all new variables and comments explaining their purpose
