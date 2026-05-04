# Specification: Database Migration Tooling

## Migration Framework
- **Tool:** Supabase CLI (`supabase migration`)
- **Location:** `admin-service/supabase/supabase/migrations/`
- **Naming:** `YYYYMMDDHHMMSS_description.sql` (Supabase default)

## Deployment Assumption
This is a **fresh deploy** — no existing production database with data to migrate. The baseline migration creates the full schema from scratch.

## Baseline Migration
Convert existing `schema.sql` into the first migration:
```
supabase/migrations/
├── 20250125000000_baseline.sql    ← Current schema.sql content
├── 20250126000000_add_indexes.sql ← Example future migration
└── ...
```

## Migration Workflow
1. `supabase migration new <name>` — Create new migration file
2. Edit SQL in the generated file
3. `supabase db reset` — Apply all migrations locally
4. `supabase db push` — Apply to remote (production)
5. `supabase migration list` — View migration status

## Rollback Strategy
- Each migration file should include a comment block with rollback SQL
- Critical migrations require a tested rollback script
- Use `supabase db reset` for full local reset during development

## Seed Data
- `admin-service/supabase/supabase/seed.sql` for development data
- Test links, analytics events, and user fixtures
- Never run seeds in production

## CI Integration
- CI pipeline runs `supabase db reset` to validate all migrations apply cleanly
- Migration files checked for syntax errors
- Schema drift detection: compare local migrations vs remote schema
