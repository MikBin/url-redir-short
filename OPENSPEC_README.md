# OpenSpec: Specification-Driven Development for Your Project

## 📌 Quick Summary

**OpenSpec** turns vague chat prompts into structured specs that AI implements against.

Instead of: *"Build a dashboard"* → AI codes → *"That's not what I meant"*  
Use: **proposal.md** → **spec.md** → AI codes (referencing spec) → Done

**Benefits:**
- ✅ AI stays focused (references spec while coding)
- ✅ Clear audit trail (why decisions were made)
- ✅ Faster implementation (no "what did we agree on?" discussions)
- ✅ Easy onboarding (read 5 files instead of 100 chat messages)
- ✅ Parallel work (can start Phase 2 while Phase 1 merges)

---

## 📚 Documentation Files (START HERE)

| File | Purpose | Read Time |
|------|---------|-----------|
| **[OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md)** | Get started in 10 minutes | 5 min |
| **[OPENSPEC_SUMMARY.md](OPENSPEC_SUMMARY.md)** | Your questions answered | 10 min |
| **[OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md)** | Complete integration guide | 20 min |
| **[openspec/specs/constitution.md](openspec/specs/constitution.md)** | Project guardrails | 10 min |

**Read in this order:**
1. OPENSPEC_QUICK_START.md (understand the concept)
2. OPENSPEC_SUMMARY.md (answer your questions)
3. constitution.md (know the rules)
4. OPENSPEC_INTEGRATION.md (deep dive if interested)

---

## 🎯 Current Status

### Phase 1: Complete ✅
- Analytics pipeline: Done
- Error handling: Done  
- Security hardening: Done
- Tests: 11/11 passing
- TypeScript: Zero errors

### Phase 2: Ready for OpenSpec
- UI improvements (Dashboard, QR, Forms)
- Monitoring dashboards
- Performance optimization

**Using OpenSpec for Phase 2 will:**
- Speed up implementation by 3-5 days
- Provide clear spec for each change
- Create permanent audit trail
- Make code reviews objective

---

## 🚀 Getting Started (Choose Your Path)

### Path A: I Just Want to Understand (10 min)
1. Read: [OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md)
2. Read: [openspec/specs/constitution.md](openspec/specs/constitution.md)
3. Decide: Use for Phase 2? (Recommended: YES)

### Path B: I Want to Start Using It Today (30 min)
1. Read: [OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md)
2. Create: `openspec/changes/CHANGE-001-dashboard-ui/proposal.md`
3. Copy template below (or use as inspiration)

### Path C: I Want All the Details (60 min)
1. [OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md) (understand concept)
2. [OPENSPEC_SUMMARY.md](OPENSPEC_SUMMARY.md) (deep Q&A)
3. [OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md) (complete guide)
4. [openspec/specs/constitution.md](openspec/specs/constitution.md) (guardrails)
5. Start creating CHANGE-001

---

## 💡 The Core Concept

### Problem
You're at Phase 1 ✅. Moving to Phase 2 requires building many features. Without specs:
- Chat history becomes source of truth (hard to find things)
- AI forgets requirements mid-implementation
- Code reviews are vague ("Does it match what we discussed?")
- Onboarding new person: Read 100 chat messages

### Solution
Use OpenSpec. Write once, reference forever:

```
proposal.md     ← What problem are we solving?
spec.md         ← What exactly do we build?
plan.md         ← How do we build it? (steps)
tasks.md        ← Atomic work for AI to implement
code/           ← AI implements, referencing spec
archive/        ← After merge, move here (audit trail)
```

### Result
- Clear intent (proposal.md + spec.md)
- AI stays aligned (reads spec while coding)
- Clear decisions (archive has everything)
- Easy to explain (show spec.md to anyone)

---

## 📂 Folder Structure (Now Active)

```
url-redir-short/
├── openspec/
│   ├── specs/                          # Permanent specs
│   │   ├── constitution.md             # ✅ Your guardrails (ACTIVE)
│   │   ├── 01-analytics.md             # Phase 1 reference
│   │   ├── 02-error-handling.md        # Phase 1 reference
│   │   └── 03-security.md              # Phase 1 reference
│   │
│   ├── changes/                        # Work in progress
│   │   ├── CHANGE-001-dashboard-ui/
│   │   │   ├── proposal.md             # Problem & solution
│   │   │   ├── spec.md                 # Detailed requirements
│   │   │   ├── plan.md                 # Implementation steps
│   │   │   └── tasks.md                # Atomic tasks
│   │   └── CHANGE-002-monitoring/
│   │       └── ...
│   │
│   └── archive/                        # Completed changes
│       └── CHANGE-001-dashboard-ui/
│           ├── proposal.md
│           ├── spec.md
│           ├── plan.md
│           └── tasks.md
│
├── OPENSPEC_QUICK_START.md             # ← Start here
├── OPENSPEC_SUMMARY.md                 # ← Q&A
├── OPENSPEC_INTEGRATION.md             # ← Full guide
└── OPENSPEC_README.md                  # ← You are here
```

