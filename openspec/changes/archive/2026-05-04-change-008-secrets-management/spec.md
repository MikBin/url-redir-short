# Specification: Production Secrets Management

## Compatibility
- **Docker Compose** and **Podman Compose** both supported
- File-based secrets (`/run/secrets/`) are the primary mechanism (reliable on both runtimes)
- `type: env` secrets are NOT used (open compatibility issue with podman-compose)

## Secret Inventory

| Secret | Service | Purpose |
|--------|---------|---------|
| `POSTGRES_PASSWORD` | DB | Database authentication |
| `SUPABASE_KEY` | Admin | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Admin | Supabase service role key |
| `SYNC_API_KEY` | Admin, Engine | SSE sync authentication |
| `IP_HASH_SALT` | Admin | IP anonymization salt |
| `SUPABASE_JWT_SECRET` | Admin | JWT token signing |

## Approach: File-Based Docker/Podman Secrets

### Secret Files (Development)
```bash
# Create secrets directory (gitignored)
mkdir -p secrets
echo -n "your-postgres-password" > secrets/postgres_password.txt
echo -n "your-supabase-key" > secrets/supabase_key.txt
echo -n "your-supabase-service-key" > secrets/supabase_service_key.txt
echo -n "your-sync-api-key" > secrets/sync_api_key.txt
echo -n "your-ip-hash-salt" > secrets/ip_hash_salt.txt
echo -n "your-jwt-secret" > secrets/supabase_jwt_secret.txt
chmod 600 secrets/*.txt
```

### Compose Configuration
```yaml
# docker-compose.prod.yml
services:
  db:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password

  admin:
    secrets:
      - supabase_key
      - supabase_service_key
      - sync_api_key
      - ip_hash_salt

  engine:
    secrets:
      - sync_api_key

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  supabase_key:
    file: ./secrets/supabase_key.txt
  supabase_service_key:
    file: ./secrets/supabase_service_key.txt
  sync_api_key:
    file: ./secrets/sync_api_key.txt
  ip_hash_salt:
    file: ./secrets/ip_hash_salt.txt
```

### External Secrets (Production — pre-created via CLI)
```bash
echo -n "prod-password" | podman secret create postgres_password -
echo -n "prod-key" | podman secret create supabase_key -
```
```yaml
secrets:
  postgres_password:
    external: true
  supabase_key:
    external: true
```

## Runtime Secret Loading

Services read secrets from `/run/secrets/<name>` files at startup. A shared utility reads file-based secrets and falls back to environment variables for backward compatibility:

```typescript
function loadSecret(name: string, envFallback: string): string {
  const filePath = `/run/secrets/${name}`
  try {
    return readFileSync(filePath, 'utf-8').trim()
  } catch {
    const envValue = process.env[envFallback]
    if (!envValue) {
      throw new Error(`Secret "${name}" not found at ${filePath} and env ${envFallback} is not set`)
    }
    return envValue
  }
}
```

## Startup Validation

Both services MUST validate all required secrets on startup and fail fast:

```typescript
function validateSecrets(required: Array<{ secret: string; envFallback: string }>): Record<string, string> {
  const resolved: Record<string, string> = {}
  const missing: string[] = []
  for (const { secret, envFallback } of required) {
    try {
      resolved[secret] = loadSecret(secret, envFallback)
    } catch {
      missing.push(secret)
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`)
  }
  return resolved
}
```

## Pre-flight Script
`scripts/preflight.sh` — checks secret files exist in `./secrets/` OR env vars are set before docker/podman compose up.

## Cloud Provider Integration
For managed deployments, secrets can be injected via:
- **AWS:** SSM Parameter Store → env vars in ECS/Lambda
- **Cloudflare Workers:** `wrangler secret put` → available via `env.SECRET_NAME`
- Cloud secrets are loaded as env vars, caught by the `envFallback` path
