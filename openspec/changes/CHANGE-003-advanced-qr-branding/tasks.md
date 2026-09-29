# Implementation Tasks: Advanced QR Code Branding

## Task 1: QR Generation with Logo Support
**File:** `admin-service/supabase/server/utils/qr.ts`
- [ ] Add error correction level parameter (L/M/Q/H)
- [ ] Implement logo overlay compositing using `sharp`
- [ ] Validate logo dimensions (max 30% of QR area)
- [ ] Auto-upgrade error correction to H when logo present
- [ ] Unit tests for each level, logo overlay, edge cases

## Task 2: QR Caching Layer
**File:** `admin-service/supabase/server/utils/qr-cache.ts`
- [ ] Generate cache key: `sha256(url + JSON.stringify(options))`
- [ ] Store generated PNG in Supabase Storage bucket `qr-codes`
- [ ] Check cache before generating, serve from cache if hit
- [ ] Add `X-Cache: HIT/MISS` response header
- [ ] Invalidate cache on link update/delete
- [ ] Integration tests: cache miss → generate → cache hit

## Task 3: API Parameter Updates
**File:** `admin-service/supabase/server/api/qr.get.ts`
- [ ] Add Zod schema for new params (errorCorrection, logoUrl, logoSize, logoPosition)
- [ ] Pass new options to QR generator
- [ ] Return cached or freshly generated QR
- [ ] Maintain backward compatibility (all new params optional)

## Task 4: UI Advanced Customization Panel
**File:** `admin-service/supabase/app/pages/index.vue`
- [ ] Add error correction level dropdown (L/M/Q/H, default M)
- [ ] Add logo URL input field
- [ ] Add logo size slider (10-30%, default 20%)
- [ ] Live QR preview with all options applied
- [ ] "Download QR" button for saving generated image

## Review Log
**Date:** 2026-09-29 · **Reviewer:** Kilo review agent (GLM) · **Verdict: NOT STARTED — backlog truthful (0/4 tasks implemented)**

All checkboxes correctly unchecked. Verified: `server/utils/qr.ts` (17 lines) has no error-correction/logo/sharp support, `qr-cache.ts` does not exist, `qr.get.ts` accepts only width/margin/color.

Findings (existing QR surface this change will touch):
- `issue (blocking):` `admin-service/supabase/server/api/qr.get.ts:1` — file opens with blanket `/* eslint-disable */`, disabling ALL rules including `no-explicit-any` and strict-TS assists; `query.text as string` casts (lines 12, 24, 28, 34, 37) bypass validation. Task 3 mandates a Zod schema — implement it and remove the suppression instead of extending the disabled file.
- `suggestion (non-blocking):` `admin-service/supabase/server/api/qr.get.ts:41-50` — QR generation errors return a bare 500 with no cause; when adding logo compositing (external logoUrl fetch → new failure modes), propagate a typed error payload so the UI can distinguish bad logo URL vs generation failure.
- `thought (non-blocking):` `qr.get.ts` has no rate-limit-specific config beyond the `/api` default (30/min, `server/middleware/rate-limit.ts:19`) — QR generation with logo compositing via `sharp` is CPU-heavy; consider a stricter bucket before shipping Task 1.
- `nitpick (non-blocking):` tests exist (`tests/unit/api/qr.test.ts`) but only cover the current 3 params; AGENTS.md mandates new tests per feature — keep Task 1/2 test checkboxes honest when implemented.