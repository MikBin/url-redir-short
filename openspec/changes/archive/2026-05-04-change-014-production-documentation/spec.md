# Specification: Production Documentation

## Documentation Structure
```
README.md                          ← Project overview, quick start
docs/
├── getting-started.md             ← Developer onboarding
├── architecture.md                ← System architecture (from ARCHITECTURAL_ANALYSIS.md)
├── deployment/
│   ├── quick-start.md             ← Single-server deployment guide
│   ├── tls-setup.md               ← HTTPS configuration (CHANGE-006)
│   ├── secrets.md                 ← Secrets management (CHANGE-008)
│   └── cd-pipeline.md             ← CI/CD setup (CHANGE-010)
├── operations/
│   ├── backup-restore.md          ← Backup/DR (CHANGE-011)
│   ├── monitoring.md              ← Observability (CHANGE-007)
│   └── runbook.md                 ← Common operational tasks
├── development/
│   ├── migrations.md              ← Database migrations (CHANGE-009)
│   ├── testing.md                 ← Test guide (unit, E2E, perf)
│   └── contributing.md            ← Contribution guidelines
└── api/
    └── admin-api.md               ← Admin Service API reference
```

## README.md Content
1. Project name, tagline, and badges (CI status, license)
2. Features list (one-liner per feature)
3. Architecture diagram (Mermaid)
4. Quick start (3 commands to run locally)
5. Configuration reference (env vars table)
6. Links to detailed docs
7. License

## API Documentation
- All Admin Service endpoints documented
- Request/response examples
- Authentication requirements
- Rate limiting details
