# Spec: Security & Compliance

## Overview
Security requirements cover configurable HTTP redirect status codes, HSTS enforcement, and GDPR/CCPA-compliant IP address anonymization.

## Requirements

### FR-50: Configurable Redirect Status Code
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST allow configuring the HTTP redirection status code per link.
- **Implementation:** `code` field (301 | 302) on `RedirectRule` in `types.ts`

### FR-51: Supported Status Codes (301/302)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Supported status codes MUST include 301 Moved Permanently and 302 Found (Temporary).
- **Implementation:** TypeScript union type `code: 301 | 302` enforced at type level

### FR-52: Default Status Code (301)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The default status code for new links MUST be 301 Moved Permanently.
- **Implementation:** Default in form state in `index.vue` and `handle-request.ts`

### FR-53: HSTS Enforcement
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST enforce HTTP Strict Transport Security (HSTS) on all responses to ensure secure connections.
- **Implementation:**
  - Per-rule HSTS config: `hsts` field on `RedirectRule`
  - Security middleware: `admin-service/supabase/server/middleware/security.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T10-hsts.test.ts`

### FR-54: HSTS Header Configuration
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The `Strict-Transport-Security` header MUST be set with `max-age=31536000` (1 year), `includeSubDomains`, and `preload`.
- **Implementation:** Configurable via `hsts.maxAge`, `hsts.includeSubDomains`, `hsts.preload` on each rule
- **UI:** HSTS configuration section in `index.vue`

### FR-55: IP Address Anonymization
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support IP Address Anonymization in analytics logs to comply with GDPR/CCPA.
- **Implementation:** SHA-256 hashing in `admin-service/supabase/server/utils/hash.ts`
- **Tests:**
  - `admin-service/supabase/tests/hash.test.ts`
  - `redir-engine/e2e-suite/specs/T08-privacy.test.ts`

### FR-56: Configurable Anonymization Strategy
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The anonymization strategy MUST be configurable, with Hashing as the default method.
- **Implementation:** Hash utility supports configurable strategies; SHA-256 hashing is default
- **Tests:** `admin-service/supabase/tests/hash.test.ts`

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-50 | ✅ | Per-link status code |
| FR-51 | ✅ | 301 and 302 supported |
| FR-52 | ✅ | Default 301 |
| FR-53 | ✅ | HSTS enforcement |
| FR-54 | ✅ | Configurable HSTS headers |
| FR-55 | ✅ | SHA-256 IP hashing |
| FR-56 | ✅ | Configurable anonymization |

## Security Infrastructure
- **Rate Limiting:** `admin-service/supabase/server/middleware/rate-limit.ts` + `server/utils/rate-limit.ts`
- **Security Headers:** `admin-service/supabase/server/middleware/security.ts`
- **Input Sanitization:** `admin-service/supabase/server/utils/sanitizer.ts`
- **Error Handling:** `admin-service/supabase/server/utils/error-handler.ts`
- **Audit Logging:** `admin-service/supabase/server/utils/audit.ts`
- **Authentication:** Supabase Auth with RLS policies in `schema.sql`

## E2E Test Coverage
- `T08-privacy.test.ts` — IP anonymization and privacy
- `T10-hsts.test.ts` — HSTS header enforcement

## Production Gaps
- Distributed rate limiting needed — current implementation is in-memory only and does not work across multiple engine instances (→ CHANGE-012)
- RBAC/SSO not yet implemented — no role-based access control or single sign-on beyond Supabase Auth (→ CHANGE-013)