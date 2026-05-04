# Delta Spec: Backup and Disaster Recovery

## MODIFIED Requirements

### Requirement: NFR-09 - Backup and Disaster Recovery
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Production databases MUST have automated backup schedules and a documented disaster recovery procedure.
- **Implementation:** Automated daily PostgreSQL backups using `pg_dump` via GitHub Actions. Backups are encrypted and stored in an S3-compatible bucket with a 30-day retention policy.
- **Documentation:** `docs/operations/dr-plan.md`
- **Tests:** `admin-service/supabase/tests/backup-validation.test.ts`

#### Scenario: Successful Automated Backup
Given a production database with existing link data
When the daily backup job is triggered at 02:00 UTC
Then a compressed SQL dump MUST be generated successfully
And the dump MUST be uploaded to the secure off-site storage bucket
And a success notification MUST be sent to the monitoring channel

#### Scenario: Database Restore from Backup
Given a catastrophic failure of the production database
When the restore procedure is initiated using the latest backup
Then the database schema and data MUST be restored to a consistent state
And the Redirector Engine MUST resume operations without data loss
