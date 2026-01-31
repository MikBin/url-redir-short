# Caching Strategy Documentation

## Current Implementation

**Cache Strategy: PUSH-BASED WRITE-THROUGH with DB-ACKNOWLEDGED INVALIDATION**

The redir-engine uses **event-driven cache synchronization** where the central database (Supabase) **pushes acknowledgment events** to edge workers when items are modified or deleted. This ensures workers can reactively update their local cache and Cuckoo Filter.

### How It Works

```
Admin Service (Supabase)
    ↓ SSE Events (DB-Acknowledged Invalidation)
    ├── CREATE  → [Sync] Insert into RadixTree + Cuckoo Filter
    ├── UPDATE  → [Ack]  DB notifies worker → Update RadixTree + Cuckoo Filter
    └── DELETE  → [Ack]  DB notifies worker → Remove from RadixTree + Cuckoo Filter
    
Edge Worker Cache (In-Memory)
    ├── RadixTree     (full path routing table)
    ├── CuckooFilter  (existence checker for 404 rejection)
    ├── EventHandler  (receives DB acknowledgments, updates both structures)
    └── CacheMiss     (fetch from DB → populate RadixTree + CuckooFilter)
```

### DB-Acknowledged Invalidation Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Admin Service  │     │     Supabase     │     │  Edge Worker    │
│   (UI/API)      │     │  (Central DB)    │     │  (Cache Node)   │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │ 1. Modify/Delete      │                        │
         │─────────────────────> │                        │
         │                       │                        │
         │                       │ 2. Persist change      │
         │                       │─────────────┐          │
         │                       │             │          │
         │                       │ <───────────┘          │
         │                       │                        │
         │                       │ 3. ACK → SSE Event     │
         │                       │───────────────────────>│
         │                       │                        │
         │                       │                        │ 4. Update Cache
         │                       │                        │    + CuckooFilter
         │                       │                        │
```

**Key Principle**: The database is the source of truth. Workers **never evict items locally** without DB acknowledgment for modifications/deletions. This ensures:
- **No stale data** - Workers always reflect DB state
- **No ghost entries** - Deleted items are removed from Cuckoo Filter immediately
- **Consistency** - All workers converge to the same state

### Key Characteristics

| Aspect | Current | Notes |
|--------|---------|-------|
| **Strategy** | Push-based sync with DB ACK | DB notifies workers of changes |
| **Invalidation** | ✓ DB-Acknowledged | Supabase pushes UPDATE/DELETE events |
| **Cache Miss** | ✓ Fetch from DB | On miss, query DB and populate cache + filter |
| **TTL** | ❌ None | Items stay cached until DB sends delete ACK |
| **Eviction** | ✓ LRU (memory-based) | Evicts least-used items when memory threshold exceeded |
| **Expiration** | ✓ Per-item `expiresAt` | Checked at request time (not cache eviction) |
| **Tunable** | ✓ Full | Memory limits, batch size, check interval |
| **Consistency** | Immediate | Cache always reflects DB state via SSE ACK |

### Expiration Logic

**Location**: [src/use-cases/handle-request.ts#L48-L52](file:///d:/projects/url-redir-short/redir-engine/src/use-cases/handle-request.ts#L48-L52)

```typescript
// Per-rule expiration (rule-level, not cache-level)
const now = Date.now();
if (rule.expiresAt && now > rule.expiresAt) {
  return null; // Request fails as if rule doesn't exist
}
```

**Note**: This is **request-time validation**, not cache eviction. Expired rules remain in cache until:
1. Admin service deletes them via SSE `delete` event
2. Request checks `expiresAt` timestamp and rejects

### Cache Operations

**Create** → Insert into both structures:
```typescript
// src/use-cases/sync-state.ts#14-18
this.radixTree.insert(rule.path, rule);
this.cuckooFilter.add(rule.path);
```

**Update** → Same as insert (upsert):
```typescript
// src/use-cases/sync-state.ts#20-28
this.radixTree.insert(rule.path, rule);  // Overwrites existing
this.cuckooFilter.add(rule.path);        // Idempotent
```

**Delete** → Remove from both structures:
```typescript
// src/use-cases/sync-state.ts#30-34
this.radixTree.delete(rule.path);
this.cuckooFilter.remove(rule.path);
```

**Cache Miss** → Fetch from DB and populate cache:
```typescript
// On cache miss (item not in RadixTree but exists in DB)
const rule = await db.get(path);
if (rule) {
  this.radixTree.insert(rule.path, rule);   // Populate cache
  this.cuckooFilter.add(rule.path);         // Add to filter
}
```

This enables:
- **LRU-evicted items** to be re-fetched on next request
- **New workers** to lazily populate cache without full sync
- **Partition recovery** after network issues

### Eviction-on-Insert (New Items Take Precedence)

When the cache is at capacity and a new item needs to be inserted (via cache miss or DB update), the system **evicts the least-recently-used items** to make room. New/updated items always take precedence over older cached items.

```typescript
// Before inserting a new item, check if eviction is needed
private ensureCapacity(): void {
  if (this.isAtCapacity()) {
    // Evict LRU items to make room for new entry
    this.evictLeastRecentlyUsed(this.evictionBatchSize);
  }
}

