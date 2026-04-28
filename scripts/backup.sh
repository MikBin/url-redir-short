#!/usr/bin/env bash
# scripts/backup.sh
# Automates PostgreSQL backups with retention policy (30d/4w/3m)
# Usage: ./scripts/backup.sh [daily|weekly|monthly]

set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/../backups"
LOG_FILE="$BACKUP_DIR/backup.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_STAMP=$(date +%Y%m%d)
DAY_OF_WEEK=$(date +%u) # 1-7, 7 is Sunday
DAY_OF_MONTH=$(date +%d) # 01-31

# Database Configuration (Defaults or from environment/secrets)
DB_CONTAINER="url-redir-db"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PASSWORD_FILE="$(dirname "$0")/../secrets/POSTGRES_PASSWORD.txt"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Load password if file exists
if [ -f "$POSTGRES_PASSWORD_FILE" ]; then
  export PGPASSWORD=$(cat "$POSTGRES_PASSWORD_FILE")
fi

log "Starting backup process..."

# Determine backup file name
BACKUP_FILE="backup_$TIMESTAMP.dump"
DAILY_PATH="$BACKUP_DIR/daily/$BACKUP_FILE"

# Perform backup
log "Creating full dump to $DAILY_PATH..."

# Try docker exec first, fallback to local pg_dump
if command -v docker >/dev/null 2>&1 || command -v docker.exe >/dev/null 2>&1; then
  DOCKER_CMD=$(command -v docker || command -v docker.exe)
  if $DOCKER_CMD ps --format '{{.Names}}' | grep -q "$DB_CONTAINER"; then
    $DOCKER_CMD exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DAILY_PATH"
  fi
elif command -v podman >/dev/null 2>&1 || command -v podman.exe >/dev/null 2>&1; then
  PODMAN_CMD=$(command -v podman || command -v podman.exe)
  if $PODMAN_CMD ps --format '{{.Names}}' | grep -q "$DB_CONTAINER"; then
    $PODMAN_CMD exec -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DAILY_PATH"
  fi
elif command -v pg_dump >/dev/null 2>&1 || command -v pg_dump.exe >/dev/null 2>&1; then
  PG_DUMP_CMD=$(command -v pg_dump || command -v pg_dump.exe)
  $PG_DUMP_CMD -Fc -h "${POSTGRES_HOST:-localhost}" -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DAILY_PATH"
else
  log "ERROR: Neither docker/podman container '$DB_CONTAINER' nor local pg_dump found."
  exit 1
fi

FILE_SIZE=$(du -h "$DAILY_PATH" | cut -f1)
log "Backup completed successfully ($FILE_SIZE)"

# ------------------------------------------------------------------------------
# Retention Logic
# ------------------------------------------------------------------------------

# 1. Weekly Snapshot (on Sundays)
if [ "$DAY_OF_WEEK" -eq 7 ] || [ "$1" == "weekly" ]; then
  log "Sunday detected. Creating weekly snapshot..."
  cp "$DAILY_PATH" "$BACKUP_DIR/weekly/weekly_$DATE_STAMP.dump"
fi

# 2. Monthly Archive (on the 1st)
if [ "$DAY_OF_MONTH" -eq "01" ] || [ "$1" == "monthly" ]; then
  log "1st of the month detected. Creating monthly archive..."
  cp "$DAILY_PATH" "$BACKUP_DIR/monthly/monthly_$DATE_STAMP.dump"
fi

# 3. Cleanup Old Backups
log "Cleaning up old backups..."

# Daily: 30 days
find "$BACKUP_DIR/daily" -name "backup_*.dump" -mtime +30 -delete
# Weekly: 4 weeks (28 days)
find "$BACKUP_DIR/weekly" -name "weekly_*.dump" -mtime +28 -delete
# Monthly: 3 months (90 days)
find "$BACKUP_DIR/monthly" -name "monthly_*.dump" -mtime +90 -delete

log "Retention cleanup complete."
log "Backup process finished."
