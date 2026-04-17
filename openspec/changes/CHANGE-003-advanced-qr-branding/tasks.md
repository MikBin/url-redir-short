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