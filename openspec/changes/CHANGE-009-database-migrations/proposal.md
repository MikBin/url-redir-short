# Change Proposal: Database Migration Tooling

## Problem
Schema changes are managed via a single `schema.sql` file with no versioning, rollback capability, or migration history. This makes it impossible to safely evolve the database schema in production without risking data loss or inconsistency.

## Opportunity
Adopting Supabase's built-in migration tooling provides versioned, reversible migrations that integrate naturally with the existing Supabase stack.

## Success Metrics
- All schema changes managed via numbered migration files
- Rollback capability for every migration
- Migration history tracked in database
- CI pipeline validates migrations
- Existing `schema.sql` converted to baseline migration

## Scope
- Initialize Supabase migrations from existing schema
- Create migration workflow documentation
- Add migration validation to CI pipeline
- Provide seed data for development environments
