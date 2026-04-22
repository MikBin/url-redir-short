# Implementation Tasks: Continuous Deployment Pipeline

## Task 1: Docker Image Build Workflow
**File:** `.github/workflows/build-images.yml`
- [ ] Trigger on push to main and tags `v*`
- [ ] Log in to GitHub Container Registry
- [ ] Build admin-service image with Docker metadata (tags, labels)
- [ ] Build redir-engine image with Docker metadata
- [ ] Push both images to ghcr.io
- [ ] Output image tags for downstream jobs
- [ ] Test: verify images are pushed correctly

## Task 2: VPS Deployment Workflow (Admin Service)
**File:** `.github/workflows/deploy-vps.yml`
- [ ] Trigger after build-images workflow completes (staging) or on tags (production)
- [ ] SSH into target VPS (using GitHub secrets for SSH key)
- [ ] Pull latest admin image from GHCR
- [ ] Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- [ ] Wait for health checks: `GET /api/health` returns 200
- [ ] Post deployment status to GitHub
- [ ] Slack/email notification on failure
- [ ] Production requires approval from `production` GitHub environment

## Task 3: Cloudflare Workers Deployment (Engine)
**File:** `.github/workflows/deploy-cf-worker.yml`
- [ ] Trigger after CI tests pass on main (staging) or on tags (production)
- [ ] Install wrangler CLI
- [ ] Set `ADMIN_SERVICE_URL` and `SYNC_API_KEY` via `wrangler secret put`
- [ ] Run `wrangler deploy` from `redir-engine/runtimes/cf-worker/`
- [ ] Validate health check on deployed worker URL
- [ ] Support staging vs production environments via wrangler environments
- [ ] Production requires approval from `production` GitHub environment

## Task 4: AWS Deployment (Engine — Optional)
**File:** `.github/workflows/deploy-aws.yml`
- [ ] Build and push engine Docker image to AWS ECR
- [ ] Deploy to ECS/Fargate or Lambda
- [ ] Configure ADMIN_SERVICE_URL pointing to VPS admin
- [ ] Health check validation
- [ ] Document AWS-specific secrets required (AWS credentials)

## Task 5: Deployment Documentation
**File:** `docs/deployment/cd-pipeline.md`
- [ ] Document pipeline architecture and multi-platform strategy
- [ ] Document GitHub secrets required per platform (SSH keys, Cloudflare API token, AWS credentials)
- [ ] Document image tagging strategy
- [ ] Document rollback procedure per platform (VPS, CF Workers, AWS)
- [ ] Document environment setup (staging, production)
