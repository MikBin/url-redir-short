# Implementation Plan: Production Secrets Management

## Phase 1: Environment Variable Validation
- [ ] Add startup secret validation to Admin Service (`server/plugins/validate-env.ts`)
- [ ] Add startup secret validation to Redirect Engine (`runtimes/node/validate-env.ts`)
- [ ] Define required vs optional env vars per service
- [ ] Fail fast with descriptive error messages

## Phase 2: Production Configuration
- [ ] Create `.env.production.example` with all required secrets documented
- [ ] Update `docker-compose.prod.yml` to use Docker secrets or env_file
- [ ] Remove all hardcoded secrets from committed files
- [ ] Add `.env.production` to `.gitignore`

## Phase 3: Pre-flight Script
- [ ] Create `scripts/preflight.sh` to validate environment before deployment
- [ ] Check: all secrets set, ports available, Docker running, disk space
- [ ] Output clear pass/fail report

## Phase 4: Documentation
- [ ] Create `docs/deployment/secrets.md` with setup guide
- [ ] Document Docker secrets workflow
- [ ] Document cloud provider integrations (AWS SSM, GCP Secret Manager)
- [ ] Add security checklist for production deployments
