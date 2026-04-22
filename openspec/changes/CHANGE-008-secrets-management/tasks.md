# Implementation Tasks: Production Secrets Management

## Task 1: Admin Service Environment Validation
**File:** `admin-service/supabase/server/plugins/validate-env.ts`
- [ ] Create Nitro plugin that runs on startup
- [ ] Validate required: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, SYNC_API_KEY, IP_HASH_SALT
- [ ] Validate optional with defaults: LOG_LEVEL, CORS_ALLOWED_ORIGINS, PORT
- [ ] Log validated config summary (without exposing secret values)
- [ ] Throw on missing required vars in production mode
- [ ] Unit test: missing vars cause startup failure

## Task 2: Engine Environment Validation
**File:** `redir-engine/runtimes/node/validate-env.ts`
- [ ] Validate required: ADMIN_SERVICE_URL, SYNC_API_KEY
- [ ] Validate optional with defaults: PORT, ANALYTICS_SERVICE_URL
- [ ] Throw on missing required vars
- [ ] Unit test: missing vars cause startup failure

## Task 3: Production Environment Template
**Files:** `.env.production.example`, `docker-compose.prod.yml`
- [ ] Create `.env.production.example` with all secrets documented
- [ ] Update docker-compose.prod.yml to use `env_file: .env.production`
- [ ] Add `.env.production` to `.gitignore`
- [ ] Verify no hardcoded secrets remain in committed files

## Task 4: Pre-flight Script
**File:** `scripts/preflight.sh`
- [ ] Check all required env vars are set
- [ ] Check Docker/Podman is running
- [ ] Check required ports are available
- [ ] Check disk space is sufficient
- [ ] Output pass/fail summary with actionable error messages
- [ ] Make executable and document usage
