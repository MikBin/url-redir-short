## ADDED Requirements

### Requirement: Quota usage indicator in dashboard
The main links dashboard (index page) in both admin services SHALL display a quota usage bar showing the user's current link and domain counts relative to their limits. The indicator SHALL be visible without scrolling and update on page load.

#### Scenario: User sees quota bar below limit
- **WHEN** a user has 45 links out of 100 allowed
- **THEN** the dashboard SHALL display a progress bar at 45% with text "45 / 100 links used"

#### Scenario: User at quota limit sees warning
- **WHEN** a user has reached their link limit
- **THEN** the quota bar SHALL display in a warning state (e.g., red/amber color) and the "Create Link" button SHALL be disabled with tooltip "Link quota reached"

#### Scenario: Quota bar data fetched on mount
- **WHEN** the dashboard page mounts
- **THEN** the page SHALL call `GET /api/quota/me` and render the QuotaBar component with the returned values

### Requirement: Graceful display when quota data unavailable
If the `GET /api/quota/me` call fails, the dashboard SHALL render without the quota bar and SHALL NOT block the main link list from loading.

#### Scenario: Quota API error does not break dashboard
- **WHEN** `GET /api/quota/me` returns an error
- **THEN** the dashboard SHALL show the link list normally with the quota bar hidden
