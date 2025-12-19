# Universal Edge Redirector Engine (v3 - Cuckoo Restored)

## 1\. System Overview

This system is a distributed, high-performance redirection layer designed for heterogeneous edge environments. It prioritizes **mutability** and **low latency**, using Cuckoo Filters to manage a dynamic "Allow List" of valid URLs to prevent expensive database lookups for 404 traffic.

### Core Philosophy

1.  **Mutable Gatekeeper:** Use **Cuckoo Filters** to allow real-time insertion and deletion of rules without downtime or complex "patching."
2.  **Hybrid Tracking:** Prioritize explicit user intent (`utm_source`) over implicit browser headers (`Referer`).
3.  **Push-Based Sync:** Leverage native database events to synchronize the Edge state instantly.

-----

## 2\. Core Data Structures

### A. The Gatekeeper: Cuckoo Filter

We revert to the standard **Cuckoo Filter** (using `2` buckets and `4` entries per bucket is standard for high density).

  * **Why:** Unlike Bloom or Ribbon filters, Cuckoo filters store "fingerprints" in a way that allows them to be removed.
      * **Insert:** `filter.add('example.com/promo')`
      * **Delete:** `filter.remove('example.com/promo')`
  * **Memory Footprint:** Slightly larger than Ribbon (\~10-20% more), but still extremely small. 100k items fit comfortably in **\~150KB**.

### B. The Routing Cache: Segmented Radix Tree

The Cuckoo Filter answers "Does it exist?", while the **Radix Tree** answers "Where does it go?".

  * **Optimization:** We strictly load only the **Active Language Slice** to keep RAM usage under the 128MB Edge Worker cap.

-----

## 3\. Sync & Update Mechanism (Simplified)

Since Cuckoo Filters are mutable, we don't need "Sidecars" or "Delta Sets." We apply updates directly to the main filter.

### 3.1. Database-Specific Implementation

  * **PostgreSQL:** Uses `NOTIFY/LISTEN` -\> Bridge Service -\> SSE to Edge.
  * **PocketBase:** Uses native Realtime API (SSE) -\> Edge.

### 3.2. Edge Update Logic

The update payload is processed atomically by the Edge Worker.

```javascript
// Incoming Payload from DB Stream
const update = {
  action: "delete", // or "create", "update"
  path: "/old-promo",
  host: "myshop.com",
  // ... data ...
};

function handleUpdate(update) {
  const key = update.host + update.path;

  if (update.action === 'create') {
    // 1. Add to Gatekeeper (Allow traffic)
    cuckooFilter.add(key);
    // 2. Add to Route Cache (If lang matches)
    if (matchesCurrentLang(update)) router.insert(path, data);
  } 
  
  else if (update.action === 'delete') {
    // 1. Remove from Gatekeeper (Block traffic immediately)
    cuckooFilter.remove(key); 
    // 2. Remove from Route Cache
    router.remove(path);
  }
}
```

-----

## 4\. Referrer Handling (Hybrid Priority)

We retain the robust "Explicit over Implicit" strategy for analytics.

```javascript
/**
 * Hybrid Priority Strategy:
 * 1. Explicit Tags (utm_source, ref) - Highest Trust
 * 2. Implicit Header (Referer) - Fallback
 */
function resolveReferrer(req, url) {
  // Check Query Params (Explicit)
  const explicit = url.searchParams.get('ref') || url.searchParams.get('utm_source');
  if (explicit) return { type: 'explicit', val: explicit };

  // Check Header (Implicit)
  const implicit = req.headers.get('Referer');
  if (implicit) return { type: 'implicit', val: implicit };

  return { type: 'none', val: null };
}
```

-----

## 5\. Deployment Matrix

| Feature | Cloudflare Workers | AWS Lambda@Edge | Fly.io / VPS |
| :--- | :--- | :--- | :--- |
| **Gatekeeper** | **Cuckoo Filter** (Mutable) | **Cuckoo Filter** (Mutable) | **Cuckoo Filter** |
| **Updates** | Direct `insert/delete` | Direct `insert/delete` | Direct `insert/delete` |
| **Sync Source** | SSE (PocketBase/Bridge) | SSE (PocketBase/Bridge) | WebSocket / PG Native |
| **Cache** | **Language Slice** (LRU) | **Language Slice** (LRU) | **Full Dataset** |
| **Referrer** | Hybrid Priority | Hybrid Priority | Hybrid Priority |

### Code Structure Snippet (HonoJS)

```javascript
import { Hono } from 'hono';
import { CuckooFilter } from 'bloom-filters'; // or similar lightweight lib
import { createRouter } from 'radix3';

const app = new Hono();

// 1. Mutable State
const gatekeeper = new CuckooFilter(150000); // Tuned for 100k + buffer
const router = createRouter();

// 2. Main Redirect Handler
app.get('*', async (c) => {
  const { req } = c;
  const url = new URL(req.url);
  const host = url.hostname;
  const path = url.pathname;
  const key = host + path;

  // A. Fast 404 Check (Mutable Cuckoo)
  if (!gatekeeper.has(key)) {
    return c.notFound();
  }

  // B. Routing Lookup
  let route = router.lookup(path);
  
  // C. Lazy Load (Cache Miss)
  // If Cuckoo says "Yes" but Route is missing (e.g. wrong language slice loaded)
  if (!route) {
    route = await fetchFromCentralDB(host, path);
    if (!route) {
      // False Positive Correction: Remove from Cuckoo so we don't check again
      gatekeeper.remove(key); 
      return c.notFound();
    }
    router.insert(path, route); // Hot cache it
  }

  // D. Referrer & Analytics
  const ref = resolveReferrer(req, url);
  c.executionCtx.waitUntil(logAnalytics(path, ref));

  return c.redirect(route.destination, 301);
});
```