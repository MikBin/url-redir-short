# OpenSpec Integration Guide: URL Redirector System

## What is OpenSpec?

**OpenSpec** is a **Specification-Driven Development (SDD)** framework designed for **brownfield development** (evolving existing codebases). It's perfect for your project because:

- ✅ Lightweight and token-efficient (vs heavyweight approaches)
- ✅ Diff-based change management (easy to track what changed)
- ✅ Designed for mature, existing codebases (your Phase 1→2→3 progression)
- ✅ Works with any AI assistant (Claude, GPT, GitHub Copilot, etc.)
- ✅ Minimal friction - not rigid like Spec Kit

**Key Philosophy:** *Specs become the new source code.* Instead of vague chat prompts, you define structured specifications that drive implementation.

---

## Current Project Assessment

### What You Have ✅
- Solid architecture with domain-driven design
- Comprehensive Phase 1 implementation (analytics, error handling, security)
- Type-safe codebase with existing tests
- Clear separation of concerns

### What OpenSpec Solves 🎯
- **Prevents spec drift** - AI doesn't lose context mid-implementation
- **Creates audit trails** - See exactly what was planned vs implemented
- **Enables async collaboration** - Specs can be reviewed before implementation starts
- **Reduces hallucinations** - AI references versioned spec, not chat history
- **Speeds up Phase 2 & 3** - Clear specs = faster implementation

---

## Integration Plan: 4 Steps

### Step 1: Initialize OpenSpec Structure

Create this folder structure at project root:

```
url-redir-short/
├── openspec/
│   ├── specs/
│   │   ├── 01-analytics-pipeline.md      # Phase 1 spec (archive reference)
│   │   ├── 02-error-handling.md          # Phase 1 spec (archive reference)
│   │   ├── 03-security-hardening.md      # Phase 1 spec (archive reference)
│   │   ├── 04-ui-improvements.md         # Phase 2 spec
│   │   ├── 05-monitoring-observability.md # Phase 2 spec
│   │   └── constitution.md               # Non-negotiable principles
│   ├── changes/
│   │   ├── CHANGE-001-dashboard-ui/
│   │   │   ├── proposal.md               # What/why
│   │   │   ├── spec.md                   # Detailed spec
│   │   │   ├── plan.md                   # How-to implementation steps
│   │   │   └── tasks.md                  # Atomic tasks for AI
│   │   └── CHANGE-002-monitoring-alerts/
│   │       ├── proposal.md
│   │       ├── spec.md
│   │       ├── plan.md
│   │       └── tasks.md
│   └── archive/                          # Completed changes
```

### Step 2: Create Constitution.md

This is the **guardrail document** - non-negotiable principles that apply to ALL code:

```markdown
# Constitution: URL Redirector System

## Architecture Principles
- **Domain-Driven Design**: Core logic isolated in `src/core/`, use cases in `src/use-cases/`
- **Clean Architecture**: Adapters separate from business logic
- **Type Safety**: TypeScript strict mode always. No `any` types without justification

## Code Quality
- **Test Coverage**: Minimum 80% for new code. E2E tests for all APIs
- **Logging**: All errors use `logger.error()` with correlation IDs
- **Error Handling**: Use `createError()` from error-handler, never throw raw errors
- **Validation**: Zod schemas for all API inputs

## Security (NON-NEGOTIABLE)
- **Rate Limiting**: Applied to all public endpoints
- **Input Sanitization**: All user inputs validated & sanitized
- **Security Headers**: Always included via middleware
- **Authentication**: Protected endpoints require `serverSupabaseUser()`
- **RLS Policies**: Database tables must have RLS enabled

## Performance
- **Database Queries**: Use count: 'exact' only when needed, prefer head: true
- **Response Size**: Paginate lists > 100 items
- **Caching**: Add cache headers to read endpoints

## Observability
- **Structured Logging**: JSON format, include correlationId
- **Metrics**: Track latency, errors, request count per endpoint
- **Health Checks**: Implement for all critical services

## Technology Stack (NON-NEGOTIABLE)
- **Runtime**: Node.js + Nitro (Nuxt)
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod
- **Testing**: Vitest
- **Auth**: Supabase Auth
- **Frontend**: Vue 3 + Nuxt 4

## Naming Conventions
- Files: kebab-case (error-handler.ts)
- Functions/Variables: camelCase
- Database columns: snake_case
- API params: camelCase
```

