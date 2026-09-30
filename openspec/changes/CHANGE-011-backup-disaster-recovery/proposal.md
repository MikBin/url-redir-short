# Change Proposal: Backup and Disaster Recovery

> [!NOTE]
> **POSTPONED (2026-09-30, ADR-007):** deferred in favor of the `public-share-shortener` goal (which ships a minimal PocketBase ZIP-backup cron of its own). See `openspec/roadmap.md`.

## Problem
There is no automated backup strategy for the PostgreSQL database or any disaster recovery plan. Data loss from hardware failure, accidental deletion, or corruption would be unrecoverable.

## Opportunity
Implementing automated backups with tested restore procedures ensures business continuity and data protection for production deployments.

## Success Metrics
- Automated daily database backups
- Backup retention policy (30 days)
- Tested restore procedure with documented RTO/RPO
- Backup health monitoring and alerting
- Off-site backup storage

## Scope
- PostgreSQL backup scripts (pg_dump based)
- Automated backup scheduling (cron or GitHub Actions)
- Backup storage configuration (local + remote)
- Restore procedure documentation and testing
- Backup monitoring and alerting
