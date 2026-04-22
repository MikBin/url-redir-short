# Specification: Continuous Deployment Pipeline

## Pipeline Architecture
```
Push to main → CI Tests → Build Docker Images → Push to GHCR → Deploy Staging
Tag vX.Y.Z → CI Tests → Build Docker Images → Push to GHCR → Approval → Deploy Production
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

### Option A: Docker Compose on VPS
- SSH into target server
- Pull latest images from GHCR
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- Health check validation post-deploy

### Option B: Fly.io / Railway
- Platform-specific deploy commands
- Config files (`fly.toml` or `railway.json`)

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