### Step 3: Document Phase 1 (Archive)

For each Phase 1 component, create a spec documenting what was built:

**File:** `openspec/specs/01-analytics-pipeline.md`

```markdown
# Spec: Complete Analytics Pipeline

## Overview
Implemented full analytics flow: collection → ingestion → aggregation → visualization

## Completed Components

### API Endpoints
- `POST /api/analytics/v1/collect` - Ingestion with rate limiting (100/min)
- `GET /api/analytics/dashboard` - Dashboard overview
- `GET /api/analytics/links/[linkId]/detailed` - Link metrics
- `GET /api/analytics/export/[format]` - CSV/JSON export

### Database
- `analytics_events` - Raw click data with device/geo breakdown
- `analytics_aggregates` - Pre-computed hourly/daily stats
- `sessions` - User session tracking
- Indexes on: path, timestamp, device_type, country, link_id

### Security
- Rate limiting: 100/min per IP
- Input validation via Zod
- IP anonymization (SHA-256)
- Retry logic with exponential backoff

## Status
✅ COMPLETE - All 11 tests passing, zero TypeScript errors

## Files Modified
- schema.sql
- server/api/analytics/*.ts
- server/utils/logger.ts
- server/utils/error-handler.ts
```

### Step 4: Plan Phase 2 with OpenSpec

When ready to start Phase 2, create:

**File:** `openspec/changes/CHANGE-001-dashboard-ui/proposal.md`

```markdown
# Change Proposal: Enhanced Admin Dashboard UI

## Problem
Current admin UI lacks validation feedback, preview functionality, and inline analytics.
Users make mistakes with complex configurations.

## Opportunity
Provide real-time validation, targeting preview, and performance metrics inline.
Reduce support requests for configuration errors.

## Success Metrics
- 80% reduction in invalid link configurations
- 50% faster link creation workflow
- 30+ new UI components with test coverage

## Scope
- Form validation with error messages
- Targeting rule preview (show example URLs)
- Real-time performance metrics
- Enhanced QR code customization
```

**File:** `openspec/changes/CHANGE-001-dashboard-ui/spec.md`

```markdown
# Specification: Dashboard UI Improvements

## Components

### 1. Form Validation Layer
- Real-time validation as user types
- Clear error messages for each field
- Visual feedback (red borders, error icons)
- Validation occurs BEFORE submission

### 2. Link Configuration Preview
- Shows example redirect results
- Visualizes targeting rules (geo, device)
- Displays QR code in real-time
- Shows password protection UI

### 3. Analytics Inline
- Click trends (last 7 days)
- Top referrers
- Device breakdown
- Geographic heatmap

### 4. QR Code Customization
- Color picker for code/background
- Logo upload with positioning
- Error correction level selection
- Size adjustment

## Data Flow
```
User Input → Validation → Preview Update → Preview Display
           ↓
      Error Messages (if any)
```

## API Endpoints Required
- Existing: `/api/analytics/links/:id/detailed`
- Existing: `/api/analytics/dashboard`
- New: `/api/links/:id/preview` (simulate redirect)

## UI Components
- `<FormFieldWithValidation>` - Reusable validated input
- `<TargetingPreview>` - Shows rule results
- `<AnalyticsCard>` - Displays metrics
- `<QRCustomizer>` - QR customization panel
```

**File:** `openspec/changes/CHANGE-001-dashboard-ui/plan.md`

```markdown
# Implementation Plan: Dashboard UI Improvements

## Phase 1: Foundation (Day 1-2)
- [ ] Create FormFieldWithValidation component
- [ ] Set up Zod validation schemas for all forms
- [ ] Add real-time error display
- [ ] Test with existing forms

## Phase 2: Analytics Display (Day 3-4)
- [ ] Create AnalyticsCard component
- [ ] Integrate /api/analytics/links/:id/detailed
- [ ] Add chart visualization (Chart.js or Recharts)
- [ ] Implement caching for metrics

## Phase 3: Preview System (Day 5-6)
- [ ] Create LinkPreview component
- [ ] Implement /api/links/:id/preview endpoint
- [ ] Test geo/device rule simulation
- [ ] Add password protection preview

## Phase 4: QR Customization (Day 7)
- [ ] Build QRCustomizer component
- [ ] Integrate qr-code library enhancements
- [ ] Add color/logo preview
- [ ] Test all combinations

## Integration (Day 8)
- [ ] Wire all components into create/edit pages
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Documentation
```

