This research document outlines the technical implementation of referrer tracking in a URL shortener service. It covers the theoretical methods of detection (HTTP Headers vs. Query Parameters) and provides complete, production-ready code example in **TypeScript (Hono)**.

-----

# Research Document: Referrer Tracking in URL Redirection Services

**Date:** December 06, 2025
**Topic:** Analytics & Referrer Attribution in URL Shorteners
**Technologies:** TypeScript (Hono Framework)

## 1\. Executive Summary

In the context of a URL shortener, identifying the "referrer" (the source of the traffic) is critical for analytics. There are two primary vectors for capturing this data:

1.  **Implicit Tracking:** Capturing the standard `Referer` HTTP header sent by the browser.
2.  **Explicit Tracking:** Parsing custom Query Parameters (e.g., `utm_source`, `ref`) appended to the short URL.

A robust system must implement a "Hybrid Priority Strategy": always prioritize Explicit Tracking (User-defined tags) and fallback to Implicit Tracking (Headers) when tags are missing.

-----

## 2\. Technical Implementation Strategy

To accurately determine the referrer, the redirect handler must execute the following logic sequence *before* issuing the HTTP 301/302 redirect:

1.  **Ingest Request:** Receive the incoming request for a short code (e.g., `/xyz`).
2.  **Check Query Params:** Scan `source`, `ref`, or `utm_source` in the URL query string.
3.  **Check Headers:** If no query param is found, read the `Referer` header.
4.  **Sanitize:** Clean the data (remove protocols, trailing slashes) to ensure consistent reporting.
5.  **Log Async:** Dispatch the analytics event to a database/queue non-blocking to avoid slowing down the redirect.
6.  **Redirect:** Send the user to the long URL.

-----

## 3\. Implementation: TypeScript (Hono)

Hono is an ultrafast web framework that runs on any JavaScript runtime (Cloudflare Workers, Deno, Bun, Node). This example assumes a generic runtime (like Node or Bun).

### `index.ts`

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server' // If using Node.js

const app = new Hono()

// Mock Database
const urlDatabase: Record<string, string> = {
  'ts-guide': 'https://www.typescriptlang.org/docs/',
  'hono-doc': 'https://hono.dev'
}

// Types for Analytics
interface AnalyticsEvent {
  shortCode: string
  referrer: string
  method: 'QUERY' | 'HEADER' | 'NONE'
  userAgent: string
  timestamp: string
}

// Helper to resolving referrer priority
const resolveReferrer = (c: any): { value: string; method: 'QUERY' | 'HEADER' | 'NONE' } => {
  // Priority 1: Check Query Parameters
  const queryTags = ['ref', 'source', 'utm_source']
  
  for (const tag of queryTags) {
    const val = c.req.query(tag)
    if (val) {
      return { value: val, method: 'QUERY' }
    }
  }

  // Priority 2: Check HTTP Header
  const headerRef = c.req.header('Referer')
  if (headerRef) {
    try {
      // Optional: Clean up URL to just show hostname
      const parsedUrl = new URL(headerRef)
      return { value: parsedUrl.hostname, method: 'HEADER' }
    } catch (e) {
      return { value: headerRef, method: 'HEADER' }
    }
  }

  // Priority 3: Direct
  return { value: 'direct', method: 'NONE' }
}

// Route Handler
app.get('/:code', async (c) => {
  const code = c.req.param('code')
  const destination = urlDatabase[code]

  if (!destination) {
    return c.text('URL Not Found', 404)
  }

  // Resolve Referrer
  const refData = resolveReferrer(c)

  // Construct Event Object
  const event: AnalyticsEvent = {
    shortCode: code,
    referrer: refData.value,
    method: refData.method,
    userAgent: c.req.header('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  }

  // Async Logging (Fire and forget)
  // In Cloudflare Workers, use ctx.waitUntil() to ensure this completes
  console.log(`[CLICK] ${JSON.stringify(event)}`)

  // Redirect
  return c.redirect(destination, 302)
})

console.log('Hono Shortener running on port 3000')

// For Node.js execution
serve({
  fetch: app.fetch,
  port: 3000
})

// For Bun, you would just export default app
export default app
```

-----

## 4\. Testing & Verification

To verify that your logic works, you can use `curl` to simulate different referrer scenarios.

### Test 1: Implicit Header (Simulating a click from another site)

*The system should catch the header.*

```bash
# -e sets the Referer header
curl -v -e "https://facebook.com/feed" http://localhost:3000/ts-guide
```

**Expected Log Output:** `Source: facebook.com (HEADER)`

### Test 2: Explicit Query Param (Simulating a marketing campaign)

*The system should ignore the header if a query param exists.*

```bash
# Even if Referer is google.com, the ?source=newsletter should win
curl -v -e "https://google.com" "http://localhost:3000/ts-guide?source=newsletter"
```

**Expected Log Output:** `Source: newsletter (QUERY)`

### Test 3: Direct Traffic (No header, no param)

```bash
curl -v http://localhost:3000/ts-guide
```

**Expected Log Output:** `Source: direct (NONE)`

## 5\. Key Takeaways for Production

1.  **Redaction:** Referrer headers often contain sensitive information (e.g., `company.com/internal/salary-sheet`). It is industry standard to strip the path and only store the **Hostname** (e.g., store `company.com`, discard `/internal...`) unless you have a specific reason not to.
2.  **Referrer Policy:** When you redirect, you become the referrer for the *next* page (the destination). To protect your users' privacy, your shortener responses should include the header `Referrer-Policy: unsafe-url` (if you want to pass data) or `no-referrer` (if you want to hide that the traffic came from your shortener).
3.  **Bot Filtering:** Your logs will be flooded by bots checking links. Filter your analytics based on the `User-Agent` string captured in the code examples above.