#!/usr/bin/env bash
set -e

SECRETS_DIR="$(dirname "$0")/../secrets"
mkdir -p "$SECRETS_DIR"

SECRETS=(
  "POSTGRES_PASSWORD"
  "SUPABASE_KEY"
  "SUPABASE_SERVICE_KEY"
  "SYNC_API_KEY"
  "IP_HASH_SALT"
  "SUPABASE_JWT_SECRET"
)

echo "Initializing secrets in $SECRETS_DIR"
echo "----------------------------------------"

for secret in "${SECRETS[@]}"; do
  file_path="$SECRETS_DIR/${secret}.txt"
  if [ -f "$file_path" ]; then
    echo "✓ $secret already exists"
  else
    # Check if env var is set
    eval env_val=\$$secret
    if [ -n "$env_val" ]; then
      echo -n "$env_val" > "$file_path"
      echo "✓ Created $secret from environment variable"
    else
      read -p "Enter value for $secret: " -s user_val
      echo ""
      if [ -n "$user_val" ]; then
        echo -n "$user_val" > "$file_path"
        echo "✓ Created $secret from user input"
      else
        echo "✗ Skipped $secret (empty value)"
      fi
    fi
    # Ensure correct permissions
    if [ -f "$file_path" ]; then
      chmod 600 "$file_path"
    fi
  fi
done

echo "----------------------------------------"
echo "Setup complete."
