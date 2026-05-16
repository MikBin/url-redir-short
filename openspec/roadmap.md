# OpenSpec — Implementation Roadmap

> Changes still to be implemented (archived ones excluded).

```mermaid
flowchart TD
    %% ── Nodes ──────────────────────────────────────────────────────────
    C001["CHANGE-001\nCSV Bulk Import"]
    C003["CHANGE-003\nAdvanced QR Branding"]
    C007["CHANGE-007\nObservability Stack"]
    C011["CHANGE-011\nBackup & Disaster Recovery"]
    C012["CHANGE-012\nDistributed Rate Limiting\n(SUSPENDED)"]
    C013["CHANGE-013\nRBAC & SSO"]
    SSF["supabase-signup-flow\nServer-side Registration"]
    UQ["usage-quotas\nUsage Quota Engine"]
    MPD["multi-platform-deploy-templates\nRuntime Portability & Deploy Templates"]

    %% ── Dependencies ───────────────────────────────────────────────────
    SSF --> UQ
    UQ  --> C013

    C007 --> C011
    C012 -.->|Suspended| C007

    %% ── Styling ────────────────────────────────────────────────────────
    classDef betaReady   fill:#1e3a5f,stroke:#4a90d9,color:#e0f0ff
    classDef infra       fill:#2a1e3f,stroke:#9b59b6,color:#f0e6ff
    classDef feature     fill:#1e3f2a,stroke:#27ae60,color:#e6fff0
    classDef standalone  fill:#3f2a1e,stroke:#e67e22,color:#fff3e0
    classDef suspended   fill:#333333,stroke:#666666,color:#999999,stroke-dasharray: 5 5

    class SSF,UQ,C013 betaReady
    class C007,C011 infra
    class C012 suspended
    class C003,C001 feature
    class MPD standalone
```

## Legend

| Colour | Group | Rationale |
|--------|-------|-----------|
| 🔵 Blue | **Beta Readiness** | Must ship before / during public beta: signup gate → quota enforcement → RBAC |
| 🟣 Purple | **Infrastructure** | Ops hardening: distributed rate limiting feeds observability; observability gates backup strategy |
| 🟢 Green | **Feature Expansion** | Value-add features with no hard upstream deps (CSV bulk import, QR branding) |
| 🟠 Orange | **Standalone** | Multi-platform deploy templates — infrastructure-adjacent but fully independent |

## Dependency Notes

### Beta Readiness chain (strict precedence)
1. **`supabase-signup-flow`** — prerequisite for everything else in this chain; adds the server-side registration endpoint that quota and RBAC hooks attach to.
2. **`usage-quotas`** — depends on `supabase-signup-flow` (Supabase stack) to wire quota checks at registration; can proceed in parallel for the PocketBase stack.
3. **`CHANGE-013` (RBAC & SSO)** — logically follows quotas; once per-user limits exist, role-based permission boundaries are the next layer of access control.

### Infrastructure chain (loose precedence)
1. **`CHANGE-012`** (Distributed Rate Limiting) — **[SUSPENDED]** Replaces in-memory limiters with Redis. Priority has shifted to admin usage limits.
2. **`CHANGE-007`** (Observability Stack) — Best implemented after distributed rate limiting is in place (or if decided otherwise) so dashboards capture cross-instance metrics.
3. **`CHANGE-011`** (Backup & DR) — depends on a stable, observable system; the backup health alerting plugs into the monitoring stack from CHANGE-007.

### Independent changes
- **`CHANGE-001`** (CSV Bulk Import) — admin UI feature, no upstream deps.
- **`CHANGE-003`** (Advanced QR Branding) — UI/storage feature, no upstream deps.
- **`multi-platform-deploy-templates`** — engine portability docs and new runtimes; touches no shared state with any other change.
