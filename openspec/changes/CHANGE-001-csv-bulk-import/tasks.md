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