# Spec: Advanced Traffic Routing

## Overview
The Redirector Engine supports advanced traffic routing including A/B testing (probabilistic split testing), language targeting, geo targeting, device-based targeting, and deep linking with mobile app custom schemes.

## Requirements

### FR-13: A/B Testing — Multiple Destinations
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support mapping a single short URL path to multiple destination URLs.
- **Implementation:** `ab_testing` field on `RedirectRule` in `redir-engine/src/core/config/types.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T06-ab-testing.test.ts`

### FR-14: Probabilistic Traffic Distribution
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Traffic distribution MUST be probabilistic/random to ensure statistical equality over large sample sizes while maintaining high edge performance.
- **Implementation:** Weight-based random selection in `redir-engine/src/use-cases/handle-request.ts` (lines 99-110)
- **UI:** Weight input per variation in `admin-service/supabase/app/pages/index.vue`

### FR-15: Variant Tracking for Analytics
- **Priority:** SHOULD
- **Status:** ✅ Implemented
- **Description:** The system SHOULD track which variant (destination) a user was redirected to for analytics purposes.
- **Implementation:** Final destination sent to analytics collector in `handle-request.ts`

### FR-16: Language-Based Routing
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST allow defining different destination URLs based on the user's browser language (parsed from the `Accept-Language` header).
- **Implementation:** `LazyLanguageContext` in `redir-engine/src/core/context/lazy-language-context.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T07-geo-lang-fallback.test.ts`

### FR-17: Fallback URL for Language
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support a Fallback URL that is used if the user's language does not match any specific rules or is undetectable.
- **Implementation:** Default `destination` field on `RedirectRule` serves as fallback; targeting only overrides on match

### FR-18: Geo-Based Routing
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support routing based on the user's geographic location.
- **Implementation:** `checkTarget()` with `country` target in `handle-request.ts`

### FR-19: Edge Platform Header Geo Detection
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Location detection MUST rely on Edge Platform Headers (e.g., `cf-ipcountry`) to avoid the latency overhead of external IP-to-Geo lookup services.
- **Implementation:** `headers.get('cf-ipcountry')` in `handle-request.ts` (line 165)

### FR-20: Country-Level Geo Granularity
- **Priority:** SHOULD
- **Status:** ✅ Implemented
- **Description:** Supported granularity SHOULD include Country, with optional support for Region/City if provided by the edge platform.
- **Implementation:** Country-level matching supported; region/city not yet implemented

### FR-21: Device-Based Routing
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support routing based on the user's device type.
- **Implementation:** `LazyDeviceContext` in `redir-engine/src/core/context/lazy-device-context.ts`

### FR-22: Device Categories (iOS, Android, Desktop)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Required device categories are iOS, Android, and Desktop.
- **Implementation:** UA parsing with iOS/Android/Desktop detection in `LazyDeviceContext`

### FR-23: User-Agent Device Detection
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Device detection MUST be performed by analyzing the `User-Agent` header.
- **Implementation:** `LazyDeviceContext` parses `User-Agent` header

### FR-24: Mobile App Custom Schemes
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support Mobile App Custom Schemes (e.g., `myapp://product/123`) as valid destination URLs.
- **Implementation:** Destination field accepts any URL scheme; no validation restricting to http/https

### FR-25: Fallback Web URLs for Deep Links
- **Priority:** SHOULD
- **Status:** ✅ Implemented
- **Description:** The system SHOULD allow configuring fallback web URLs if the app scheme fails.
- **Implementation:** Can be achieved via targeting rules (device=mobile → app scheme, default → web URL)

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-13 | ✅ | Multiple destinations per path |
| FR-14 | ✅ | Weight-based probabilistic split |
| FR-15 | ✅ | Final destination tracked in analytics |
| FR-16 | ✅ | Accept-Language parsing |
| FR-17 | ✅ | Default destination as fallback |
| FR-18 | ✅ | Country-based routing |
| FR-19 | ✅ | cf-ipcountry header |
| FR-20 | ✅ | Country level; region/city not yet |
| FR-21 | ✅ | Device-based routing |
| FR-22 | ✅ | iOS/Android/Desktop categories |
| FR-23 | ✅ | UA header parsing |
| FR-24 | ✅ | Custom scheme support |
| FR-25 | ✅ | Via targeting rules |

## E2E Test Coverage
- `T05-priority-logic.test.ts` — Targeting priority over A/B testing
- `T06-ab-testing.test.ts` — A/B split testing
- `T07-geo-lang-fallback.test.ts` — Geo and language targeting with fallback

## Targeting Preview UI
- Real-time preview in `admin-service/supabase/app/pages/index.vue` (Preview Routing section)
- Client-side targeting logic: `admin-service/supabase/app/utils/targeting.ts`
- Unit tests: `admin-service/supabase/tests/targeting.test.ts`