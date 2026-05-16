## ADDED Requirements

### Requirement: Server-side user registration endpoint
The Supabase admin service SHALL expose `POST /api/auth/register` accepting `{ email: string, password: string, passwordConfirm: string, name?: string }`. The endpoint SHALL use the Supabase service-role client to create the user via `supabase.auth.admin.createUser()`. On success, the endpoint SHALL trigger a magic-link email to the new user and return HTTP 201. The endpoint SHALL be subject to the same rate-limiting middleware as all other API routes.

#### Scenario: Successful registration
- **WHEN** a client POSTs valid `{ email, password, passwordConfirm }` to `/api/auth/register`
- **THEN** the system SHALL create the user in Supabase Auth and return HTTP 201 with `{ message: "Registration successful. Check your email to log in." }`

#### Scenario: Passwords do not match
- **WHEN** `password` and `passwordConfirm` differ
- **THEN** the endpoint SHALL return HTTP 400 with message "Passwords do not match"

#### Scenario: Email already registered
- **WHEN** the provided email already exists in Supabase Auth
- **THEN** the endpoint SHALL return HTTP 409 with message "An account with this email already exists"

#### Scenario: Missing required fields
- **WHEN** `email` or `password` is absent from the request body
- **THEN** the endpoint SHALL return HTTP 400

#### Scenario: Unauthenticated (no session required)
- **WHEN** a client calls `POST /api/auth/register` without an active session
- **THEN** the endpoint SHALL proceed normally (registration does not require prior auth)

### Requirement: Registration UI page
The Supabase admin service SHALL include a `/register` page with a form containing: email input (required), password input (required), confirm-password input (required), optional name input, and a submit button. On success, the page SHALL display a confirmation message. On error, the page SHALL display the server error message inline.

#### Scenario: User navigates to /register
- **WHEN** an unauthenticated user visits `/register`
- **THEN** the registration form SHALL be displayed

#### Scenario: Already-logged-in user redirected
- **WHEN** a logged-in user visits `/register`
- **THEN** they SHALL be redirected to the home page

#### Scenario: Successful form submission
- **WHEN** the user submits valid credentials and the server returns 201
- **THEN** the page SHALL show "Registration successful. Check your email to log in." and clear the form

### Requirement: Login page links to registration
The login page (`/login`) SHALL include a link to the `/register` page. The app navigation (`app.vue`) SHALL show a "Register" link when no user session is active.

#### Scenario: Register link visible on login page
- **WHEN** an unauthenticated user views the login page
- **THEN** a link reading "Don't have an account? Sign up" SHALL be visible and navigate to `/register`
