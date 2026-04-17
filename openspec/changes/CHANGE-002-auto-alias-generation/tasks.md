# Implementation Tasks: Auto-Generated Aliases

## Task 1: Alias Generator Utility
**File:** `admin-service/supabase/server/utils/alias-generator.ts`
- [ ] Implement `generateAlias(length = 7): string` using `crypto.randomBytes`
- [ ] Character set: `[a-zA-Z0-9]` (62 chars)
- [ ] Implement `generateUniqueAlias(checkExists: (slug: string) => Promise<boolean>): Promise<string>`
- [ ] Retry up to 3 times on collision, then throw error
- [ ] Unit tests: length, charset, no-collision mock, collision-retry mock

## Task 2: API Update
**File:** `admin-service/supabase/server/api/links/create.post.ts`
- [ ] Update Zod schema: `slug: z.string().min(1).max(2048).optional()`
- [ ] If `!slug`, call `generateUniqueAlias()`
- [ ] Return `{ slug: generatedSlug, ... }` in response
- [ ] Test: POST without slug returns 201 with generated slug

## Task 3: UI Updates
**File:** `admin-service/supabase/app/pages/index.vue`
- [ ] Change slug input placeholder to "Leave empty to auto-generate"
- [ ] Add dice/generate icon button next to slug input
- [ ] Show generated slug in success notification with copy button
- [ ] Test: leave slug empty, submit, verify slug appears