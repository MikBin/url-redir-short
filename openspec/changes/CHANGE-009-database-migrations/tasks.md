# Implementation Tasks: Database Migration Tooling

## Task 1: Initialize Supabase Migration Framework
**Directory:** `admin-service/supabase/supabase/`
- [ ] Run `supabase init` to create supabase config directory
- [ ] Create `supabase/migrations/20250125000000_baseline.sql` from `schema.sql`
- [ ] Verify `supabase db reset` applies the baseline cleanly
- [ ] Update `.gitignore` to exclude `.supabase/` temp files
- [ ] Keep `schema.sql` as reference but add deprecation note

## Task 2: Development Seed Data
**File:** `admin-service/supabase/supabase/seed.sql`
- [ ] Create seed data: 10 test links with various configurations
- [ ] Add analytics events for dashboard testing
- [ ] Add A/B test configurations, targeting rules
- [ ] Add expired and password-protected link examples
- [ ] Verify seeds apply after migrations

## Task 3: CI Migration Validation
**File:** `.github/workflows/ci.yml`
- [ ] Add Supabase CLI installation step
- [ ] Add `supabase db reset` step to validate migrations
- [ ] Add `supabase migration list` for visibility
- [ ] Ensure migrations run before admin service tests

## Task 4: Migration Documentation
**File:** `docs/development/migrations.md`
- [ ] Document migration creation workflow
- [ ] Document rollback procedures
- [ ] Document seed data usage
- [ ] Add migration best practices and naming conventions
