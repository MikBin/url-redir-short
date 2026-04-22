# Implementation Tasks: Production Secrets Management

## Task 1: Shared Secret Loader Utility
**File:** `admin-service/supabase/server/utils/secrets.ts`, `redir-engine/src/core/config/secrets.ts`
- [x] Implement `loadSecret(name, envFallback)` — reads `/run/secrets/<name>`, falls back to env var
- [x] Implement `validateSecrets(required)` — validates all required secrets on startup, fails fast
- [x] Log which source each secret was loaded from (file vs env) without exposing values
- [x] Unit tests: file-based loading, env fallback, missing secret throws

## Task 2: Admin Service Startup Validation
**File:** `admin-service/supabase/server/plugins/validate-env.ts`
- [x] Create Nitro plugin that runs on startup
- [x] Load secrets via `loadSecret()`: supabase_key, supabase_service_key, sync_api_key, ip_hash_salt
- [x] Validate non-secret config: SUPABASE_URL (required), LOG_LEVEL, CORS_ALLOWED_ORIGINS, PORT (optional with defaults)
- [x] Throw on missing required secrets/config in production mode
- [x] Unit test: missing secrets cause startup failure

## Task 3: Engine Startup Validation
**File:** `redir-engine/runtimes/node/validate-env.ts`
- [x] Load secrets via `loadSecret()`: sync_api_key
- [x] Validate non-secret config: ADMIN_SERVICE_URL (required), PORT, ANALYTICS_SERVICE_URL (optional)
- [x] Throw on missing required secrets/config
- [x] Unit test: missing secrets cause startup failure

## Task 4: Docker/Podman Compose Production Secrets
**Files:** `docker-compose.prod.yml`, `secrets/`, `.gitignore`
- [x] Add `secrets:` top-level section with file-based secret definitions
- [x] Mount secrets to admin, engine, and db services
- [x] Use `POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password` for Postgres
- [x] Remove all hardcoded secrets from `docker-compose.prod.yml`
- [x] Add `secrets/` directory to `.gitignore`
- [x] Create `secrets/README.md` documenting which files to create
- [x] Test with both `docker compose` and `podman-compose`

## Task 5: Pre-flight Script
**File:** `scripts/preflight.sh`
- [x] Check secret files exist in `./secrets/` directory
- [x] Check Docker/Podman is running
- [x] Check required ports are available (3001, 3002, 5432, 6379)
- [x] Check disk space is sufficient
- [x] Output pass/fail summary with actionable error messages
- [x] Compatible with both bash (Linux/Mac) and PowerShell (Windows)
- [x] Make executable and document usage
