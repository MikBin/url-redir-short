# Change Proposal: Distributed Rate Limiting

## Problem
Current rate limiting uses in-memory counters (`server/utils/rate-limit.ts`). This works for single-instance deployments but fails when running multiple Admin Service or Engine instances — each instance maintains independent counters, allowing attackers to bypass limits by hitting different instances.

## Opportunity
Moving rate limiting to a shared Redis/Valkey store ensures consistent enforcement across all instances, which is critical for horizontal scaling (NFR-02).

## Success Metrics
- Rate limits enforced consistently across multiple instances
- Redis/Valkey as shared counter store
- Graceful fallback to in-memory if Redis is unavailable
- No measurable latency impact on redirect path (<5ms per check)
- Zero regression in existing rate limit behavior

## Scope
- Replace in-memory rate limiter with Redis-backed implementation
- Use sliding window algorithm for accurate rate limiting
- Add graceful degradation (fallback to in-memory if Redis down)
- Update rate-limit tests for distributed behavior
