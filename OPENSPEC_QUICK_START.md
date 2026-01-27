# OpenSpec Quick Start: Get Started in 10 Minutes

## What is OpenSpec?

**Simple Answer:** A system for writing specs that AI implements from, instead of vague chat prompts.

**Problem It Solves:**
- AI forgets requirements mid-implementation
- "What did we agree on?" requires searching chat
- Code doesn't match intent
- Onboarding takes forever

**How It Works:**
1. Write spec.md (what to build)
2. AI reads spec.md while coding (stays focused)
3. Archive completed changes (audit trail)
4. Repeat for next feature

---

## Getting Started (5 Minutes)

### Step 1: Create Folder
```bash
mkdir -p openspec/specs openspec/changes openspec/archive
```

### Step 2: Copy Constitution
✅ Already done! File: `openspec/specs/constitution.md`

This is your guardrail document. AI references this during implementation.

### Step 3: Create First Proposal (Now)
Create this file: `openspec/changes/CHANGE-001-dashboard-ui/proposal.md`

```markdown
# Change Proposal: Dashboard UI Improvements

## Problem
Current UI lacks form validation and performance metrics.

## Solution
Add real-time validation, analytics inline, and better feedback.

## Success Metric
Reduce configuration errors by 50%.
```

### Step 4: Expand to Spec
Create: `openspec/changes/CHANGE-001-dashboard-ui/spec.md`

```markdown
# Specification: Dashboard UI Improvements

## Components to Build
1. FormFieldWithValidation - Real-time error feedback
2. AnalyticsInline - Click metrics, trends, referrers
3. LinkPreview - Shows what redirect rules do

## API Endpoints Needed
- GET /api/analytics/links/:id/detailed (already exists)
- POST /api/links/:id/preview (new)

## Database Tables
No new tables. Use existing analytics_events.

## Security
- Only show analytics for user's own links
- Validate all form inputs with Zod
- Rate limit preview endpoint
```

### Step 5: Create Implementation Plan
Create: `openspec/changes/CHANGE-001-dashboard-ui/plan.md`

```markdown
# Implementation Plan

## Day 1: Form Validation
- [ ] Create FormFieldWithValidation.vue
- [ ] Add validation to link creation form
- [ ] Test with required fields

## Day 2: Analytics Display
- [ ] Create AnalyticsCard.vue
- [ ] Fetch from /api/analytics/links/:id/detailed
- [ ] Display 7-day chart

## Day 3: Preview
- [ ] Create /api/links/:id/preview endpoint
- [ ] Test with geo/device rules
- [ ] Wire into UI
```

---

## Using OpenSpec with AI

### Ask AI to Refine Your Spec

**You write:** `openspec/changes/CHANGE-001-dashboard-ui/proposal.md`

**Tell AI:**
```
Review this proposal against our constitution.md.
Are we aligned with our architecture?
Any improvements?
```

**AI will:**
- Check architecture alignment ✓
- Suggest components to build ✓
- Identify security issues ✓
- Recommend files to create ✓

### Ask AI to Create Implementation Tasks

**You write:** spec.md

**Tell AI:**
```
Create atomic implementation tasks from this spec.
Each task should be 1-2 hours of work.
Include acceptance criteria.
Reference files that need changes.
```

**AI will:**
- Break down into tasks ✓
- Write test cases ✓
- Identify dependencies ✓
- Suggest file structure ✓

### Ask AI to Implement

**You have:** spec.md + plan.md + tasks.md

**Tell AI:**
```
Implement Task 1: FormFieldWithValidation
Reference spec.md for requirements.
Follow constitution.md principles.
Include tests.
```

**AI will:**
- Reference spec throughout ✓
- Follow security rules ✓
- Write tests ✓
- Stay on track ✓

---

## File Structure (What You Created)

```
openspec/
├── specs/
│   ├── constitution.md         ← Core principles (guardrails)
│   ├── 01-analytics.md         ← Phase 1 archive (reference)
│   ├── 02-error-handling.md    ← Phase 1 archive (reference)
│   └── 03-security.md          ← Phase 1 archive (reference)
├── changes/
│   ├── CHANGE-001-dashboard-ui/
│   │   ├── proposal.md         ← Problem & solution
│   │   ├── spec.md             ← What to build
│   │   ├── plan.md             ← How to build it
│   │   └── tasks.md            ← Atomic work items
│   └── CHANGE-002-monitoring/  ← Next feature (future)
└── archive/
    ├── CHANGE-001-dashboard-ui/  ← Moved here when complete
    └── ...
```

---

## Workflow Example: Building Phase 2

### Monday Morning
**You create:** `CHANGE-001-dashboard-ui/proposal.md`
```markdown
## Problem
No way to validate links before saving.

## Solution  
Real-time validation + preview.

## Impact
50% fewer configuration errors.
```

