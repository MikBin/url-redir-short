# ADR-006: Redis/Valkey for Rate Limiting and Caching

**Status:** Accepted
**Date:** 2026-05-30

## Context

The Admin Service needs rate limiting to protect API endpoints from abuse. Currently, rate limiting is implemented in-memory per process (`server/utils/rate-limit.ts`). This works for single-instance deployments but fails in multi-instance or distributed scenarios where each instance maintains its own counter.

Additionally, the docker-compose stack already includes a Valkey (Redis-compatible) service for potential use across the system.

## Decision

Use **Valkey** (Redis-compatible, `valkey/valkey:8-alpine`) as the in-memory data store for:

1. **Rate limiting**: Sliding window counters shared across Admin Service instances
2. **Caching**: Potential future use for session caching, analytics aggregation

The Valkey service is included in `docker-compose.yml` and accessible to the Admin Service via `REDIS_URL` environment variable.

### Current State

- Valkey is deployed as a service in `docker-compose.yml`
- Admin Service connects via `REDIS_URL: redis://redis:6379`
- `server/utils/rate-limit.ts` exists in both admin variants
- Full distributed rate limiting (CHANGE-012) is still pending — current implementation uses in-memory with potential Redis fallback

### Future (CHANGE-012)

The planned distributed rate limiting enhancement will fully leverage Redis for:
- Sliding window rate limiter across multiple Admin instances
- Rate limiter factory with in-memory fallback when Redis is unavailable
- Middleware integration for all public endpoints

## Consequences

**Positive:**
- Shared state across multiple Admin Service instances
- Redis/Valkey is lightweight and already in the stack
- Enables future distributed features (session store, analytics cache)

**Negative:**
- Additional infrastructure dependency for production deployments
- Valkey must be highly available if rate limiting depends on it
- Local development without Docker needs a Redis instance (or graceful fallback)