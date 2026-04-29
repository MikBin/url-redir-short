# Architecture Documentation

This directory is the single source of truth for all architecture documentation of the **Universal Redirector System**.

## Structure

```
docs/architecture/
├── README.md          ← You are here: index and navigation guide
├── arc42/
│   └── arc42.md       ← Main architecture document (arc42 template, all 12 sections)
├── adrs/              ← Architecture Decision Records
│   ├── 001-sse-state-sync.md
│   ├── 002-clean-architecture.md
│   ├── 003-cuckoo-filter.md
│   └── 004-cf-kv-edge-state.md
└── diagrams/          ← Static diagram exports (generated from likec4/)
    └── README.md
```

## Quick Navigation

| I want to... | Go to |
|---|---|
| Understand the overall system | [arc42.md §3 Scope & Context](arc42/arc42.md#3-system-scope-and-context) |
| See the containers and how they connect | [arc42.md §5 Building Block View](arc42/arc42.md#5-building-block-view) |
| Understand data flows | [arc42.md §6 Runtime View](arc42/arc42.md#6-runtime-view) |
| See deployment options | [arc42.md §7 Deployment View](arc42/arc42.md#7-deployment-view) |
| Read why a key decision was made | [adrs/](adrs/) |
| View interactive C4 diagrams | Run `cd docs/architecture/likec4 && npm start` → open http://localhost:6422 |
| View static diagram snapshots | [diagrams/](diagrams/) |

## Tools

### LikeC4 (C4 Diagrams-as-Code)

The source model lives in [`likec4/architecture.c4`](likec4/architecture.c4).

```bash
# Install once
npm install -g @likec4/cli

# Start interactive viewer
cd docs/architecture/likec4
npm start

# Export static PNGs into docs/architecture/diagrams/
npm run export
```

### arc42

The arc42 document is maintained manually in [`arc42/arc42.md`](arc42/arc42.md).
Update it alongside significant code changes, especially when:
- A new component or adapter is introduced
- A new ADR is created
- Deployment topology changes

### ADRs

Create new ADRs when making significant, hard-to-reverse decisions. Use the next sequence number and follow the existing format:

```markdown
# ADR-00X: Title

**Status:** Proposed | Accepted | Deprecated
**Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```

## What Was Retired

The following files have been consolidated into this directory and deleted:
- `ADMIN_SERVICE_ARCHITECTURE.md` → merged into arc42 §5.1.1
- `ARCHITECTURAL_ANALYSIS.md` → merged into arc42 §11 Risks
- `docs/architecture.md` → superseded by arc42
- `docs/architecture/arc42-baseline.md` → superseded by arc42/arc42.md (v1.1)
- `redir-engine/unified_architecture.md` → merged into arc42 §5, §6
- `admin-service/supabase/supabase-architecture.md` → merged into arc42 §5.1.1