### Monday 2pm
**AI reviews proposal**
```
/opsx:onboard
Proposal looks good. Do we need database schema changes?
Should preview be cached?
```

### Tuesday Morning
**You finalize spec:** `spec.md`
- Lists exact components
- Shows data flow
- Specifies security rules

### Tuesday Afternoon
**AI creates:** `plan.md` + `tasks.md`
```
Task 1: FormFieldWithValidation.vue (2 hrs)
- Accept schema, value, label
- Show errors on validation fail
- Test with 5 different inputs

Task 2: AnalyticsCard.vue (2 hrs)
- Fetch from /api/analytics/links/:id/detailed
- Display chart with recharts
- Show loading skeleton
```

### Wednesday-Thursday
**AI implements** using tasks.md
```
Implementing Task 1...
Referencing spec.md requirement: "validate on blur"
Following constitution: "all inputs use Zod"
```

### Friday
**Code review & merge**
- Compare implementation to spec ✓
- Check constitution compliance ✓
- Tests pass ✓
- Merge to main

### Friday EOD
**Archive completed change**
```bash
mv openspec/changes/CHANGE-001-dashboard-ui \
   openspec/archive/CHANGE-001-dashboard-ui
```

Result: Week of productive building + clear audit trail.

---

## Constitution Highlights

Your guardrails for all code:

### Architecture
- Domain logic in `src/core/`
- Use cases in `src/use-cases/`
- Adapters in `src/adapters/`
- No mixing of layers

### Code Quality
- 80%+ test coverage
- Zero `any` types
- Always use logger.error() with correlationId
- All inputs validated with Zod

### Security (NON-NEGOTIABLE)
- Authentication required for protected endpoints
- Rate limiting on all public endpoints
- Input sanitization always
- RLS enabled on all user data tables

### Tech Stack
- Node.js + Nitro (NOT Express/Flask)
- PostgreSQL via Supabase (NOT MongoDB)
- Zod for validation (NOT Joi)
- Vitest for tests (NOT Jest)

### Naming
- Files: kebab-case (error-handler.ts)
- Variables: camelCase (userId)
- Database: snake_case (user_id)
- API: camelCase JSON ({ userId })

---

## What Changes Now

### Before OpenSpec
```
You: "Let's build a dashboard"
AI: "What should it show?"
You: "Analytics, trends, maybe some charts"
AI: *builds something*
You: "That's not what I meant"
```

### With OpenSpec
```
You: Create proposal.md + spec.md
AI: Reference spec.md while coding
You: Review implementation vs spec
AI: "Did I match the spec?"
You: "Yes, merge it"
AI: Archive change
Next week: Clear history of what was built
```

**Result:** Clear specs → clear code → faster shipping

---

## Next Steps

### This Week
- [ ] Review `openspec/specs/constitution.md`
- [ ] Create CHANGE-001 proposal for Phase 2
- [ ] Write spec.md for that change
- [ ] Share with AI for feedback

### Next Week
- [ ] Refine spec based on feedback
- [ ] Create implementation plan
- [ ] AI breaks down into tasks
- [ ] Start implementation

### Ongoing
- [ ] Every feature = new CHANGE-XXX folder
- [ ] Specs drive implementation
- [ ] Archive when done
- [ ] Reference when needed

---

## OpenSpec in 3 Sentences

1. **Before building:** Write spec.md (what to build)
2. **While building:** AI references spec.md (stays aligned)
3. **After building:** Archive change (clear history)

That's it. Simple but powerful.

---

## Common Questions

**Q: Do I need to write specs for everything?**  
A: Major features yes. Typos/docs/tests? No. Use judgment.

**Q: Won't specs slow us down?**  
A: No. Bad specs slow you down. Good specs speed you up (by 3x).

**Q: Can I change the spec mid-implementation?**  
A: Yes! Update spec.md, tell AI what changed, keep building.

**Q: What if the spec is wrong?**  
A: Update it. Document in tasks.md why it changed.

**Q: How do I know when to archive a change?**  
A: When it's merged to main branch.

---

## Resources

- **Full Guide:** [OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md)
- **Constitution:** [openspec/specs/constitution.md](openspec/specs/constitution.md)
- **GitHub:** https://github.com/Fission-AI/OpenSpec
- **Docs:** https://openspec.dev/

---

## TL;DR

Specs are your contract with AI.
- Write them clear
- AI follows them
- Results are predictable

Start with proposal.md. You'll get it.

---

**Status:** Ready to use  
**Next Change:** CHANGE-001-dashboard-ui  
**Timeline:** Start tomorrow, shipping Friday
