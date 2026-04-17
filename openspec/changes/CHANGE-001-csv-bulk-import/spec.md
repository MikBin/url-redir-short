# Specification: CSV Bulk Import

## CSV Format

### Required Columns
```csv
slug,destination
my-link,https://example.com/page
another,https://example.org
```

### Optional Columns
```csv
slug,destination,code,expires_at,max_clicks,password
my-link,https://example.com,301,2025-12-31T23:59:59Z,1000,secret123
```

### Full Column Reference
| Column | Required | Type | Example |
|---|---|---|---|
| `slug` | Yes | string (1-2048 chars) | `my-link` |
| `destination` | Yes | valid URL | `https://example.com` |
| `code` | No | 301 or 302 | `301` |
| `expires_at` | No | ISO 8601 datetime | `2025-12-31T23:59:59Z` |
| `max_clicks` | No | positive integer | `1000` |
| `password` | No | string | `secret123` |

## Data Flow
```
CSV File → Parse → Validate Headers → Validate Rows → Transform to Link[] → Existing Bulk Logic
                ↓
         Error Report (row-level)
```

## API Changes

### `POST /api/bulk`
- **Current:** Accepts `Content-Type: application/json` with `{ links: [...] }`
- **New:** Also accepts `Content-Type: text/csv` or `multipart/form-data` with CSV file
- **Response:** Same format, with per-row error details for CSV

### Error Response for CSV
```json
{
  "success": false,
  "created": 5,
  "failed": 2,
  "errors": [
    { "row": 3, "column": "destination", "message": "Invalid URL" },
    { "row": 7, "column": "code", "message": "Must be 301 or 302" }
  ]
}
```

## UI Changes

### Bulk Import Modal
- Add file upload input accepting `.csv` and `.json` files
- Auto-detect format from file extension and content
- Show CSV format documentation inline
- Display row-level errors after import

## Validation Rules
1. First row MUST be headers
2. `slug` and `destination` are mandatory columns
3. Duplicate slugs within the CSV should be reported as errors
4. Invalid URLs in `destination` reported per-row
5. Max 10,000 rows per CSV import