**File:** `openspec/changes/CHANGE-001-dashboard-ui/tasks.md`

```markdown
# Implementation Tasks: Dashboard UI

## Task 1: Form Validation Component
**File:** `app/components/FormFieldWithValidation.vue`
- [ ] Accept schema, value, label, placeholder
- [ ] Show error message on validation failure
- [ ] Apply red border/error styling
- [ ] Debounce validation to 300ms
- [ ] Test with NameField, URLField, JSONField

## Task 2: Analytics Inline Display
**File:** `app/components/AnalyticsCard.vue`
- [ ] Fetch from /api/analytics/links/:id/detailed
- [ ] Display 7-day trend chart
- [ ] Show top 5 referrers
- [ ] Display device breakdown pie chart
- [ ] Add loading skeleton

## Task 3: Preview Endpoint
**File:** `server/api/links/:id/preview.post.ts`
- [ ] Accept targeting rules JSON
- [ ] Simulate redirect based on current request
- [ ] Return destination URL or targeting explanation
- [ ] Test with geo, device, language targeting

...etc
```

---

## Using OpenSpec with AI Assistants

### Workflow: Plan → Review → Implement

#### 1. Create Proposal (Human)
```
Create the proposal.md explaining the problem and opportunity.
Let AI review it and suggest improvements.
```

#### 2. Refine Spec (AI)
```
Tell AI: "Review this spec against our constitution.md and refine it."
AI will:
- Check architecture alignment
- Validate against type safety requirements
- Suggest database schema changes
- Recommend component structure
```

#### 3. Create Plan (AI)
```
Tell AI: "Create a detailed implementation plan with specific files and changes."
AI will:
- Break down into phases
- Identify dependencies
- Suggest test strategy
- List all files to create/modify
```

#### 4. Create Tasks (AI)
```
Tell AI: "Create atomic tasks from the plan with specific acceptance criteria."
AI will:
- Break tasks into 1-2 hour chunks
- Write acceptance criteria
- Suggest test cases
- Link related tasks
```

#### 5. Implement (AI)
```
Tell AI: "Implement tasks 1-3 from tasks.md"
AI will:
- Reference the spec while implementing
- Follow constitution principles
- Write tests alongside code
- Report completed work
```

#### 6. Archive (Human)
```
Once merged to main:
- Move CHANGE-001 folder to archive/
- Update openspec/specs/ with finalized spec
- Create summary of lessons learned
```

---

## Implementation Timeline

### Week 1: Setup (High Priority)
- [ ] Create openspec/ folder structure
- [ ] Write constitution.md
- [ ] Document Phase 1 specs
- [ ] Set up VS Code OpenSpec extension (optional)

### Week 2: Phase 2 Planning
- [ ] Create CHANGE-001 proposal (Dashboard UI)
- [ ] AI refines spec
- [ ] Human reviews and approves
- [ ] Ready for implementation

### Week 3: Phase 2 Implementation
- [ ] Use OpenSpec tasks to implement
- [ ] Reference spec.md during coding
- [ ] Follow constitution.md
- [ ] Archive when merged

### Week 4+: Phase 3 with OpenSpec
- [ ] All future changes use CHANGE-XXX folder pattern
- [ ] Specs become source of truth
- [ ] AI implements from specs, not chat

---

## Key Improvements OpenSpec Brings

### 1. **Reduces Context Drift** 🧠
**Before:** Chat history gets long, AI loses track of requirements  
**After:** AI always references spec.md, never gets confused

### 2. **Audit Trail** 📋
**Before:** "What was decided?" requires searching chat  
**After:** All decisions in `openspec/changes/CHANGE-XXX/`

### 3. **Parallel Work** 🚀
**Before:** Can't work on Phase 2 while Phase 1 merges  
**After:** Create Phase 2 spec while Phase 1 is in review

### 4. **Faster Implementation** ⚡
**Before:** AI asks clarifying questions mid-implementation  
**After:** Spec answers questions upfront

### 5. **Better Code Quality** ✅
**Before:** Code doesn't match requirements  
**After:** AI references spec during implementation, stays aligned

### 6. **Easy Onboarding** 👥
**Before:** New team member reads chat history (hours)  
**After:** Read spec.md and constitution.md (30 minutes)

