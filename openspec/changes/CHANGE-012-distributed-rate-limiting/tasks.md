# Implementation Tasks: Distributed Rate Limiting

## Task 1: Redis Rate Limiter Implementation
**File:** `admin-service/supabase/server/utils/redis-rate-limit.ts`
- [ ] Install `ioredis` package (or use existing Redis client if available)
- [ ] Create `RedisRateLimiter` class implementing `RateLimiter` interface
- [ ] Implement sliding window using sorted set: ZADD + ZREMRANGEBYSCORE + ZCARD
- [ ] Use Lua script for atomic operations
- [ ] Add TTL on keys to prevent memory leaks
- [ ] Return `RateLimitResult` with remaining count and reset time
- [ ] Unit tests: allow within limit, reject over limit, window expiry

## Task 2: Rate Limiter Factory with Fallback
**File:** `admin-service/supabase/server/utils/rate-limit-factory.ts`
- [ ] Create factory function: `createRateLimiter(redisUrl?: string): RateLimiter`
- [ ] If Redis URL provided and connectable: return `RedisRateLimiter`
- [ ] If Redis unavailable: return existing `InMemoryRateLimiter`
- [ ] Add health check ping every 30 seconds
- [ ] Auto-switch back to Redis when connection recovers
- [ ] Log transitions between Redis and in-memory
- [ ] Tests: factory returns correct implementation, handles connection failures

## Task 3: Middleware Integration
**File:** `admin-service/supabase/server/middleware/rate-limit.ts`
- [ ] Replace direct in-memory rate limiter with factory-created instance
- [ ] Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- [ ] Add `Retry-After` header on 429 responses
- [ ] Use hashed IP as rate limit key (existing hash utility)
- [ ] Integration tests: verify headers present, verify 429 after limit

## Task 4: Configuration and Docker Updates
**Files:** `.env.example`, `docker-compose.yml`
- [ ] Add `REDIS_URL` to Admin Service environment in docker-compose
- [ ] Add `RATE_LIMIT_BACKEND` env var (redis | memory | auto)
- [ ] Update `.env.example` with rate limit configuration
- [ ] Verify Redis service dependency in docker-compose
- [ ] E2E test: multiple concurrent requests hit consistent limit

## Review Log

**Date:** 2026-09-29 · **Reviewer:** nw-platform-architect-reviewer (Kilo) + nw-software-crafter-reviewer (Kilo)
**Verdict:** NEEDS_REVISION (as written) — SUSPENDED status is sensible, but the task list is doubly wrong: Tasks 3–4 are ~50–100% implemented in reality (0% claimed), while Task 1's spec is not what exists. Re-scope before resuming.

**Findings (priority order):**

- `issue (blocking, security):` `admin-service/supabase/server/utils/rate-limit.ts:66-69` fails open on Redis error ("Open for resiliency?" comment unanswered) — contradicts the constitution's "no endpoint bypasses rate limiting". Decide and document fail-closed vs fail-open; fail-open on auth-adjacent endpoints is a bypass primitive.
- `issue (blocking):` `rate-limit.ts:48-77` — INCR/EXPIRE race can permanently lock a key (EXPIRE set only on first INCR; if that call pair interleaves, key lives forever and the client is locked out).
- `issue (blocking):` Implementation deviates from spec: current code is Valkey-backed fixed-window INCR; Task 1 specifies sliding window (ZADD/ZREMRANGEBYSCORE/ZCARD) with Lua atomicity; Task 2's factory with health-check ping and auto-switch back to Redis does not exist. ADR-006 ("in-memory with Redis fallback"), arc42/NFR-10 ("in-memory only"), and CHANGE-012 (SUSPENDED) tell three contradictory stories.
- `suggestion (non-blocking):` PocketBase variant remains a plain in-memory Map (`admin-service/pocketbase/server/utils/rate-limit.ts:9`) — spec coverage should state this explicitly.
- `suggestion (non-blocking):` Task 3 is fully implemented (`middleware/rate-limit.ts:67-76`: X-RateLimit-* headers, Retry-After, hashed IP) and Task 4 half done (`REDIS_URL` present in compose + `.env.example`) — reconcile checkboxes.
- `thought (non-blocking):` Either resume this change with a re-scoped Task 1 that blesses the fixed-window implementation, or implement the sliding window as specified — the current middle ground means no artifact matches reality.
