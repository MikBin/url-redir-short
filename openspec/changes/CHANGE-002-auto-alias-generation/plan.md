# Implementation Plan: Auto-Generated Aliases

## Phase 1: Alias Generator Utility (Day 1)
- [ ] Create `admin-service/supabase/server/utils/alias-generator.ts`
- [ ] Implement `generateAlias(length?: number): string` using crypto-safe randomness
- [ ] Add collision check against existing slugs in database
- [ ] Retry logic (max 3 attempts) on collision
- [ ] Unit tests: uniqueness, length, character set, collision handling

## Phase 2: API Integration (Day 1)
- [ ] Update `admin-service/supabase/server/api/links/create.post.ts`
- [ ] Make `slug` field optional in Zod schema
- [ ] Call alias generator when slug is empty/omitted
- [ ] Return generated slug in response
- [ ] Integration test: create link without slug returns auto-generated one

## Phase 3: UI Updates (Day 2)
- [ ] Update slug input in `index.vue`: placeholder text, optional indicator
- [ ] Add "Auto-generate" button next to slug input
- [ ] Display generated slug prominently after link creation
- [ ] Copy-to-clipboard for generated slug