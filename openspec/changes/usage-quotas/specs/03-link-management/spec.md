## MODIFIED Requirements

### Requirement: Link Creation
The system MUST allow authenticated users to create short links with a slug, destination URL, and optional settings (expiration, password, targeting, A/B testing). Link creation now enforces per-user quota limits.

A link creation request SHALL be rejected with HTTP 429 if the user's current link count meets or exceeds their effective `max_links` quota (from `user_quotas` override or `MAX_LINKS_PER_USER` env var default). The error response SHALL include a human-readable message indicating current usage and the limit.

#### Scenario: Successful link creation below quota
- **WHEN** an authenticated user submits a valid link creation request and their link count is below the quota
- **THEN** the system SHALL create the link and return HTTP 201 with the created link data

#### Scenario: Link creation rejected at quota
- **WHEN** an authenticated user submits a link creation request and their link count equals or exceeds `max_links`
- **THEN** `POST /api/links` SHALL return HTTP 429 with body `{ "message": "Link quota reached. You have used X of Y allowed links." }`

#### Scenario: Unauthenticated request still rejected with 401
- **WHEN** an unauthenticated request hits `POST /api/links`
- **THEN** the system SHALL return HTTP 401 (quota check is not performed)
