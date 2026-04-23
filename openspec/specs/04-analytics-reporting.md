# Spec: Analytics & Reporting

## Overview
The analytics pipeline covers referrer/source tracking with a hybrid priority strategy, real-time engagement metrics (CTR, unique visitors, total clicks), geographic and device demographics, and reporting dashboards.

## Requirements

### FR-09: Hybrid Priority Strategy for Source Tracking
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST implement a Hybrid Priority Strategy for identifying traffic sources.
- **Implementation:** `buildAnalyticsPayload()` in `redir-engine/src/core/analytics/payload-builder.ts`

### FR-10: Explicit Source (UTM/Query Params)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST check for specific query parameters (e.g., `utm_source`, `ref`, `source`) and use their value as the referrer if present.
- **Implementation:** UTM parameter extraction in `payload-builder.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T05-priority-logic.test.ts`

### FR-11: Implicit Source (Referer Header)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** If no explicit tags are found, the system MUST fallback to the HTTP `Referer` header.
- **Implementation:** Referer header fallback in `payload-builder.ts`

### FR-42: Click-Through Rate (CTR) Tracking
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support Click-Through Rate (CTR) tracking for all links in real-time.
- **Implementation:**
  - Collection: `redir-engine/src/core/analytics/collector.ts`
  - Ingestion: `admin-service/supabase/server/api/analytics/v1/collect.post.ts`
  - Aggregation: Database RPC `increment_analytics_aggregate`

### FR-43: Unique Visitor and Total Click Counts
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Engagement metrics MUST include unique visitor counts and total clicks.
- **Implementation:** Aggregated in `analytics_aggregates` table; displayed in dashboard and link overview

### FR-44: Geographic Data Tracking
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST track Geographic Data at the Country and City level (where available from edge headers).
- **Implementation:** Country extracted from `cf-ipcountry` in `payload-builder.ts`
- **Dashboard:** Geo distribution chart in `analytics.vue`

### FR-45: Device and Browser Profiling
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST track Device and Browser profiles by parsing the User-Agent string.
- **Implementation:** UA parsing in `payload-builder.ts`
- **Dashboard:** Device types and browser distribution charts in `analytics.vue`

### FR-46: Referral Source Tracking
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST provide detailed Referral Source tracking, distinguishing between direct traffic, search engines, and social media based on the Referrer header and query parameters.
- **Implementation:** Referrer field captured in analytics payload
- **Dashboard:** Referrer column in recent events table in `analytics.vue`

### FR-47: UTM Parameter Management UI
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Admin Service MUST support UTM Parameter Management, allowing users to easily append and manage UTM tags (Source, Medium, Campaign) during link creation.
- **Implementation:** Added `UtmBuilder.vue` component with URL preview, and `useUtmTemplates.ts` composable for local storage templates.
- **See Also:** `openspec/changes/CHANGE-004-utm-management-ui/`

### FR-48: Custom Dashboards / History Audit Log
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Analytics Service MUST provide Link History Audit Logs to track creations, modifications, and deletions.
- **Implementation:** Added `link_audit_log` table, triggers, and an `AuditLog.vue` component in a new History tab within the Link Editor.
- **See Also:** `openspec/changes/CHANGE-005-history-audit-log-ui/`

### FR-49: Decoupled Analytics Processing
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Redirector Engine MUST decouple analytics processing by pushing data to the Analytics Service via a defined interface, ensuring edge performance is not compromised.
- **Implementation:** `AnalyticsCollector` interface in `collector.ts`, `fire-and-forget.ts` adapter
- **Tests:** `T04-analytics-emission.test.ts`

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-09 | ✅ | Hybrid priority strategy |
| FR-10 | ✅ | UTM param extraction |
| FR-11 | ✅ | Referer header fallback |
| FR-42 | ✅ | Real-time CTR tracking |
| FR-43 | ✅ | Unique visitors + total clicks |
| FR-44 | ✅ | Country tracking via cf-ipcountry |
| FR-45 | ✅ | Device/browser from UA |
| FR-46 | ✅ | Referrer tracking |
| FR-47 | ✅ | Implemented in CHANGE-004 |
| FR-48 | ✅ | Implemented in CHANGE-005 |
| FR-49 | ✅ | Decoupled via fire-and-forget |

## API Endpoints
- `POST /api/analytics/v1/collect` — Ingestion with rate limiting (100/min)
- `GET /api/analytics/dashboard` — Dashboard overview (summary, trends, geo, device, browser)
- `GET /api/analytics/stats` — Raw events list
- `GET /api/analytics/links/overview` — Per-link click counts
- `GET /api/analytics/links/[linkId]/detailed` — Detailed link metrics
- `GET /api/analytics/export/[format]` — Export (CSV/JSON)

## Dashboard Components
- Summary cards (total, today, week, month)
- Line chart: Hourly traffic trend (last 24h)
- Bar chart: Top countries
- Doughnut charts: Device types, Browsers
- Table: Recent events with path, destination, time, IP, referrer, UA