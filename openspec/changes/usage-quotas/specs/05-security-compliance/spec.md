## MODIFIED Requirements

### Requirement: Registration Rate Control
The system MUST enforce a system-wide daily limit on new user account creation to prevent abuse during the beta phase. The `DAILY_SIGNUP_LIMIT` environment variable configures the maximum number of new accounts that can be created per calendar day (UTC). When the limit is reached, registration SHALL be rejected with HTTP 429 and a clear, user-friendly message.

#### Scenario: Registration accepted below daily limit
- **WHEN** the number of accounts created today is below `DAILY_SIGNUP_LIMIT`
- **THEN** the registration endpoint SHALL process the request normally

#### Scenario: Registration rejected at daily limit
- **WHEN** the number of accounts created today equals or exceeds `DAILY_SIGNUP_LIMIT`
- **THEN** the registration endpoint SHALL return HTTP 429 with message "Daily registration limit reached. Please try again tomorrow."

#### Scenario: Limit resets at midnight UTC
- **WHEN** a new calendar day begins (00:00 UTC)
- **THEN** the daily signup counter effectively resets and registrations are accepted again up to the new day's limit
