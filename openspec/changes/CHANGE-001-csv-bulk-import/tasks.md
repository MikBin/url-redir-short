# Implementation Tasks: CSV Bulk Import

## Task 1: CSV Parser Utility
**File:** `admin-service/supabase/server/utils/csv-parser.ts`
- [x] Implement `parseCsv(input: string): ParseResult` function
- [x] Handle RFC 4180: quoted fields, escaped quotes, newlines in fields
- [x] Validate required headers (slug, destination)
- [x] Return `{ rows: LinkInput[], errors: ParseError[] }`
- [x] Support optional columns: code, expires_at, max_clicks, password
- [x] Max row limit: 10,000 with clear error on overflow
- [x] Unit tests for: valid CSV, missing headers, malformed rows, edge cases

## Task 2: Bulk API CSV Support
**File:** `admin-service/supabase/server/api/bulk.post.ts`
- [x] Detect `Content-Type: text/csv` or `multipart/form-data`
- [x] Route to CSV parser when CSV detected, existing JSON logic unchanged
- [x] Return row-level errors in response
- [x] Integration test: CSV upload creates links
- [x] Integration test: CSV with errors returns partial success

## Task 3: UI File Upload
**File:** `admin-service/supabase/app/pages/index.vue`
- [x] Add file input accepting `.csv`, `.json` to bulk import modal
- [x] Auto-detect format from file extension
- [x] Parse CSV client-side for preview before submission
- [x] Display row-level errors after import attempt
- [x] Add "Download CSV Template" button
- [x] Add inline format documentation tooltip