# Implementation Tasks: Database Migration Tooling

## Task 1: Initialize Supabase Migration Framework
**Directory:** `admin-service/supabase/supabase/`
- [x] Run `supabase init` to create supabase config directory
- [x] Create `supabase/migrations/20250125000000_baseline.sql` from `schema.sql`
- [x] Verify `supabase db reset` applies the baseline cleanly
- [x] Update `.gitignore` to exclude `.supabase/` temp files
- [x] Keep `schema.sql` as reference but add deprecation note

## Task 2: Development Seed Data
**File:** `admin-service/supabase/supabase/seed.sql`
- [x] Create seed data: 10 test links with various configurations
- [x] Add analytics events for dashboard testing
- [x] Add A/B test configurations, targeting rules
- [x] Add expired and password-protected link examples
- [x] Verify seeds apply after migrations

## Task 3: CI Migration Validation
**File:** `.github/workflows/ci.yml`
- [x] Add Supabase CLI installation step
- [x] Add `supabase db reset` step to validate migrations
- [x] Add `supabase migration list` for visibility
- [x] Ensure migrations run before admin service tests

## Task 4: Migration Documentation
**File:** `docs/development/migrations.md`
- [x] Document migration creation workflow
- [x] Document rollback procedures
- [x] Document seed data usage
- [x] Add migration best practices and naming conventions
