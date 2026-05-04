# Implementation Plan: Database Migration Tooling

## Phase 1: Initialize Supabase Migrations
- [ ] Run `supabase init` if not already done
- [ ] Create baseline migration from existing `schema.sql`
- [ ] Verify `supabase db reset` applies cleanly
- [ ] Remove direct schema.sql usage in favor of migrations

## Phase 2: Seed Data
- [ ] Create `supabase/seed.sql` with development fixtures
- [ ] Add test links, analytics events, sample users
- [ ] Verify `supabase db reset` applies migrations + seeds

## Phase 3: CI Integration
- [ ] Add migration validation step to `.github/workflows/ci.yml`
- [ ] Run `supabase db reset` in CI to validate migrations
- [ ] Add schema drift check for PRs

## Phase 4: Documentation
- [ ] Create `docs/development/migrations.md` with workflow guide
- [ ] Document how to create, apply, and rollback migrations
- [ ] Add migration checklist to PR template
