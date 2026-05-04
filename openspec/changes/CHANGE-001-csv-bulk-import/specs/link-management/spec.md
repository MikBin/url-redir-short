# Delta Spec: CSV Bulk Import Format

## MODIFIED Requirements

### Requirement: FR-29 - CSV Bulk Import Format
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Supported formats for bulk import MUST include JSON and CSV.
- **Implementation:** Added `papaparse` for CSV parsing in `admin-service/supabase/server/api/bulk.post.ts`. UI updated to accept `.csv` files and show mapping errors.
- **Tests:** `admin-service/supabase/tests/bulk-csv.test.ts`

#### Scenario: Successful CSV Bulk Import
Given a CSV file with columns `slug`, `destination`, and `expires_at`
When a user uploads the CSV through the bulk import modal
Then the system MUST parse all valid rows
And it MUST create or update the corresponding link rules
And it MUST return a summary of successful and failed rows

#### Scenario: CSV Import with Missing Headers
Given a CSV file missing the mandatory `destination` header
When the file is uploaded
Then the system MUST reject the import
And it MUST provide a clear error message indicating the missing header
