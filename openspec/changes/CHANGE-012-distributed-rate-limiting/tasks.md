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
