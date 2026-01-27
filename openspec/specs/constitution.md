# Constitution: URL Redirector System

> **Non-negotiable principles that guide all development.**  
> Reference this before, during, and after every change.

---

## 🏗️ Architecture Principles

### Domain-Driven Design (Mandatory)
- **Domain Logic:** Isolated in `src/core/` (engines, filters, analytics)
- **Use Cases:** Business logic in `src/use-cases/`
- **Adapters:** Infrastructure (HTTP, SSE, databases) in `src/adapters/`
- **No Mixing:** Business logic never imports from adapters

**Example:**
```typescript
// ✅ Good: Core logic, no dependencies on adapters
src/core/analytics/collector.ts
src/use-cases/handle-request.ts

// ❌ Wrong: Core logic depending on HTTP
src/core/request-handler.ts (imports from adapters/http/)
```

### Clean Architecture
- Controllers/routes receive requests
- Use cases orchestrate business logic
- Adapters handle infrastructure concerns
- Dependency injection for testability

### Type Safety (NON-NEGOTIABLE)
```typescript
// TypeScript strict mode ALWAYS
"strict": true,
"noAny": true,
"noImplicitThis": true
```

No `any` types without **explicit justification**:
```typescript
// ❌ Forbidden
const data: any = JSON.parse(str);

// ✅ Acceptable (with comment)
// We trust serverSupabaseUser() type safety
const user = await serverSupabaseUser(event) as unknown as ExtendedUser;
```

---

## ✅ Code Quality Standards

### Test Coverage
- **Minimum:** 80% for new code
- **E2E Tests:** All API endpoints must have E2E tests
- **Unit Tests:** Core logic (analytics, filtering) requires unit tests
- **Framework:** Vitest for all tests

**Before Merging:**
```bash
npm test          # All tests pass
npx tsc --noEmit  # Zero TypeScript errors
npm run lint      # No linting issues
```

### Logging (NON-NEGOTIABLE)
All errors must use `createLogger()` with correlation IDs:

```typescript
import { createLogger } from '~/server/utils/logger'

const logger = createLogger({ userId, path: event.node.req.url })

try {
  // ... code
} catch (err) {
  logger.error('Database query failed', { query, params }, err)
  // Automatically includes: timestamp, correlationId, userId, path
}
```

**Why:** Debugging distributed systems requires correlation IDs.  
**Never:** `console.error()` or `throw` without logging first.

### Error Handling (NON-NEGOTIABLE)
Always use `createError()` from error-handler utility:

```typescript
import { handleError } from '~/server/utils/error-handler'

// ❌ Wrong: Raw throw
throw new Error('Not found')

// ✅ Correct: Structured error
throw createError({
  statusCode: 404,
  statusMessage: 'Link not found',
  data: { linkId }
})
```

### Input Validation (NON-NEGOTIABLE)
All API inputs validated with Zod:

```typescript
import { z } from 'zod'

const CreateLinkSchema = z.object({
  slug: z.string().min(1).max(2048).url(),
  destination: z.string().url(),
  targeting: z.record(z.unknown()).optional()
})

// In endpoint
const validated = CreateLinkSchema.parse(body) // throws on invalid
```

---

## 🔐 Security (NON-NEGOTIABLE)

### Authentication
All protected endpoints require authentication:

```typescript
const user = await serverSupabaseUser(event)
if (!user) {
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}
```

### Rate Limiting
Applied via middleware to all public endpoints:
- Analytics ingestion: **100 requests/minute per IP**
- Admin endpoints: **10 requests/minute per IP**
- Public endpoints: **30 requests/minute per IP**

No endpoint bypasses rate limiting.

### Input Sanitization
```typescript
// ❌ Never trust user input
const url = req.body.url

// ✅ Always validate and sanitize
import { sanitizeUrl } from '~/server/utils/sanitizer'
const url = sanitizeUrl(req.body.url)
```

### Security Headers (Always Applied)
Via `server/middleware/security.ts`:
- HSTS: max-age 1 year, includeSubDomains, preload
- CSP: Content Security Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

### RLS Policies (Database)
All tables with user data MUST have RLS enabled:

```sql
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their links"
ON public.links FOR SELECT
USING (auth.uid() = owner_id);
```

---

## ⚡ Performance Standards

### Database Queries
```typescript
// ❌ Wrong: Fetches 10,000+ rows into memory
const { data } = await client.from('events').select('*')

// ✅ Correct: Just get count
const { count } = await client.from('events').select('*', { count: 'exact', head: true })

// ✅ Correct: Paginate when needed
const { data } = await client
  .from('events')
  .select('*')
  .range(0, 99)  // First 100 items
```

### API Response Size
- Paginate lists > 100 items
- Use `select()` to limit columns
- Compress large responses

### Caching Headers
Read endpoints should include cache headers:

```typescript
event.node.res.setHeader('Cache-Control', 'public, max-age=300') // 5 min
```

---

## 👁️ Observability (NON-NEGOTIABLE)

### Structured Logging
All logs must be JSON format:

```json
{
  "timestamp": "2025-01-25T10:30:45.123Z",
  "level": "error",
  "service": "admin-service",
  "message": "Database connection failed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "context": {
    "userId": "user-123",
    "duration": 1250
  }
}
```

