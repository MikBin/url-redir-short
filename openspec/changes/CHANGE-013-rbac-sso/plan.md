# Implementation Plan: RBAC and SSO Authentication

## Phase 1: Role Model and Database
- [ ] Create `user_roles` table migration
- [ ] Update RLS policies on `links` table for role-based access
- [ ] Update RLS policies on `analytics_events` table
- [ ] Create database function `get_user_role(user_id)`
- [ ] Seed initial admin user role

## Phase 2: API Role Enforcement
- [ ] Create role-check middleware `server/middleware/rbac.ts`
- [ ] Create utility `server/utils/rbac.ts` with permission checks
- [ ] Apply role checks to all API endpoints
- [ ] Update audit logging to include role
- [ ] Unit tests for permission matrix

## Phase 3: Admin UI — Role Management
- [ ] Create `app/pages/users.vue` for user/role management
- [ ] Add role selector for each user
- [ ] Show current user's role in navbar
- [ ] Conditionally show/hide UI elements based on role
- [ ] Component tests for role-based UI

## Phase 4: SSO Configuration
- [ ] Configure Supabase Auth Google provider
- [ ] Configure Supabase Auth GitHub provider
- [ ] Update login page with SSO buttons
- [ ] Add default role assignment on first login
- [ ] Document SAML setup for enterprise (Supabase Pro)
