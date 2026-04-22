# Specification: Production Secrets Management

## Secret Inventory

| Secret | Service | Purpose |
|--------|---------|---------|
| `POSTGRES_PASSWORD` | DB | Database authentication |
| `SUPABASE_KEY` | Admin | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Admin | Supabase service role key |
| `SYNC_API_KEY` | Admin, Engine | SSE sync authentication |
| `IP_HASH_SALT` | Admin | IP anonymization salt |
| `SUPABASE_JWT_SECRET` | Admin | JWT token signing |

## Approach

### Docker Secrets (Primary)
```yaml
# docker-compose.prod.yml
services:
  admin:
    secrets:
      - supabase_key
      - supabase_service_key
      - sync_api_key
secrets:
  supabase_key:
    external: true
```

### Environment Variable Injection (Alternative)
- `.env.production` file (gitignored) with actual values
- `.env.production.example` committed with placeholder descriptions
- Cloud provider secret managers (AWS SSM, GCP Secret Manager, etc.)

## Startup Validation

Both services MUST validate required secrets on startup and fail fast with a clear error message if any are missing:

```typescript
function validateSecrets(required: string[]): void {
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`)
  }
}
```

## Pre-flight Script
`scripts/preflight.sh` — checks all required environment variables are set before docker compose up.