### Metrics Tracking
Track per endpoint:
- Request count
- Error count
- Response latency (min, max, avg)
- Request size (bytes)

### Health Checks
Critical services must implement health checks:
- Database connectivity
- Memory usage
- Service readiness

---

## 🛠️ Technology Stack (NON-NEGOTIABLE)

### Runtime & Framework
- **Node.js 20+** with Nitro (Nuxt server engine)
- **Never use:** Flask, Express, Django (not part of stack)

### Database
- **Supabase (PostgreSQL)**
- **Never:** MongoDB, MySQL, SQLite in production
- RLS policies mandatory for access control

### Validation
- **Zod** for all schema validation
- **Never:** Joi, Yup, class-validator

### Testing
- **Vitest** for unit and E2E tests
- **Never:** Jest, Mocha, Jasmine

### Frontend
- **Vue 3 + Nuxt 4**
- **Styling:** Tailwind CSS
- **Never:** React, Svelte for this project

### Authentication
- **Supabase Auth**
- **Never:** Auth0, Firebase Auth, custom auth

---

## 📝 Naming Conventions

### Files & Directories
```
kebab-case for all files and folders
✅ error-handler.ts
✅ analytics-dashboard.vue
❌ ErrorHandler.ts
❌ analyticsDashboard.vue
```

### Variables & Functions
```typescript
// ✅ camelCase for code
const userId = user.id
function calculateClickRate() { }

// ❌ snake_case in code
const user_id = user.id
function calculate_click_rate() { }
```

### Database Columns
```sql
-- ✅ snake_case for database
ALTER TABLE public.analytics_events ADD COLUMN device_type TEXT;

-- ❌ camelCase in database
ALTER TABLE public.analytics_events ADD COLUMN deviceType TEXT;
```

### API Parameters
```typescript
// ✅ camelCase in JSON/API
{ "userId": "123", "deviceType": "mobile" }

// ❌ snake_case in JSON
{ "user_id": "123", "device_type": "mobile" }
```

### API Endpoints
```
GET /api/analytics/dashboard
GET /api/analytics/links/:id/detailed
POST /api/links
GET /api/health

❌ Never: GET /getAnalytics, POST /createLink
```

---

## 📦 Dependency Management

### Approved Dependencies
These are vetted and should be used:
- `zod` - Validation
- `h3` - HTTP utilities (already in Nitro)
- `supabase` - Database client
- `vue` - Frontend framework
- `nuxt` - Full-stack framework

### Adding New Dependencies
Before adding a package:
1. Check if we already have similar functionality
2. Is it actively maintained?
3. Does it align with our tech stack?
4. Will it increase bundle size significantly?

**Process:** Create GitHub issue → team discusses → add if approved

---

## 🚀 Deployment & Versioning

### Version Numbers
Follow semver: `MAJOR.MINOR.PATCH`
- **MAJOR:** Breaking API changes
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes

### Changelog
Update `CHANGELOG.md` for every change:
```markdown
## [1.1.0] - 2025-01-25
### Added
- Dashboard analytics endpoint
- Rate limiting middleware

### Fixed
- Analytics ingestion retry logic
```

### Database Migrations
- All schema changes documented in `schema.sql`
- Backup before production changes
- Test migrations locally first

---

## 🎯 Definition of Done

**Before merging ANY PR:**

- [ ] Feature spec matches `openspec/specs/` or `openspec/changes/CHANGE-*/spec.md`
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Follows constitution.md
- [ ] Code reviewed by 1+ team member
- [ ] Changelog updated
- [ ] Logging added for errors and key operations
- [ ] No hardcoded secrets or API keys
- [ ] Database migrations tested
- [ ] API documented (endpoint, params, response)

---

## ❌ Common Mistakes to Avoid

| Mistake | Why | Fix |
|---------|-----|-----|
| Using `any` type | Defeats type safety | Use proper types or `as unknown as Type` with comment |
| Throwing errors without logging | Can't debug | Always `logger.error()` before throwing |
| Skipping input validation | Security risk | Use Zod for ALL user inputs |
| No RLS on tables | Data exposure | Enable RLS + create policies |
| Hardcoding config | Environment issues | Use `process.env` and validate |
| Giant functions | Hard to test | Keep functions <50 lines |
| No error handling | Crashes | Wrap in try-catch + log |
| Using `console.log()` | Not structured | Use `createLogger()` |

---

## 📚 Reference Documents

- [Phase 1 Implementation](PHASE_1_IMPLEMENTATION.md) - Analytics, error handling, security
- [Phase 1 Quick Reference](PHASE_1_QUICK_REFERENCE.md) - Common tasks
- [OpenSpec Integration](OPENSPEC_INTEGRATION.md) - How to use this constitution
- [Architectural Analysis](ARCHITECTURAL_ANALYSIS.md) - System design overview

---

## ✍️ Last Updated
**Date:** January 25, 2025  
**Version:** 1.0  
**By:** Architecture Team

**Next Review:** When adding Phase 2 features

---

> **Remember:** This constitution is the source of truth. When in doubt, refer here. When this contradicts something else, constitution wins. Questions? Create a GitHub discussion.