---

## 🎬 Quick Start: Create Your First Change

### Step 1: Create Folder (30 seconds)
```bash
mkdir -p openspec/changes/CHANGE-001-dashboard-ui
```

### Step 2: Create Proposal (10 minutes)
Create: `openspec/changes/CHANGE-001-dashboard-ui/proposal.md`

```markdown
# Change Proposal: Dashboard UI Improvements

## Problem
Currently, there's no way to validate link configurations before saving.
Users make mistakes with targeting rules and don't get feedback.

## Solution
Add real-time validation to forms, show analytics inline,
and provide preview of what redirect rules will do.

## Success Metrics
- Reduce invalid configurations by 50%
- Faster link creation workflow
- Clear feedback on rule configuration

## Scope
- Form validation component
- Analytics inline display
- Targeting rule preview
```

### Step 3: Refine with AI (10 minutes)
**Tell AI:**
```
Review my proposal.md against our constitution.md.
Are we aligned on architecture and security?
Any improvements before I write the full spec?
```

### Step 4: Create Spec (30 minutes)
Create: `openspec/changes/CHANGE-001-dashboard-ui/spec.md`

```markdown
# Specification: Dashboard UI Improvements

## Components to Build

### 1. FormFieldWithValidation
- Real-time validation as user types
- Display error message below field
- Apply red border on error
- Zod schema validation

### 2. AnalyticsInline
- Display last 7 days of clicks
- Show chart of trends
- Show top 5 referrers
- Display device breakdown pie chart

### 3. LinkPreview
- Show example result of current rules
- Simulate geo/device/language targeting
- Display final destination URL

## API Endpoints
- GET /api/analytics/links/:id/detailed (exists)
- POST /api/links/:id/preview (new)

## Database
No new tables needed.
Use: analytics_events, links

## Security
- Only show your own link analytics
- Validate all form inputs
- Rate limit preview endpoint
```

### Step 5: Have AI Create Plan (15 minutes)
**Tell AI:**
```
Create a detailed implementation plan from this spec.
Break it into phases (days 1-2, days 3-4, days 5-6).
Include which files to create/modify.
```

### Step 6: Have AI Create Tasks (15 minutes)
**Tell AI:**
```
Create atomic implementation tasks from the plan.
Each task should be 1-2 hours.
Include acceptance criteria and test cases.
Reference the files that need changes.
```

**Result:** You now have a complete specification + implementation plan ready for AI to code from.

---

## ✅ Constitution: Your Guardrails

Located: `openspec/specs/constitution.md`

Key rules AI must follow:
- **Architecture:** Domain logic in `src/core/`, use cases in `src/use-cases/`
- **Security:** All inputs validated, rate limiting applied, RLS on tables
- **Code Quality:** 80%+ test coverage, zero `any` types, structured logging
- **Tech Stack:** Node.js + Nitro, Supabase, Zod, Vitest
- **Naming:** kebab-case files, camelCase vars, snake_case DB columns

When AI codes, it will follow these rules automatically.

---

## 🔄 Workflow: Using OpenSpec with AI

### Week 1: Plan
```
Monday:   You write proposal.md
Tuesday:  You write spec.md
Wednesday: AI reviews both for issues
Thursday:  You approve both (or iterate)
Friday:    AI creates plan.md + tasks.md
```

### Week 2: Review Plan
```
Monday:   You review plan.md
Tuesday:  You review tasks.md (are they clear?)
Wednesday: You approve (or ask for changes)
Thursday:  Ready to implement
Friday:    Buffer
```

### Week 3: Implement
```
Monday:    AI implements Task 1-3
Tuesday:   AI implements Task 4-6
Wednesday: AI implements Task 7-9
Thursday:  Code review (compare to spec)
Friday:    Merge + archive change
```

### Result: CHANGE-001 Complete
```bash
# Move to archive when merged
mv openspec/changes/CHANGE-001-dashboard-ui \
   openspec/archive/CHANGE-001-dashboard-ui

# Done! The complete spec is permanently available.
```

