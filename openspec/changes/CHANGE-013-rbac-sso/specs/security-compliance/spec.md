# Delta Spec: RBAC and SSO Authentication

## ADDED Requirements

### Requirement: FR-60 - Role-Based Access Control (RBAC)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support multiple user roles (Admin, Editor, Viewer) with distinct permission boundaries enforced via RLS.
- **Implementation:** Added `user_roles` table in Supabase. Updated RLS policies to check `auth.uid()` role. UI displays management interface for admins.
- **Tests:** `admin-service/supabase/tests/rbac.test.ts`

#### Scenario: Admin Access to Role Management
Given a user with the `Admin` role
When they access the team management dashboard
Then they MUST be able to view, edit, and assign roles to other team members

#### Scenario: Viewer Access Restriction
Given a user with the `Viewer` role
When they attempt to delete a link via the API
Then the system MUST return a 403 Forbidden response
And the audit log MUST record the unauthorized attempt

### Requirement: FR-61 - Single Sign-On (SSO) Support
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST support enterprise SSO providers via Supabase Auth.
- **Implementation:** Configured Google, GitHub, and SAML providers. Added dynamic login buttons to the login page.
- **Tests:** Manual verification of OAuth flows

#### Scenario: Successful SSO Login
Given a user from a configured enterprise domain
When they sign in using their enterprise SSO provider
Then the system MUST automatically provision a user account with the default `Viewer` role
And it MUST redirect them to the dashboard upon success
