# Implementation Tasks: RBAC and SSO Authentication

## Task 1: Database Role Schema
**File:** `supabase/migrations/XXXXXXXX_add_user_roles.sql`
- [ ] Create `user_roles` table with role enum check
- [ ] Enable RLS on `user_roles` table
- [ ] Create RLS policy: users can read own role, admins can read/write all
- [ ] Update `links` RLS policies for role-based access
- [ ] Create `get_user_role()` database function
- [ ] Add index on `user_roles.user_id`
- [ ] Migration tests: apply and verify

## Task 2: RBAC Middleware and Utilities
**Files:** `admin-service/supabase/server/middleware/rbac.ts`, `admin-service/supabase/server/utils/rbac.ts`
- [ ] Define role hierarchy: admin > editor > viewer
- [ ] Create `hasPermission(userRole, requiredRole)` pure function
- [ ] Create `requireRole(event, minRole)` middleware
- [ ] Apply to endpoints: links (editor), analytics export (editor), users (admin), bulk (editor)
- [ ] Update audit.ts to include role in audit entries
- [ ] Unit tests: all permission matrix combinations

## Task 3: User Management UI
**File:** `admin-service/supabase/app/pages/users.vue`
- [ ] List all users with their roles (admin only)
- [ ] Role change dropdown per user
- [ ] Confirmation dialog for role changes
- [ ] Show "Access Denied" for non-admin users
- [ ] Add nav link (visible to admins only)
- [ ] Component tests for role-based rendering

## Task 4: SSO Provider Configuration
**Files:** `admin-service/supabase/app/pages/login.vue`, Supabase dashboard
- [ ] Add Google OAuth login button
- [ ] Add GitHub OAuth login button
- [ ] Implement SSO callback handling
- [ ] Auto-create `viewer` role entry on first login
- [ ] Document Supabase dashboard SSO configuration steps
- [ ] Integration test: SSO login flow
