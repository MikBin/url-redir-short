# Spec: Link Management & Features

## Overview
Link management covers URL generation (manual and auto), bulk operations (JSON/CSV), QR code generation with customization, link expiration (time-based and click-based), and password protection.

## Requirements

### FR-26: Custom Aliases (Manual Entry)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Users MUST be able to define custom aliases (paths) for their links.
- **Implementation:** Slug input field in `admin-service/supabase/app/pages/index.vue`
- **API:** `POST /api/links/create` in `admin-service/supabase/server/api/links/create.post.ts`

### FR-27: Autogeneration of Aliases
- **Priority:** MUST
- **Status:** ⚠️ Partial
- **Description:** The system MUST provide an Autogeneration feature to create short, random, collision-resistant aliases.
- **Implementation:** Types support it but no visible auto-generation logic
- **See Also:** `openspec/changes/CHANGE-002-auto-alias-generation/`

### FR-28: Bulk Insert/Update
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support Bulk Insert/Update of URL rules.
- **Implementation:**
  - API: `POST /api/bulk` in `admin-service/supabase/server/api/bulk.post.ts`
  - UI: Bulk Import modal in `index.vue`
  - Utility: `admin-service/supabase/server/utils/bulk.ts`
- **Tests:** `admin-service/supabase/tests/bulk.test.ts`

### FR-29: CSV Bulk Import Format
- **Priority:** MUST
- **Status:** ❌ Not Implemented
- **Description:** Supported formats for bulk import MUST include JSON and CSV.
- **Current:** JSON only
- **See Also:** `openspec/changes/CHANGE-001-csv-bulk-import/`

### FR-30: Bulk Operations via API and UI
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Bulk operations MUST be accessible via the Admin API and the User Interface.
- **Implementation:** API endpoint + UI modal (JSON format)

### FR-31: QR Code Generation
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST generate QR codes for any managed link.
- **Implementation:**
  - API: `GET /api/qr` in `admin-service/supabase/server/api/qr.get.ts`
  - UI: QR modal in `index.vue`
  - Utility: `admin-service/supabase/server/utils/qr.ts`
- **Tests:** `admin-service/supabase/tests/qr.test.ts`

### FR-32: QR Code Advanced Customization
- **Priority:** MUST
- **Status:** ⚠️ Partial
- **Description:** QR Code generation MUST support Advanced Customization (e.g., custom colors, embedded logos, error correction levels).
- **Current:** Basic customization (color, background, size, margin); no embedded logos or error correction settings
- **See Also:** `openspec/changes/CHANGE-003-advanced-qr-branding/`

### FR-33: On-Demand QR Generation API
- **Priority:** SHOULD
- **Status:** ✅ Implemented
- **Description:** QR Codes SHOULD be available via an on-demand generation API.
- **Implementation:** `GET /api/qr` endpoint

### FR-34: QR Code Storage/Caching
- **Priority:** MAY
- **Status:** ❌ Not Implemented
- **Description:** The system MAY support storing generated QR code images for caching purposes.
- **Current:** On-demand generation only
- **See Also:** `openspec/changes/CHANGE-003-advanced-qr-branding/`

### FR-35: Time-Based Link Expiration
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support link expiration based on Time-To-Live (specific date/time or duration).
- **Implementation:** `expiresAt` field on `RedirectRule`; checked in `handle-request.ts`
- **UI:** datetime-local input in `index.vue`
- **Tests:** `redir-engine/e2e-suite/specs/T11-expiration.test.ts`

### FR-36: Click-Based Link Expiration
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support link expiration based on a Maximum Click/Redirect Count.
- **Implementation:** `maxClicks` and `clicks` fields on `RedirectRule`; checked in `handle-request.ts`
- **UI:** Max Clicks input in `index.vue`

### FR-37: Eventual Consistency for Click Counts
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** For click-based expiration, Eventual Consistency is acceptable. A slight margin of error (overshoot) is permitted to maintain edge performance.
- **Implementation:** Click counter updated via async analytics, not locked

### FR-38: Expired Link Behavior
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Expired links MUST return a 404 Not Found or redirect to a designated "Expired" page.
- **Implementation:** Returns `null` (404) when expired in `handle-request.ts`

### FR-39: Password-Protected Links
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support password-protecting specific links.
- **Implementation:** `password_protection` field on `RedirectRule`
- **UI:** Password protection section in `index.vue`
- **Tests:** `redir-engine/e2e-suite/specs/T09-password-protection.test.ts`

### FR-40: Intermediate Password Form
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** When a user accesses a password-protected link, the Redirector Engine MUST serve an intermediate HTML page containing a password input form.
- **Implementation:** `password_required` result type in `handle-request.ts`; HTML form served by HTTP adapter

### FR-41: Password Validation Before Redirect
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The actual redirection to the destination MUST only occur after successful validation of the entered password.
- **Implementation:** Password comparison in `handle-request.ts` (lines 63-79)

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-26 | ✅ | Custom slug input |
| FR-27 | ⚠️ | No auto-generation logic → CHANGE-002 |
| FR-28 | ✅ | JSON bulk import |
| FR-29 | ❌ | CSV format missing → CHANGE-001 |
| FR-30 | ✅ | API + UI bulk ops |
| FR-31 | ✅ | QR code generation |
| FR-32 | ⚠️ | Basic only, no logos → CHANGE-003 |
| FR-33 | ✅ | On-demand API |
| FR-34 | ❌ | No caching → CHANGE-003 |
| FR-35 | ✅ | Time-based expiration |
| FR-36 | ✅ | Click-based expiration |
| FR-37 | ✅ | Eventual consistency |
| FR-38 | ✅ | Returns 404 when expired |
| FR-39 | ✅ | Password protection |
| FR-40 | ✅ | Intermediate HTML form |
| FR-41 | ✅ | Password validation |

## E2E Test Coverage
- `T09-password-protection.test.ts` — Password protection flow
- `T11-expiration.test.ts` — Time and click-based expiration
- `T09-extended.test.ts` — Extended feature tests