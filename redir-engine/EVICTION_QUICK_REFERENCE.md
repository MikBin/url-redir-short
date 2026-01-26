# Cache Eviction Quick Reference

## TL;DR

Automatic LRU cache eviction when memory exceeds threshold.

```bash
# Set memory limit (MB)
export CACHE_MAX_HEAP_MB=500

# Set eviction batch size
export CACHE_EVICTION_BATCH=1000

# Set check frequency (ms)
export CACHE_CHECK_INTERVAL_MS=10000

# Disable metrics logging (optional)
export CACHE_METRICS=false
```

## Environment Variables

| Variable | Default | Example |
|----------|---------|---------|
| `CACHE_MAX_HEAP_MB` | 500 | 200 (small) / 2000 (large) |
| `CACHE_EVICTION_BATCH` | 1000 | 500 (aggressive) / 5000 (relaxed) |
| `CACHE_CHECK_INTERVAL_MS` | 10000 | 5000 (frequent) / 60000 (rare) |
| `CACHE_METRICS` | true | false (disable logging) |

## Monitoring

```typescript
// In your Node.js code
const report = syncState.printCacheReport();
console.log(report);
```

## Performance Impact

- **Memory per item**: ~300 bytes
- **Check overhead**: ~0.15% CPU per 10s
- **Eviction speed**: 1000 items in ~15ms

## Recommended Presets

### Small (< 100K items)
```bash
CACHE_MAX_HEAP_MB=200
CACHE_EVICTION_BATCH=500
CACHE_CHECK_INTERVAL_MS=5000
```

### Medium (100K - 500K items)
```bash
CACHE_MAX_HEAP_MB=500
CACHE_EVICTION_BATCH=1000
CACHE_CHECK_INTERVAL_MS=10000
```

### Large (500K - 2M items)
```bash
CACHE_MAX_HEAP_MB=2000
CACHE_EVICTION_BATCH=5000
CACHE_CHECK_INTERVAL_MS=60000
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Memory still growing | ↓ Reduce `CACHE_MAX_HEAP_MB` |
| Too many evictions | ↑ Increase `CACHE_MAX_HEAP_MB` |
| Hit rate dropping | ↑ Increase `CACHE_MAX_HEAP_MB` |
| CPU high | ↑ Increase `CACHE_CHECK_INTERVAL_MS` |

## Eviction Metrics

```typescript
const metrics = syncState.getEvictionMetrics();
// {
//   totalEvictions: 5,
//   totalItemsEvicted: 5000,
//   lastEvictionTime: 1706265045000,
//   peakHeapMB: 512.5,
//   currentHeapMB: 480.2
// }
```

## Cache Info

```typescript
const info = syncState.getCacheInfo();
// {
//   size: 142567,              // items in cache
//   heapUsedMB: 450.2,
//   maxHeapMB: 500,
//   metrics: { ... }
// }
```

## How It Works

```
Every CACHE_CHECK_INTERVAL_MS:
  1. Check heap usage
  2. If heap > CACHE_MAX_HEAP_MB:
     a. Sort items by lastAccessTime (ascending)
     b. Remove CACHE_EVICTION_BATCH oldest items
     c. Delete from RadixTree + CuckooFilter
     d. Log metrics
```

## Files

- **Manager**: [src/adapters/cache/cache-eviction.ts](file:///d:/projects/url-redir-short/redir-engine/src/adapters/cache/cache-eviction.ts)
- **Integration**: [src/use-cases/sync-state.ts](file:///d:/projects/url-redir-short/redir-engine/src/use-cases/sync-state.ts)
- **Config**: [runtimes/node/index.ts](file:///d:/projects/url-redir-short/redir-engine/runtimes/node/index.ts)
- **Docs**: [CACHING_STRATEGY.md](file:///d:/projects/url-redir-short/CACHING_STRATEGY.md)
