# Implementation Plan: Distributed Rate Limiting

## Phase 1: Redis Rate Limiter Module
- [ ] Create `admin-service/supabase/server/utils/redis-rate-limit.ts`
- [ ] Implement sliding window counter using Redis sorted sets
- [ ] Add Lua script for atomic check-and-increment
- [ ] Add `RateLimiter` interface with `check()` method
- [ ] Unit tests with Redis test instance

## Phase 2: Fallback and Factory
- [ ] Create rate limiter factory: Redis → in-memory fallback
- [ ] Add connection health monitoring
- [ ] Add automatic failover and recovery
- [ ] Log all fallback events
- [ ] Tests: Redis failure triggers in-memory fallback

## Phase 3: Integration
- [ ] Replace existing `rate-limit.ts` usage in middleware
- [ ] Add X-RateLimit response headers
- [ ] Add Redis connection configuration to env vars
- [ ] Update docker-compose.yml to ensure Redis available for Admin Service
- [ ] Integration tests: rate limits consistent across simulated instances

## Phase 4: Engine Rate Limiting (Optional)
- [ ] Add rate limiting to Redirect Engine for public redirect path
- [ ] Use same Redis instance or engine-local rate limiting
- [ ] Performance test: verify <5ms latency impact
