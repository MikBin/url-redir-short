# Implementation Tasks: Backup and Disaster Recovery

## Task 1: Backup Script
**File:** `scripts/backup.sh`
- [ ] Accept environment variables for DB connection
- [ ] Run `pg_dump -Fc` with timestamped output filename
- [ ] Compress output with gzip
- [ ] Implement retention cleanup: delete backups older than policy
- [ ] Log backup size, duration, and status
- [ ] Exit with non-zero code on failure
- [ ] Unit test: mock pg_dump, verify rotation logic

## Task 2: Restore Script
**File:** `scripts/restore.sh`
- [ ] Accept backup filename as argument
- [ ] Prompt for confirmation (with --force flag for automation)
- [ ] Create safety backup of current state before restoring
- [ ] Run `pg_restore` with appropriate flags
- [ ] Post-restore validation: check table existence, row counts
- [ ] Log restore status and duration
- [ ] Test: full backup → modify data → restore → verify original data

## Task 3: Docker Backup Service
**File:** `docker-compose.prod.yml` (update)
- [ ] Add `backup` service using postgres:15-alpine image
- [ ] Mount backup volume for persistent storage
- [ ] Configure cron schedule via environment variable
- [ ] Add health check: verify last backup is recent
- [ ] Optional: S3 sync via rclone or aws-cli

## Task 4: Disaster Recovery Documentation
**File:** `docs/operations/backup-restore.md`
- [ ] Document backup schedule and retention policy
- [ ] Step-by-step restore procedure
- [ ] Monthly drill checklist
- [ ] Decision tree: when to restore vs. point-in-time recovery
- [ ] Contact list and escalation procedures
