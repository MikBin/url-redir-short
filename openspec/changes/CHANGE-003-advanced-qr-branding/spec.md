# Specification: Advanced QR Code Branding

## Enhanced QR Options

### Error Correction Levels
| Level | Recovery | Use Case |
|---|---|---|
| L (Low) | 7% | Simple codes, no logo |
| M (Medium) | 15% | Default, light customization |
| Q (Quartile) | 25% | With small logo |
| H (High) | 30% | With large logo overlay |

### Logo Embedding
- Accept logo as base64 PNG/SVG or URL
- Logo size: 10-30% of QR code area
- Positioning: center (default), top-left, top-right, bottom-left, bottom-right
- Auto-select error correction H when logo present

### Caching
- Cache key: hash of (url + options)
- Store as PNG in Supabase Storage bucket `qr-codes`
- TTL: 24 hours, invalidated on link update
- Serve cached version on subsequent requests

## API Changes

### `GET /api/qr`
New query parameters:
- `errorCorrection` — L, M, Q, H (default: M)
- `logoUrl` — URL of logo to embed
- `logoSize` — 10-30 (percentage, default: 20)
- `logoPosition` — center, top-left, top-right, bottom-left, bottom-right

### Response
- First request: generates, caches, returns PNG
- Subsequent requests: serves from cache
- Headers: `X-Cache: HIT` or `X-Cache: MISS`