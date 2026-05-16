## ADDED Requirements

### Requirement: Superadmin user list with usage stats
The system SHALL provide a `/admin` page (both admin services) accessible only to superadmin users, listing all registered users with their current resource usage: links count, domains count, effective link limit, effective domain limit.

#### Scenario: Superadmin views user list
- **WHEN** a superadmin navigates to `/admin`
- **THEN** the page SHALL display a table of all users with columns: email, links used, links max, domains used, domains max

#### Scenario: Non-superadmin access blocked
- **WHEN** a regular user navigates to `/admin`
- **THEN** the system SHALL redirect to the main page or return HTTP 403

### Requirement: Per-user quota override via admin UI
The superadmin SHALL be able to edit the `max_links` and `max_domains` values for any individual user from the `/admin` page without redeploying the service.

#### Scenario: Superadmin updates a user's link limit
- **WHEN** a superadmin edits a user's link limit to 1000 and saves
- **THEN** the system SHALL persist the override in `user_quotas` and the user's effective limit SHALL be 1000

#### Scenario: Superadmin resets a user quota to default
- **WHEN** a superadmin clears a user's override (sets to null/empty)
- **THEN** the system SHALL apply the env-var default for that user

### Requirement: Admin quota management API
The system SHALL expose superadmin-only endpoints: `GET /api/admin/users` (list users with usage) and `PATCH /api/admin/users/:id/quota` (update per-user overrides). Both SHALL require superadmin authentication and return HTTP 403 for non-superadmin callers.

#### Scenario: Superadmin fetches user list via API
- **WHEN** a superadmin calls `GET /api/admin/users`
- **THEN** the response SHALL include each user's id, email, links_used, domains_used, max_links, max_domains

#### Scenario: Superadmin updates quota via API
- **WHEN** a superadmin calls `PATCH /api/admin/users/:id/quota` with `{ "max_links": 200 }`
- **THEN** the system SHALL update the user's quota and return the updated values

#### Scenario: Non-superadmin quota update rejected
- **WHEN** a regular user calls `PATCH /api/admin/users/:id/quota`
- **THEN** the system SHALL return HTTP 403
