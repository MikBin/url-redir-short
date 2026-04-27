#!/usr/bin/env bash
# scripts/restore.sh
# Restores a PostgreSQL backup
# Usage: ./scripts/restore.sh <path_to_backup_file>

set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/../backups"
DB_CONTAINER="url-redir-db"
ADMIN_CONTAINER="url-redir-admin"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_PASSWORD_FILE="$(dirname "$0")/../secrets/POSTGRES_PASSWORD.txt"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# List available backups if no argument provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh <path_to_backup_file>"
  echo ""
  echo "Available backups:"
  echo "------------------"
  find "$BACKUP_DIR" -name "*.dump" | sort -r
  exit 0
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  log "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load password if file exists
if [ -f "$POSTGRES_PASSWORD_FILE" ]; then
  export PGPASSWORD=$(cat "$POSTGRES_PASSWORD_FILE")
fi

log "Starting restore process from $BACKUP_FILE..."

# 1. Stop Admin Service to prevent writes
if command -v docker >/dev/null 2>&1 || command -v docker.exe >/dev/null 2>&1; then
  DOCKER_CMD=$(command -v docker || command -v docker.exe)
  if $DOCKER_CMD ps --format '{{.Names}}' | grep -q "$ADMIN_CONTAINER"; then
    log "Stopping $ADMIN_CONTAINER..."
    $DOCKER_CMD stop "$ADMIN_CONTAINER"
  fi
elif command -v podman >/dev/null 2>&1 || command -v podman.exe >/dev/null 2>&1; then
  PODMAN_CMD=$(command -v podman || command -v podman.exe)
  if $PODMAN_CMD ps --format '{{.Names}}' | grep -q "$ADMIN_CONTAINER"; then
    log "Stopping $ADMIN_CONTAINER..."
    $PODMAN_CMD stop "$ADMIN_CONTAINER"
  fi
fi

# 2. Perform Restore
log "Restoring database..."

if command -v docker >/dev/null 2>&1 || command -v docker.exe >/dev/null 2>&1; then
  DOCKER_CMD=$(command -v docker || command -v docker.exe)
  if $DOCKER_CMD ps --format '{{.Names}}' | grep -q "$DB_CONTAINER"; then
    log "Using $DOCKER_CMD exec to restore..."
    cat "$BACKUP_FILE" | $DOCKER_CMD exec -i -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
  fi
elif command -v podman >/dev/null 2>&1 || command -v podman.exe >/dev/null 2>&1; then
  PODMAN_CMD=$(command -v podman || command -v podman.exe)
  if $PODMAN_CMD ps --format '{{.Names}}' | grep -q "$DB_CONTAINER"; then
    log "Using $PODMAN_CMD exec to restore..."
    cat "$BACKUP_FILE" | $PODMAN_CMD exec -i -e PGPASSWORD="$PGPASSWORD" "$DB_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner
  fi
elif command -v pg_restore >/dev/null 2>&1 || command -v pg_restore.exe >/dev/null 2>&1; then
  PG_RESTORE_CMD=$(command -v pg_restore || command -v pg_restore.exe)
  log "Using local $PG_RESTORE_CMD..."
  $PG_RESTORE_CMD -h "${POSTGRES_HOST:-localhost}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner "$BACKUP_FILE"
else
  log "ERROR: Neither docker/podman container '$DB_CONTAINER' nor local pg_restore found."
  exit 1
fi

log "Restore completed successfully."

# 3. Restart Admin Service
if command -v docker >/dev/null 2>&1 && ! docker ps --format '{{.Names}}' | grep -q "$ADMIN_CONTAINER"; then
  log "Starting $ADMIN_CONTAINER..."
  docker start "$ADMIN_CONTAINER"
elif command -v podman >/dev/null 2>&1 && ! podman ps --format '{{.Names}}' | grep -q "$ADMIN_CONTAINER"; then
  log "Starting $ADMIN_CONTAINER..."
  podman start "$ADMIN_CONTAINER"
fi

log "Restore process finished."
