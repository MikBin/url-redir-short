# Change Proposal: Production Secrets Management

## Problem
The `docker-compose.yml` contains hardcoded development secrets (Supabase keys, database passwords, sync API keys). This is acceptable for local development but a critical security risk if used in production.

## Opportunity
Implementing proper secrets management ensures production deployments never expose sensitive credentials in source control or configuration files.

## Success Metrics
- Zero hardcoded secrets in production configuration
- Docker secrets or environment variable injection from external source
- `.env.production.example` template documenting all required secrets
- Validation script that checks all required secrets are set before startup

## Scope
- Remove hardcoded secrets from production docker-compose
- Create startup validation for required environment variables
- Document secrets management options (Docker secrets, cloud provider vaults)
- Add pre-flight check script