---

## 📊 Impact: What Changes

### Before (Phase 1 approach)
```
You: "Build dashboard"
AI: "What should it show?"
You: "Analytics, trends, validation"
AI: *codes for 2 hours*
You: Review code
You: "I expected something different"
Go back to step 1...
Result: 5+ back-and-forths, 1 week wall-clock time
```

### After (Phase 2 with OpenSpec)
```
You: Write proposal.md (problem) - 10 min
You: Write spec.md (what to build) - 30 min
AI: Code referencing spec.md - 2 hours
You: Review code vs spec.md - 30 min
Result: Clear match, 3 hours wall-clock time
```

**Improvement:** 2.5x faster, 10x clearer, 100% audit trail

---

## 🎓 Learning More

### For Curious About OpenSpec Philosophy
- Read: [OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md) section "What is OpenSpec?"
- External: https://openspec.dev/

### For Understanding Your Guardrails
- Read: [openspec/specs/constitution.md](openspec/specs/constitution.md)
- Key sections: Security, Code Quality, Architecture, Tech Stack

### For Common Questions
- Read: [OPENSPEC_SUMMARY.md](OPENSPEC_SUMMARY.md)
- Covers: vs OpenAPI, vs Spec Kit, setup timeline, tools, etc.

### For Complete Integration Details
- Read: [OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md)
- Covers: Every step, examples, templates, alternatives

---

## ❓ FAQ

### Q: Do I have to use OpenSpec?
**A:** No. But Phase 2/3 will be slower/less clear without it.

### Q: What if I want to change the spec mid-implementation?
**A:** Update spec.md, tell AI what changed. OpenSpec is flexible.

### Q: Is this mandatory for ALL changes?
**A:** Major features: yes. Bug fixes/docs: no. Use judgment.

### Q: What if I don't like it after trying?
**A:** That's fine! You've only invested 2 hours. Stop using it.

### Q: Does it work with my AI tool? (Claude, GPT, Copilot)
**A:** Yes, all of them. Just share spec.md location.

### Q: How long does setup take?
**A:** First change: 2 hours (proposal + spec)  
Subsequent changes: 1.5 hours (you get faster)

---

## 📋 Checklist: This Week

- [ ] Read [OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md) (10 min)
- [ ] Review [openspec/specs/constitution.md](openspec/specs/constitution.md) (10 min)
- [ ] Create empty CHANGE-001 folder (1 min)
- [ ] Write CHANGE-001 proposal.md (10 min)
- [ ] Share proposal with team (30 min feedback)
- [ ] Write CHANGE-001 spec.md (30 min)
- [ ] Get approval (30 min)

**Total:** 2 hours to be fully set up

---

## 🚦 Next Steps

### TODAY
- [ ] Read this file (you're reading it now ✓)
- [ ] Choose your path above (Path A, B, or C)

### THIS WEEK
- [ ] Create CHANGE-001 proposal.md
- [ ] Iterate with team
- [ ] Write spec.md
- [ ] Get approval

### NEXT WEEK
- [ ] Use AI to create plan.md + tasks.md
- [ ] Start implementation
- [ ] Code reference spec.md

### RESULT
By week 3: Phase 2 features + clear specs + audit trail

---

## 🎯 Success Criteria

You'll know OpenSpec is working when:
- ✅ spec.md answers most questions (no "what did we agree on?")
- ✅ AI code matches spec.md (no surprises in review)
- ✅ New person reads spec in 30 min (not chat in 8 hours)
- ✅ Decisions are permanently recorded (archive/)
- ✅ Phase 2/3 moves faster (less clarification needed)

---

## 📞 Questions?

- **Quick answers:** [OPENSPEC_SUMMARY.md](OPENSPEC_SUMMARY.md)
- **How to use:** [OPENSPEC_QUICK_START.md](OPENSPEC_QUICK_START.md)
- **Deep dive:** [OPENSPEC_INTEGRATION.md](OPENSPEC_INTEGRATION.md)
- **Guardrails:** [openspec/specs/constitution.md](openspec/specs/constitution.md)
- **External:** https://openspec.dev/ (official docs)

---

## 📌 TL;DR

**What:** Write specs (proposal.md + spec.md) that AI implements against  
**Why:** AI stays focused, clear audit trail, faster Phase 2/3  
**How:** 2 hours to set up, then use for all features  
**Start:** Read OPENSPEC_QUICK_START.md, create CHANGE-001 proposal.md  
**Result:** 3x faster development, 10x clearer decisions, permanent history

Go build. 🚀