---

## What to Change in Current Project

### Immediate Changes

1. **Create openspec/ folder**
   ```bash
   mkdir -p openspec/specs openspec/changes openspec/archive
   ```

2. **Add to .gitignore**
   ```
   # OpenSpec - ignore drafts, keep completed changes
   openspec/changes/DRAFT-*/
   ```

3. **Create constitution.md** (provided above)

4. **Update README.md** to mention OpenSpec workflow

### Optional Enhancements

1. **VS Code Settings**
   ```json
   {
     "files.exclude": {
       "openspec/changes/DRAFT-*": true
     }
   }
   ```

2. **GitHub Issue Template** (link to OpenSpec change)
   ```markdown
   - Related OpenSpec Change: openspec/changes/CHANGE-XXX
   ```

3. **Pre-commit Hook** (validate spec.md exists before merge)
   ```bash
   #!/bin/sh
   if git diff --cached --name-only | grep -q "^openspec/changes/"; then
     if ! test -f "openspec/changes/*/spec.md"; then
       echo "❌ spec.md required for all changes"
       exit 1
     fi
   fi
   ```

---

## Phase 2 & 3 Estimation with OpenSpec

### Phase 2: User Experience (Weeks 2-4)
- Dashboard UI improvements: 5 days (CHANGE-001)
- Monitoring dashboards: 3 days (CHANGE-002)
- QR customization: 2 days (CHANGE-003)

**OpenSpec Benefit:** Clear specs mean fewer "what did we agree on?" discussions

### Phase 3: Operational Excellence (Weeks 4-8)
- Configuration management: 4 days (CHANGE-004)
- Performance optimization: 5 days (CHANGE-005)
- Advanced testing: 4 days (CHANGE-006)

**OpenSpec Benefit:** Archive of specs makes refactoring decisions clear

---

## Getting Started Today

1. **Copy the structure** from above
2. **Write constitution.md** with your principles
3. **Document Phase 1** (what was built)
4. **Start Phase 2** with CHANGE-001 proposal
5. **Use OpenSpec workflow** for all future changes

---

## Comparison: With vs Without OpenSpec

| Task | Without OpenSpec | With OpenSpec |
|------|------------------|---------------|
| Start Phase 2 | "What should we build?" (10 msg) | proposal.md (clear intent) |
| Mid-implementation clarity | Ask AI, get different answer | Reference spec.md (consistent) |
| Code review | "Does it match what we discussed?" (vague) | "Does it match spec.md?" (objective) |
| Onboard new person | Read 50 chat messages | Read proposal.md + spec.md |
| Three months later | "Why did we do this?" | Check openspec/archive/CHANGE-XXX |
| Estimate Phase 3 | Guess | Reference past CHANGE-* timestamps |

---

## Next Steps

1. **Today:** Create openspec/ folder and constitution.md
2. **Tomorrow:** Document Phase 1 specs
3. **This week:** Plan Phase 2 as first CHANGE proposal
4. **Next week:** Implement Phase 2 using OpenSpec workflow

**Result:** Faster, clearer, more maintainable development for Phases 2 & 3.

---

## Resources

- **GitHub OpenSpec:** https://github.com/Fission-AI/OpenSpec
- **Docs:** https://openspec.dev/
- **VS Code Extension:** OpenSpec (search in marketplace)
- **Discord:** https://discord.gg/YctCnvvshC

---

## OpenSpec vs Alternatives

### vs Spec Kit (GitHub)
- Spec Kit: Rigid, gated workflow (Specify → Plan → Tasks → Implement)
- OpenSpec: Flexible, iterative (always can update)
- **Your Choice:** OpenSpec (better for evolving brownfield)

### vs BMAD (AWS)
- BMAD: Heavy, multi-agent, complex planning
- OpenSpec: Lightweight, token-efficient, minimalist
- **Your Choice:** OpenSpec (faster, less overhead)

### vs nothing (pure chat)
- No Spec: Context drift, vague requirements, 😱 mistakes
- OpenSpec: Specs drive code, clear audit trail, 😊 predictable
- **Your Choice:** OpenSpec (solves real problem)

---

**Summary:** OpenSpec is the missing link between your current solid architecture and rapid Phase 2/3 execution. It adds minimal friction but massive clarity.

Start small: constitution.md + CHANGE-001 proposal. You'll see the value immediately.
