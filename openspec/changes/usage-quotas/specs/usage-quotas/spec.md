## ADDED Requirements

### Requirement: Operator-configurable global quota defaults
The system SHALL read default quota values from environment variables at startup. The following variables SHALL be supported: `MAX_LINKS_PER_USER` (integer, default 500), `MAX_DOMAINS_PER_USER` (integer, default 5), `DAILY_SIGNUP_LIMIT` (integer, default 50). Both the Supabase and PocketBase admin services SHALL read these variables from their respective `server/utils/config.ts` via Zod-validated env schema.

#### Scenario: Default limits applied when no per-user override exists
- **WHEN** a user has no row in `user_quotas` table
- **THEN** the system SHALL apply the env-var defaults as that user's effective limits

#### Scenario: Missing env var uses built-in default
- **WHEN** `MAX_LINKS_PER_USER` is not set in the environment
- **THEN** the system SHALL apply a default of 500 links per user without error

### Requirement: Per-user quota override storage
The system SHALL store per-user quota overrides in a `user_quotas` table (Supabase) or equivalent PocketBase collection with fields: `user_id` (reference to user), `max_links` (nullable integer), `max_domains` (nullable integer). A `null` value for any field means "use the env-var default."

#### Scenario: Override applied for specific user
- **WHEN** a superadmin sets `max_links = 1000` for a given user
- **THEN** that user's effective link limit SHALL be 1000 regardless of the env default

#### Scenario: Partial override inherits remaining defaults
- **WHEN** a user has `max_links = 1000` but no `max_domains` override
- **THEN** their domain limit SHALL be the env-var default

### Requirement: Daily registration rate limit
The system SHALL enforce a daily cap on new user registrations. When the number of users created since midnight UTC today meets or exceeds `DAILY_SIGNUP_LIMIT`, the registration endpoint SHALL reject new registrations.

#### Scenario: Registration blocked when daily limit reached
- **WHEN** `DAILY_SIGNUP_LIMIT` is 50 and 50 users have registered today
- **THEN** `POST /api/auth/register` SHALL return HTTP 429 with message "Daily registration limit reached. Please try again tomorrow."

#### Scenario: Registration succeeds below daily limit
- **WHEN** fewer registrations than `DAILY_SIGNUP_LIMIT` have occurred today
- **THEN** registration SHALL proceed normally

### Requirement: Per-user link creation quota enforcement
Before inserting a new link, the system SHALL count the authenticated user's existing links. If the count meets or exceeds the user's effective `max_links` limit, the request SHALL be rejected.

#### Scenario: Link creation blocked at limit
- **WHEN** a user has reached their `max_links` quota
- **THEN** `POST /api/links` SHALL return HTTP 429 with message "Link quota reached. You have used X of Y allowed links."

#### Scenario: Link creation succeeds below limit
- **WHEN** a user's link count is below their effective limit
- **THEN** link creation SHALL proceed normally

### Requirement: Per-user domain creation quota enforcement
Before inserting a new domain, the system SHALL count the authenticated user's existing domains. If the count meets or exceeds the user's effective `max_domains` limit, the request SHALL be rejected.

#### Scenario: Domain creation blocked at limit
- **WHEN** a user has reached their `max_domains` quota
- **THEN** `POST /api/domains` SHALL return HTTP 429 with message "Domain quota reached. You have used X of Y allowed domains."

#### Scenario: Domain creation succeeds below limit
- **WHEN** a user's domain count is below their effective limit
- **THEN** domain creation SHALL proceed normally

### Requirement: Current quota status API endpoint
The system SHALL expose `GET /api/quota/me` (authenticated) returning the current user's quota status in both admin services. The response SHALL include: `links.used` (integer), `links.max` (integer), `domains.used` (integer), `domains.max` (integer).

#### Scenario: Authenticated user retrieves their quota
- **WHEN** an authenticated user calls `GET /api/quota/me`
- **THEN** the system SHALL return their current usage and effective limits

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated request hits `GET /api/quota/me`
- **THEN** the system SHALL return HTTP 401
