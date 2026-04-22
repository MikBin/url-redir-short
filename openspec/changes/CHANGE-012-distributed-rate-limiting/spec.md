# Specification: Distributed Rate Limiting

## Algorithm
- **Sliding Window Counter** using Redis sorted sets
- More accurate than fixed window, lower memory than sliding log

## Redis Data Structure
```
Key: rate_limit:{endpoint}:{client_ip_hash}
Type: Sorted Set
Members: request timestamps (score = timestamp)
TTL: window_size + 1 second
```

## Rate Limit Configuration
| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/analytics/v1/collect` | 100 requests | 1 minute |
| Admin API endpoints | 10 requests | 1 minute |
| Public redirect | 30 requests | 1 minute |

## Interface
```typescript
interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix timestamp
}
```

## Fallback Strategy
1. Attempt Redis check
2. If Redis unavailable (connection error, timeout): fall back to in-memory limiter
3. Log warning on fallback activation
4. Retry Redis connection periodically
5. Switch back to Redis when available

## Response Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706000000
Retry-After: 60 (only on 429)
```
