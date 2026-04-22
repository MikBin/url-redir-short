# Change Proposal: RBAC and SSO Authentication

## Problem
The Admin Service uses basic Supabase Auth with no role differentiation. All authenticated users have the same permissions. There is no support for enterprise SSO (SAML, OIDC) or team management.

## Opportunity
Adding role-based access control (RBAC) and SSO support enables team collaboration with appropriate permission boundaries and enterprise-ready authentication.

## Success Metrics
- At least 3 roles defined: Admin, Editor, Viewer
- RLS policies enforce role-based data access
- SSO integration via Supabase Auth providers (Google, GitHub, SAML)
- Team/organization management in Admin UI
- Audit log entries include acting user's role

## Scope
- Define role model and permissions matrix
- Update RLS policies for role-based access
- Add role management UI in Admin Service
- Configure Supabase Auth SSO providers
- Update audit logging to include role context