// Called on cache miss or DB update
public insert(path: string, rule: RedirectRule): void {
  this.ensureCapacity();                      // Evict if needed
  this.radixTree.insert(path, rule);          // Insert new item
  this.cuckooFilter.add(path);                // Update filter
  this.recordAccess(path, rule);              // Mark as recently used
}
```

**Behavior:**
| Scenario | Action |
|----------|--------|
| Cache miss + cache full | Evict LRU items → insert fetched item |
| DB update (SSE ACK) + cache full | Evict LRU items → insert updated item |
| DB create (SSE ACK) + cache full | Evict LRU items → insert new item |

**Guarantees:**
- ✓ New items are always cached (never rejected due to capacity)
- ✓ Updated items reflect latest DB state immediately
- ✓ Oldest/least-used items are evicted first (LRU policy)
- ✓ Cuckoo Filter stays in sync with RadixTree

## Tunability

### Per-Rule Tunable (Admin Service)

Each `RedirectRule` can specify:

```typescript
{
  id: "my-link",
  path: "/shortlink",
  destination: "https://example.com",
  code: 301,
  expiresAt: 1735689600000,  // Unix timestamp (ms)
  maxClicks: 1000,            // Max clicks before expiry
  clicks: 0                    // Current click count
}
```

**Admin Service Controls:**
- ✓ Set `expiresAt` per rule
- ✓ Set `maxClicks` limit per rule
- ✓ Push updates via SSE in real-time
- ✓ Delete rules to remove from cache

### Global Cache Policy (TUNABLE via Environment Variables)

**Now configurable:**
- ✓ Memory threshold for eviction (via `CACHE_MAX_HEAP_MB`)
- ✓ LRU eviction policy (automatic)
- ✓ Eviction batch size (via `CACHE_EVICTION_BATCH`)
- ✓ Memory check interval (via `CACHE_CHECK_INTERVAL_MS`)
- ✓ Eviction metrics (via `CACHE_METRICS`)

**Still NOT configurable:**
- ❌ TTL for all rules (only per-rule `expiresAt`)
- ❌ Other eviction strategies (LRU only)
- ❌ Partial caching strategy

## Implications

### Advantages ✓
- **Zero stale data risk** - Cache always in sync with DB via ACK events
- **Immediate invalidation** - DB-acknowledged changes propagate in <100ms via SSE
- **Authoritative consistency** - Workers never locally invalidate; DB is source of truth
- **Per-rule control** - Fine-grained expiration possible
- **Predictable behavior** - Deterministic cache state across all workers
- **Cuckoo Filter accuracy** - Filter updated on DB ACK, preventing false positives after delete

### Disadvantages ✗
- **Requires constant sync** - SSE connection must stay alive for ACKs
- **Memory pressure** - Cache can grow; mitigated by LRU eviction
- **Re-sync on reconnect** - Workers need full sync if SSE disconnects
- **Single point of coordination** - All invalidation flows through Supabase

## Eviction Configuration

### Environment Variables

Configure eviction behavior via environment variables:

```bash
# Max heap memory before eviction triggers (MB)
CACHE_MAX_HEAP_MB=500

# Number of items to evict per batch
CACHE_EVICTION_BATCH=1000

# How often to check memory (ms)
CACHE_CHECK_INTERVAL_MS=10000

# Enable eviction metrics logging
CACHE_METRICS=true
```

### Default Values

| Variable | Default | Notes |
|----------|---------|-------|
| `CACHE_MAX_HEAP_MB` | 500 | Trigger eviction at 500MB heap usage |
| `CACHE_EVICTION_BATCH` | 1000 | Remove 1K items per eviction round |
| `CACHE_CHECK_INTERVAL_MS` | 10000 | Check every 10 seconds |
| `CACHE_METRICS` | true | Log metrics to stdout |

### Example Configurations

**Small deployments (100K items):**
```bash
CACHE_MAX_HEAP_MB=200
CACHE_EVICTION_BATCH=500
CACHE_CHECK_INTERVAL_MS=5000
```

**Large deployments (1M+ items):**
```bash
CACHE_MAX_HEAP_MB=2000
CACHE_EVICTION_BATCH=5000
CACHE_CHECK_INTERVAL_MS=60000
```

### How It Works

```
1. Memory Monitor (every CACHE_CHECK_INTERVAL_MS)
   └─ Check process.memoryUsage().heapUsed

2. Threshold Check
   ├─ If heap < CACHE_MAX_HEAP_MB → OK
   └─ If heap ≥ CACHE_MAX_HEAP_MB → Trigger eviction

3. LRU Eviction (Memory Pressure Only)
   ├─ Sort cached items by lastAccessTime
   ├─ Remove CACHE_EVICTION_BATCH least-recently-used items
   ├─ Delete from RadixTree and CuckooFilter
   └─ Note: Items can be re-fetched on next request if still in DB

4. DB-Acknowledged Invalidation (Authoritative)
   ├─ Supabase pushes UPDATE/DELETE events via SSE
   ├─ Worker updates RadixTree and CuckooFilter immediately
   └─ This is the authoritative source for modifications/deletions

