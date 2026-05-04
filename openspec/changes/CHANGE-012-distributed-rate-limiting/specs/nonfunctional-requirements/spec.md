# Delta Spec: Distributed Rate Limiting

## MODIFIED Requirements

### Requirement: NFR-10 - Distributed Rate Limiting
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Rate limiting MUST work across multiple engine instances using a shared store (Redis/KV) rather than in-memory counters.
- **Implementation:** Replaced in-memory counters with a Redis-backed sliding window implementation using Lua scripts for atomicity.
- **Tests:** `redir-engine/tests/integration/rate-limit-distributed.test.ts`

#### Scenario: Global Rate Limit Enforcement
Given two independent instances of the Redirector Engine sharing a Redis store
And a rate limit of 100 requests per minute
When 60 requests are sent to Instance A and 50 requests are sent to Instance B within the same minute
Then Instance B MUST return a 429 Too Many Requests response for the last 10 requests

#### Scenario: Redis Fallback to Local Memory
Given the Redirector Engine loses connection to the shared Redis store
When an incoming request is processed
Then the engine MUST fallback to local in-memory rate limiting to ensure availability
And it MUST log a warning indicating the distributed store is unavailable
