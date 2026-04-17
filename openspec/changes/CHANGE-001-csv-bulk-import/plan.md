# Implementation Plan: CSV Bulk Import

## Phase 1: CSV Parser Utility (Day 1)
- [ ] Create `admin-service/supabase/server/utils/csv-parser.ts`
- [ ] Implement RFC 4180 compliant CSV parser (handle quoted fields, escaping)
- [ ] Add header validation (required: slug, destination)
- [ ] Add row-level validation with error collection
- [ ] Write unit tests for parser

## Phase 2: API Integration (Day 2)
- [ ] Update `admin-service/supabase/server/api/bulk.post.ts` to detect CSV content type
- [ ] Add CSV file upload handling via `multipart/form-data`
- [ ] Reuse existing `bulk.ts` utility for database operations
- [ ] Add row-level error response format
- [ ] Write API integration tests

## Phase 3: UI Updates (Day 3)
- [ ] Update bulk import modal in `index.vue` to accept `.csv` files
- [ ] Add file upload input alongside existing JSON textarea
- [ ] Auto-detect format from uploaded file
- [ ] Display row-level errors in UI
- [ ] Add inline CSV format documentation

## Phase 4: Testing & Documentation (Day 4)
- [ ] End-to-end test: CSV upload → links created
- [ ] Test error cases: malformed CSV, missing headers, invalid URLs
- [ ] Test large CSV (10,000 rows) performance
- [ ] Update AGENTS.md with CSV format documentation