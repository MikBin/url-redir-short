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

## Review Log

**Date:** 2026-09-29 · **Reviewer:** nw-platform-architect-reviewer (Kilo) + nw-software-crafter-reviewer (Kilo)
**Verdict:** NEEDS_REVISION — backlog false negative: ~60% implemented in reality (0% claimed). Scripts are decent drafts but have silent-failure paths.

**Findings (priority order):**

- `issue (blocking):` `scripts/backup.sh:46-55` — if docker exists but the `url-redir-db` container is down, the `elif` chain never falls through and the script exits 0 with no backup: false success, RPO blown silently. Rebuild as a fallback cascade and fail hard.
- `issue (blocking):` `scripts/restore.sh` — no confirmation prompt / `--force` flag and no safety backup before a destructive `pg_restore --clean --if-exists` (Task 2 checkboxes unchecked and correctly so, but the script already ships and is dangerous as-is). Restore also stops only admin, not engine — the engine can write analytics mid-restore.
- `suggestion (non-blocking):` Task 3 has no `backup` service in `docker-compose.prod.yml`, and nobody owns the 02:00 UTC cron from `backup-dr.md:39-42` — no scheduler is defined anywhere in the repo; backups happen only if an operator hand-installed cron.
- `suggestion (non-blocking):` No off-site automation, no backup-age alerting, engine analytics not covered by the backup scope.
- `nitpick (non-blocking):` Task 4 file is named `docs/operations/backup-restore.md` but the existing doc is `docs/operations/backup-dr.md` — reconcile.
- `praise:` Retention tiers, size/duration logging, and documented RPO/RTO in `backup-dr.md` show real operational thinking — the foundation is solid once the failure paths are fixed.
