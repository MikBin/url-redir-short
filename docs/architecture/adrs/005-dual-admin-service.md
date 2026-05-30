# ADR-005: Dual Admin Service — Supabase + PocketBase

**Status:** Accepted
**Date:** 2026-05-30

## Context

The system needs a control plane (Admin Service) for link management, analytics, and state synchronization with the Redirect Engine. The original implementation uses Supabase (PostgreSQL + GoTrue + Realtime) as the backend. However, Supabase introduces significant operational complexity for self-hosted deployments (multiple containers: PostgreSQL, GoTrue, PostgREST, Realtime, Kong, Studio).

Some deployment scenarios prefer a simpler, single-binary database backend that can be embedded or run with minimal infrastructure.

## Decision

We maintain **two fully parallel admin service implementations** under `admin-service/`:

| Variant | Directory | Backend | Auth |
|---------|-----------|---------|------|
| Supabase | `admin-service/supabase/` | Supabase (PostgreSQL + Realtime) | Supabase Auth (JWT) |
| PocketBase | `admin-service/pocketbase/` | PocketBase (SQLite) | PocketBase Auth (cookie) |

Both share the same Nuxt 4 + Vue 3 frontend architecture and expose an identical API surface. Shared types and utilities live in `admin-service/shared/`.

### Feature Parity

Both variants implement:
- Full link CRUD with A/B testing, targeting, expiration, password protection
- SSE sync stream to engines
- Analytics ingestion and dashboard
- QR code generation
- Bulk import (JSON)
- Audit logging
- UTM builder

### Differences

| Aspect | Supabase | PocketBase |
|--------|----------|------------|
| Database | PostgreSQL (Supabase) | SQLite (PocketBase) |
| Realtime | Supabase Realtime (WebSocket) | PocketBase Realtime (SSE) |
| Auth | JWT (Supabase Auth) | Cookie (PocketBase Auth) |
| Migrations | Supabase CLI (`supabase/migrations/`) | PocketBase JS (`pb_migrations/`) |
| Cloudflare KV | ✅ (`cloudflare-kv.ts`) | ❌ |
| Domains UI | ❌ | ✅ (`pages/domains/`) |
| Secrets validation | ✅ (`validate-env` plugin) | ❌ |

## Consequences

**Positive:**
- Deployment flexibility: lightweight (PocketBase) or full-featured (Supabase)
- PocketBase is a single binary — ideal for small/self-hosted deployments
- Shared code in `admin-service/shared/` reduces duplication

**Negative:**
- Two codebases to maintain in parallel
- Feature drift risk — requires active parity tracking (documented in `docs/analysis/implementation-status.md`)
- Some features (CF KV, metrics plugin, secrets validation) are Supabase-only
- Test coverage is significantly deeper for Supabase than PocketBase