# Implementation Tasks: Advanced QR Code Branding

## Task 1: QR Generation with Logo Support
**File:** `admin-service/supabase/server/utils/qr.ts`
- [x] Add error correction level parameter (L/M/Q/H)
- [x] Implement logo overlay compositing using `sharp`
- [x] Validate logo dimensions (max 30% of QR area)
- [x] Auto-upgrade error correction to H when logo present
- [x] Unit tests for each level, logo overlay, edge cases

## Task 2: QR Caching Layer
**File:** `admin-service/supabase/server/utils/qr-cache.ts`
- [x] Generate cache key: `sha256(url + JSON.stringify(options))`
- [x] Store generated PNG in Supabase Storage bucket `qr-codes`
- [x] Check cache before generating, serve from cache if hit
- [x] Add `X-Cache: HIT/MISS` response header
- [x] Invalidate cache on link update/delete
- [x] Integration tests: cache miss → generate → cache hit

## Task 3: API Parameter Updates
**File:** `admin-service/supabase/server/api/qr.get.ts`
- [x] Add Zod schema for new params (errorCorrection, logoUrl, logoSize, logoPosition)
- [x] Pass new options to QR generator
- [x] Return cached or freshly generated QR
- [x] Maintain backward compatibility (all new params optional)

## Task 4: UI Advanced Customization Panel
**File:** `admin-service/supabase/app/pages/index.vue`
- [x] Add error correction level dropdown (L/M/Q/H, default M)
- [x] Add logo URL input field
- [x] Add logo size slider (10-30%, default 20%)
- [x] Live QR preview with all options applied
- [x] "Download QR" button for saving generated image