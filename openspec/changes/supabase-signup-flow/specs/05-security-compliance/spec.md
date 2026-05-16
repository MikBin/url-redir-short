## MODIFIED Requirements

### Requirement: Rate Limiting on Auth Endpoints
The system MUST apply rate limiting to all authentication endpoints, including the new `POST /api/auth/register` endpoint. Rate limiting SHALL be enforced via the existing `server/middleware/rate-limit.ts` middleware which applies to all `/api/` routes. The register endpoint SHALL not require any special rate limit configuration beyond what the global middleware already applies.

#### Scenario: Register endpoint subject to rate limiting
- **WHEN** a client makes more than the allowed number of requests to `POST /api/auth/register` within the rate limit window
- **THEN** the system SHALL return HTTP 429 with the standard rate limit exceeded message

#### Scenario: Security headers applied to register endpoint
- **WHEN** any request is made to `POST /api/auth/register`
- **THEN** the response SHALL include all security headers defined in the security middleware (HSTS, X-Frame-Options, CSP, etc.)
