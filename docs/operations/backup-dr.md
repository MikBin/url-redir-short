# Backup and Disaster Recovery

This document outlines the backup strategy and disaster recovery procedures for the URL Redirector & Shortener service.

## Backup Strategy

### Database Backups
- **Method:** `pg_dump` with custom format (`-Fc`)
- **Schedule:** Daily at 02:00 UTC (recommended via cron)
- **Retention Policy:**
  - **Daily:** 30 days
  - **Weekly:** 4 weeks (snapshots from Sundays)
  - **Monthly:** 3 months (archives from the 1st of the month)

### Automated Backups
The `scripts/backup.sh` script automates the backup process and enforces the retention policy.

#### Usage
```bash
# Run a standard backup (automatically handles daily/weekly/monthly logic)
./scripts/backup.sh

# Force a weekly snapshot
./scripts/backup.sh weekly

# Force a monthly archive
./scripts/backup.sh monthly
```

#### Storage
Backups are stored in the root `backups/` directory:
- `backups/daily/`
- `backups/weekly/`
- `backups/monthly/`

### Scheduling (Cron)
To automate backups, add a cron job to the host system:

```cron
# Run backup every day at 02:00 UTC
0 2 * * * /path/to/project/scripts/backup.sh >> /path/to/project/backups/backup.log 2>&1
```

---

## Disaster Recovery

### Recovery Targets
- **RPO (Recovery Point Objective):** < 24 hours (last daily backup)
- **RTO (Recovery Time Objective):** < 1 hour

### Restore Procedure
The `scripts/restore.sh` script handles the recovery process.

#### 1. Identify the Backup
List available backups to find the desired restore point:
```bash
./scripts/restore.sh
```

#### 2. Perform the Restore
Pass the path of the backup file to the restore script:
```bash
./scripts/restore.sh backups/daily/backup_20260427_020000.dump
```

**What the script does:**
1. Stops the Admin Service (`url-redir-admin`) to prevent concurrent writes.
2. Uses `pg_restore` with `--clean` to overwrite the existing database schema.
3. Restarts the Admin Service.

### Manual Verification
After a restore, verify the system status:
1. Check the Admin Service health: `curl http://localhost:3001/api/health`
2. Verify SSE sync: Check logs of the Redirect Engine for "SSE connection established".
3. Validate data integrity by creating/redirecting a test link.

---

## Remote Storage (Off-site)
It is highly recommended to sync the `backups/` directory to a remote S3-compatible bucket or off-site server using `rsync` or `rclone`.

Example using `rclone`:
```bash
rclone sync ./backups remote:my-bucket/backups
```
