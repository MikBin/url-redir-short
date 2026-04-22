# Specification: Backup and Disaster Recovery

## Backup Strategy

### Database Backups
- **Method:** `pg_dump` with custom format for selective restore
- **Schedule:** Daily at 02:00 UTC
- **Retention:** 30 daily + 4 weekly + 3 monthly
- **Storage:** Local volume + remote (S3-compatible or rsync to off-site)

### Backup Types
| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Full dump | Daily | 30 days | `pg_dump -Fc` |
| Weekly snapshot | Weekly (Sunday) | 4 weeks | Copy of daily |
| Monthly archive | Monthly (1st) | 3 months | Copy of daily |

### Backup Script
```bash
# scripts/backup.sh
pg_dump -Fc -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).dump
```

## Disaster Recovery

### Recovery Targets
| Metric | Target |
|--------|--------|
| **RPO** (Recovery Point Objective) | < 24 hours (last daily backup) |
| **RTO** (Recovery Time Objective) | < 1 hour |

### Restore Procedure
1. Identify the backup to restore from
2. Stop the Admin Service
3. `pg_restore -d $POSTGRES_DB backup_file.dump`
4. Run migration validation
5. Restart Admin Service
6. Verify SSE sync re-establishes
7. Validate data integrity via health checks

## Monitoring
- Backup completion logged with size and duration
- Alert if backup fails or is older than 25 hours
- Monthly restore drill (documented)
