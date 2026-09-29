# Implementation Tasks: CSV Bulk Import

## Task 1: CSV Parser Utility
**File:** `admin-service/supabase/server/utils/csv-parser.ts`
- [ ] Implement `parseCsv(input: string): ParseResult` function
- [ ] Handle RFC 4180: quoted fields, escaped quotes, newlines in fields
- [ ] Validate required headers (slug, destination)
- [ ] Return `{ rows: LinkInput[], errors: ParseError[] }`
- [ ] Support optional columns: code, expires_at, max_clicks, password
- [ ] Max row limit: 10,000 with clear error on overflow
- [ ] Unit tests for: valid CSV, missing headers, malformed rows, edge cases

## Task 2: Bulk API CSV Support
**File:** `admin-service/supabase/server/api/bulk.post.ts`
- [ ] Detect `Content-Type: text/csv` or `multipart/form-data`
- [ ] Route to CSV parser when CSV detected, existing JSON logic unchanged
- [ ] Return row-level errors in response
- [ ] Integration test: CSV upload creates links
- [ ] Integration test: CSV with errors returns partial success

## Task 3: UI File Upload
**File:** `admin-service/supabase/app/pages/index.vue`
- [ ] Add file input accepting `.csv`, `.json` to bulk import modal
- [ ] Auto-detect format from file extension
- [ ] Parse CSV client-side for preview before submission
- [ ] Display row-level errors after import attempt
- [ ] Add "Download CSV Template" button
- [ ] Add inline format documentation tooltip

## Review Log
**Date:** 2026-09-29 · **Reviewer:** Kilo review agent (GLM) · **Verdict: NOT STARTED — backlog truthful (0/3 tasks implemented)**

All checkboxes correctly unchecked; verified no `csv-parser.ts`, no CSV handling in `bulk.post.ts`, no CSV in UI. Only CSV in repo is analytics export (`server/api/analytics/export/[format].get.ts:66`).

Findings (apply to the existing JSON bulk path this change builds on):
- `issue (blocking):` `admin-service/supabase/server/api/bulk.post.ts:68-71` — the catch-all re-throws EVERY error as 400, including the explicit 500 `createError` raised at line 47; DB failures are misreported as client errors. Separate rethrow of `createError` instances before the generic 400 wrap.
- `issue (blocking):` `admin-service/supabase/server/api/bulk.post.ts:26-30` — `dataToInsert` silently drops every field except `slug`/`destination`/`owner_id`; Task 1's optional columns (`expires_at`, `max_clicks`, `password`) would be silently lost if the parser fed them here. Carry optional columns explicitly.
- `suggestion (non-blocking):` `admin-service/supabase/server/utils/bulk.ts:11-13` — throws on non-array input but the handler converts that throw into 400 with a raw message; prefer returning `{ valid: [], invalid: [{ error: '...' }] }` for a uniform row-error contract the new CSV parser should reuse.
- `nitpick (non-blocking):` `system-e2e/tests/bulk-import.spec.ts` — happy-path JSON only; when this change lands, add CSV happy/error-path specs and avoid the `ensureHealthyOrSkip` silent-skip pattern for the new journeys.
- `praise:` `validateBulkLinks` is a clean pure function (no I/O, explicit in/out) — exactly the shape the new `parseCsv()` should follow; keep it as the shared post-parse validator.