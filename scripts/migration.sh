#!/bin/bash
set -e

# Wrapper script for Supabase migration operations
# Usage: ./scripts/migration.sh <command> [args...]

SUPABASE_DIR="admin-service/supabase"

cd "$SUPABASE_DIR" || exit 1

case "$1" in
  new)
    if [ -z "$2" ]; then
      echo "Error: Migration name required."
      echo "Usage: ./scripts/migration.sh new <name>"
      exit 1
    fi
    npx -y supabase@latest migration new "$2"

    # Add a template with rollback section to the newly created migration
    MIGRATION_FILE=$(ls supabase/migrations/*_"$2".sql | tail -n 1)
    if [ -f "$MIGRATION_FILE" ]; then
      cat << EOF > "$MIGRATION_FILE"
-- Migration: $2
-- Description:

-- ==============================================================================
-- UP MIGRATION
-- ==============================================================================


-- ==============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- ==============================================================================
/*
-- Rollback instructions:
-- Put the SQL to revert the above changes here.

*/
EOF
      echo "Added template with rollback section to $MIGRATION_FILE"
    fi
    ;;
  reset)
    echo "Resetting local database and applying all migrations..."
    npx -y supabase@latest db reset
    ;;
  push)
    echo "Pushing migrations to remote..."
    npx -y supabase@latest db push
    ;;
  status)
    echo "Showing migration status..."
    npx -y supabase@latest migration list
    ;;
  generate)
    if [ -z "$2" ]; then
      echo "Error: Migration name required."
      echo "Usage: ./scripts/migration.sh generate <name>"
      exit 1
    fi
    echo "Generating migration from schema changes..."
    npx -y supabase@latest db diff -f "$2"

    # Add a template with rollback section to the newly generated migration
    MIGRATION_FILE=$(ls supabase/migrations/*_"$2".sql | tail -n 1)
    if [ -f "$MIGRATION_FILE" ]; then
      # Create a temporary file
      TEMP_FILE=$(mktemp)

      cat << EOF > "$TEMP_FILE"
-- Migration: $2 (Generated)
-- Description:

-- ==============================================================================
-- UP MIGRATION
-- ==============================================================================
EOF

      # Append the generated diff
      cat "$MIGRATION_FILE" >> "$TEMP_FILE"

      # Append the rollback section
      cat << EOF >> "$TEMP_FILE"

-- ==============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- ==============================================================================
/*
-- Rollback instructions:
-- Put the SQL to revert the above changes here.

*/
EOF

      # Replace original with template
      mv "$TEMP_FILE" "$MIGRATION_FILE"
      echo "Added template with rollback section to generated $MIGRATION_FILE"
    fi
    ;;
  *)
    echo "Usage: ./scripts/migration.sh {new|reset|push|status|generate} [args...]"
    exit 1
    ;;
esac