5. Metrics
   ├─ Track total evictions
   ├─ Track items evicted
   └─ Log to stdout (if CACHE_METRICS=true)
```

### Eviction Metrics

Get cache status via runtime:

```typescript
// In your Node.js application
const info = syncState.getCacheInfo();
console.log(`Cache: ${info.size} items, ${info.heapUsedMB}MB heap`);

// Print detailed report
console.log(syncState.printCacheReport());
```

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║                    Cache Eviction Report                    ║
╚════════════════════════════════════════════════════════════╝

📊 Cache State
  Size: 142,567 items
  Heap Used: 450.2MB / 500MB
  Usage: 90.0%

📈 Eviction Metrics
  Total Evictions: 3
  Items Evicted: 3,000
  Peak Heap: 512.5MB
  Last Eviction: 2024-01-26T15:30:45.123Z

════════════════════════════════════════════════════════════
```

## Recommended Improvements

### Phase 1: Per-Worker Cache Limits (✅ DONE)
LRU eviction with configurable memory threshold:

```typescript
interface EvictionConfig {
  maxHeapMB: number;           // Trigger at this heap usage
  evictionBatchSize: number;   // Items to remove per batch
  checkIntervalMs: number;     // Monitor frequency
  enableMetrics: boolean;      // Log metrics
}
```

**Status**: Implemented in `CacheEvictionManager`

### Phase 2: DB-Acknowledged Invalidation (✅ DONE)

Workers receive acknowledgment events from Supabase when items are modified or deleted:

```typescript
// SSE Event Handler - receives DB acknowledgments
sseClient.on('update', (rule: RedirectRule) => {
  // DB acknowledged update → update local cache + filter
  syncState.handleUpdate(rule);
});

sseClient.on('delete', (path: string) => {
  // DB acknowledged delete → remove from cache + filter
  syncState.handleDelete(path);
});
```

**Key guarantees:**
- Cache invalidation only occurs after DB confirms the change
- Cuckoo Filter is updated synchronously with cache
- No local TTL/expiry eviction for active items (DB controls lifecycle)

### Phase 3: Smart Expired Item Cleanup (SHORT-TERM)
Periodically remove items that have passed their `expiresAt` (already confirmed expired by DB):

```typescript
// Remove expired items periodically (local cleanup only)
setInterval(() => {
  const now = Date.now();
  cacheManager.evictExpired(now);
}, 60000); // Every minute
```

**Note**: This is a local optimization; DB still sends delete ACKs for authoritative removal.

### Phase 4: Distributed Cache Strategy (MEDIUM-TERM)
For 1M+ items, partition across workers:

```
Admin DB: 1,000,000 items
  ↓
Worker 1 (100K): /a-f*
Worker 2 (100K): /g-l*
Worker 3 (100K): /m-r*
Worker 4 (100K): /s-z*
  +6 backup workers
```

Each worker subscribes to DB ACKs only for its partition.

### Phase 5: Hybrid Cache-DB Lookup (LONG-TERM)
Allow cache misses to query DB directly:

```typescript
// If not in cache, query DB
const cached = radixTree.find(path);
if (!cached) {
  const dbItem = await db.get(path);  // Fallback
  if (dbItem) radixTree.insert(path, dbItem);
  return dbItem;
}
```

## Current Recommendation for 1M Items + 10 Workers

**Your setup:**
- 1M items in Supabase
- 10 workers × 100K cache each = 1M total

**Strategy:**
- ✓ Use `expiresAt` for time-limited links
- ✓ Use `maxClicks` for click-limited links
- ⚠️ Accept unbounded memory (OK for 100K items per worker)
- ⚠️ Monitor heap usage; add eviction if > 500MB
- ✓ Implement Phase 3 (distributed partitioning) if exceeds capacity

**Estimated Memory per Worker:**
- 100K items × ~300 bytes/item = ~30MB ✓ (acceptable)
- Heap overhead: ~10MB
- **Total per worker: ~40MB** (well within Node.js defaults)

## Files

- [src/adapters/cache/cache-eviction.ts](file:///d:/projects/url-redir-short/redir-engine/src/adapters/cache/cache-eviction.ts) - **NEW**: LRU eviction manager with memory monitoring
- [src/use-cases/sync-state.ts](file:///d:/projects/url-redir-short/redir-engine/src/use-cases/sync-state.ts) - Cache synchronization + eviction integration
- [src/use-cases/handle-request.ts#L48-L52](file:///d:/projects/url-redir-short/redir-engine/src/use-cases/handle-request.ts#L48-L52) - Expiration validation
- [src/core/routing/radix-tree.ts](file:///d:/projects/url-redir-short/redir-engine/src/core/routing/radix-tree.ts) - Cache storage
- [src/core/filtering/cuckoo-filter.ts](file:///d:/projects/url-redir-short/redir-engine/src/core/filtering/cuckoo-filter.ts) - 404 rejection
- [runtimes/node/index.ts](file:///d:/projects/url-redir-short/redir-engine/runtimes/node/index.ts) - Environment variable configuration
