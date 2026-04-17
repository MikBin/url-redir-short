# Implementation Plan: Advanced QR Code Branding

## Phase 1: QR Library Upgrade (Day 1)
- [ ] Evaluate and add QR library with logo support (e.g., `sharp` + `qrcode` or `qr-code-styling`)
- [ ] Implement error correction level support
- [ ] Implement logo overlay compositing
- [ ] Unit tests for each error correction level

## Phase 2: Caching Layer (Day 2)
- [ ] Create Supabase Storage bucket `qr-codes`
- [ ] Implement cache key generation (hash of url + options)
- [ ] Cache write on generation, cache read on request
- [ ] Add `X-Cache` header to response
- [ ] Cache invalidation on link update
- [ ] Integration tests for cache hit/miss

## Phase 3: API Updates (Day 2)
- [ ] Add new query parameters to `GET /api/qr` (errorCorrection, logoUrl, logoSize, logoPosition)
- [ ] Zod validation for new params
- [ ] Backward compatible — existing calls work unchanged
- [ ] API integration tests

## Phase 4: UI Advanced Panel (Day 3)
- [ ] Expand QR modal with advanced customization section
- [ ] Error correction level dropdown
- [ ] Logo URL input with preview
- [ ] Logo size slider (10-30%)
- [ ] Live QR preview updates
- [ ] Test all combinations