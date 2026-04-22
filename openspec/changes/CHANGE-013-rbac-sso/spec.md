# Specification: RBAC and SSO Authentication

## Role Model

### Roles
| Role | Description |
|------|-------------|
| **Admin** | Full access: manage links, users, settings, view all analytics |
| **Editor** | Create/edit/delete own links, view own analytics |
| **Viewer** | Read-only access to links and analytics |

### Permission Matrix
| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| Create links | ✅ | ✅ | ❌ |
| Edit own links | ✅ | ✅ | ❌ |
| Edit any links | ✅ | ❌ | ❌ |
| Delete own links | ✅ | ✅ | ❌ |
| Delete any links | ✅ | ❌ | ❌ |
| View own analytics | ✅ | ✅ | ✅ |
| View all analytics | ✅ | ❌ | ❌ |
| Export analytics | ✅ | ✅ | ❌ |
| Manage users/roles | ✅ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ |
| Bulk import | ✅ | ✅ | ❌ |
| System settings | ✅ | ❌ | ❌ |

## Database Schema

### `user_roles` Table
```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

### Updated RLS Policies
```sql
-- Links: Editors see own, Admins see all
CREATE POLICY "editors_own_links" ON public.links
  FOR ALL USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Viewers: read-only
CREATE POLICY "viewers_read_links" ON public.links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid())
  );
```

## SSO Configuration
- **Supabase Auth Providers:** Google, GitHub (OAuth 2.0)
- **Enterprise SAML:** Via Supabase Auth SAML provider (requires Supabase Pro)
- **Default role:** New users default to `viewer`
- **Role assignment:** Admins assign roles via UI

## API Middleware
```typescript
// Role check middleware
async function requireRole(event: H3Event, minRole: 'viewer' | 'editor' | 'admin') {
  const user = await serverSupabaseUser(event)
  const role = await getUserRole(user.id)
  if (!hasPermission(role, minRole)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }
}
```
