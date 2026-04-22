# Implementation Tasks: Production Secrets Management

## Task 1: Shared Secret Loader Utility
**File:** `admin-service/supabase/server/utils/secrets.ts`, `redir-engine/src/core/config/secrets.ts`
- [ ] Implement `loadSecret(name, envFallback)` — reads `/run/secrets/<name>`, falls back to env var
- [ ] Implement `validateSecrets(required)` — validates all required secrets on startup, fails fast
- [ ] Log which source each secret was loaded from (file vs env) without exposing values
- [ ] Unit tests: file-based loading, env fallback, missing secret throws

## Task 2: Admin Service Startup Validation
**File:** `admin-service/supabase/server/plugins/validate-env.ts`
- [ ] Create Nitro plugin that runs on startup
- [ ] Load secrets via `loadSecret()`: supabase_key, supabase_service_key, sync_api_key, ip_hash_salt
- [ ] Validate non-secret config: SUPABASE_URL (required), LOG_LEVEL, CORS_ALLOWED_ORIGINS, PORT (optional with defaults)
- [ ] Throw on missing required secrets/config in production mode
- [ ] Unit test: missing secrets cause startup failure

## Task 3: Engine Startup Validation
**File:** `redir-engine/runtimes/node/validate-env.ts`
- [ ] Load secrets via `loadSecret()`: sync_api_key
- [ ] Validate non-secret config: ADMIN_SERVICE_URL (required), PORT, ANALYTICS_SERVICE_URL (optional)
- [ ] Throw on missing required secrets/config
- [ ] Unit test: missing secrets cause startup failure

## Task 4: Docker/Podman Compose Production Secrets
**Files:** `docker-compose.prod.yml`, `secrets/`, `.gitignore`
- [ ] Add `secrets:` top-level section with file-based secret definitions
- [ ] Mount secrets to admin, engine, and db services
- [ ] Use `POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password` for Postgres
- [ ] Remove all hardcoded secrets from `docker-compose.prod.yml`
- [ ] Add `secrets/` directory to `.gitignore`
- [ ] Create `secrets/README.md` documenting which files to create
- [ ] Test with both `docker compose` and `podman-compose`

## Task 5: Pre-flight Script
**File:** `scripts/preflight.sh`
- [ ] Check secret files exist in `./secrets/` directory
- [ ] Check Docker/Podman is running
- [ ] Check required ports are available (3001, 3002, 5432, 6379)
- [ ] Check disk space is sufficient
- [ ] Output pass/fail summary with actionable error messages
- [ ] Compatible with both bash (Linux/Mac) and PowerShell (Windows)
- [ ] Make executable and document usage
