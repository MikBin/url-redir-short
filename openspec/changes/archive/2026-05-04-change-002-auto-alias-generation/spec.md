# Specification: Auto-Generated Aliases

## Alias Generation Algorithm
- **Character set:** `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (62 chars, URL-safe)
- **Length:** 7 characters by default
- **Collision resistance:** 62^7 ≈ 3.5 trillion combinations; collision probability negligible
- **Collision handling:** If collision detected, regenerate with retry limit of 3

## Data Flow
```
User submits with empty slug → API detects empty slug → Generate alias → Check uniqueness → Create link
```

## API Changes

### `POST /api/links/create`
- **Current:** `slug` is required
- **New:** `slug` is optional; if empty/omitted, auto-generated
- **Response includes:** Generated slug in response so UI can display it

## UI Changes

### Link Creation Form
- Slug input placeholder: "Leave empty to auto-generate"
- "Generate" button to preview a random slug before submission
- After creation, display the generated slug prominently for copying