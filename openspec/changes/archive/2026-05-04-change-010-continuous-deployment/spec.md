# Specification: Continuous Deployment Pipeline

## Pipeline Architecture
```
Push to main → CI Tests → Build Docker Images → Push to GHCR → Deploy Admin (VPS Staging)
                                                              → Deploy Engine (CF Workers Staging)
Tag vX.Y.Z  → CI Tests → Build Docker Images → Push to GHCR → Approval → Deploy Admin (VPS Prod)
                                                                        → Deploy Engine (CF Workers Prod)
```

## Docker Image Strategy
- **Registry:** GitHub Container Registry (ghcr.io)
- **Image tags:** `latest`, `main-<sha>`, `vX.Y.Z`
- **Multi-stage builds:** Already exist in both Dockerfiles

### Images
| Image | Dockerfile | Tag pattern |
|-------|-----------|-------------|
| `ghcr.io/<owner>/url-redir-admin` | `admin-service/supabase/Dockerfile` | `latest`, `v1.0.0` |
| `ghcr.io/<owner>/url-redir-engine` | `redir-engine/Dockerfile` | `latest`, `v1.0.0` |

## Deployment Targets

### Admin Service + Analytics → VPS (Docker Compose)
- SSH into target VPS
- Pull latest admin image from GHCR
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- Includes: PostgreSQL, Redis/Valkey, Admin Service, Caddy (TLS)
- Health check validation post-deploy

### Redirect Engine → Multi-Platform
The engine is stateless and runtime-agnostic. It deploys to:

| Platform | Method | Config |
|----------|--------|--------|
| **VPS** (co-located) | Docker image from GHCR | Same docker-compose as admin |
| **Cloudflare Workers** | `wrangler deploy` | `redir-engine/runtimes/cf-worker/wrangler.toml` |
| **AWS Lambda/ECS** | Docker image or Lambda package | AWS-specific workflow |

Each engine instance connects to the Admin Service SSE endpoint for state sync, regardless of where it runs.

## Workflow Files

### `ci-cd.yml` (extends existing `ci.yml`)
- **Trigger:** Push to main, tags `v*`
- **Jobs:**
  1. `test` — Existing test suite
  2. `build` — Build and push Docker images (depends on test)
  3. `deploy-staging` — Auto-deploy to staging (depends on build)
  4. `deploy-production` — Manual approval + deploy (on tags only)

## Health Check Validation
After deployment, validate:
- Admin Service: `GET /api/health` returns 200
- Redirect Engine: `GET /health` returns 200
- SSE connection established (engine → admin)

## Rollback Procedure
1. Identify last known good image tag
2. Update deployment to use previous tag
3. Verify health checks pass
4. Investigate root cause
