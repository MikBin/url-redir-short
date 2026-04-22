#!/bin/sh
set -e

# Load secrets from files if _FILE env vars are set
for secret in POSTGRES_PASSWORD SUPABASE_KEY SUPABASE_SERVICE_KEY SYNC_API_KEY IP_HASH_SALT SUPABASE_JWT_SECRET; do
  file_var="${secret}_FILE"
  # Use eval to get the value of the variable whose name is stored in file_var
  eval file_path=\$$file_var
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    export "$secret"=$(cat "$file_path")
    echo "Loaded $secret from $file_path"
  fi
done

exec "$@"
