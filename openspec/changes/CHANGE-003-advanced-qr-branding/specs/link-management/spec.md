# Delta Spec: Advanced QR Code Branding

## MODIFIED Requirements

### Requirement: FR-32: QR Code Advanced Customization
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** QR Code generation MUST support Advanced Customization (e.g., custom colors, embedded logos, error correction levels).
- **Implementation:** Updated `admin-service/supabase/server/api/qr.get.ts` to support `logo` (base64) and `errorCorrectionLevel` parameters. UI added an advanced panel to the QR modal.
- **Tests:** `admin-service/supabase/tests/qr-advanced.test.ts`

#### Scenario: Generate QR Code with Logo
Given a link slug
When the user requests a QR code with an embedded logo
Then the system MUST overlay the logo in the center of the QR code
And it MUST use a high error correction level (H) to ensure readability

### Requirement: FR-34: QR Code Storage/Caching
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system SHALL support storing generated QR code images for caching purposes.
- **Implementation:** QR codes are cached in a dedicated `qr-codes` bucket in Supabase storage, keyed by a hash of their parameters.
- **Tests:** `admin-service/supabase/tests/qr-cache.test.ts`

#### Scenario: Cache Hit for QR Generation
Given a previously generated QR code with specific colors and logo
When a user requests the exact same QR code configuration
Then the system MUST serve the image from the cache bucket
And it MUST NOT perform a fresh QR generation operation
