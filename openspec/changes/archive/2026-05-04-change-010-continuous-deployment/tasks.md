# Implementation Tasks: Continuous Deployment Pipeline

## Task 1: Docker Image Build Workflow
**File:** `.github/workflows/build-images.yml`
- [x] Trigger on push to main and tags `v*`
- [x] Log in to GitHub Container Registry
- [x] Build admin-service image with Docker metadata (tags, labels)
- [x] Build redir-engine image with Docker metadata
- [x] Push both images to ghcr.io
- [x] Output image tags for downstream jobs
- [x] Test: verify images are pushed correctly

## Task 2: VPS Deployment Workflow (Admin Service)
**File:** `.github/workflows/deploy-vps.yml`
- [x] Trigger after build-images workflow completes (staging) or on tags (production)
- [x] SSH into target VPS (using GitHub secrets for SSH key)
- [x] Pull latest admin image from GHCR
- [x] Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
- [x] Wait for health checks: `GET /api/health` returns 200
- [x] Post deployment status to GitHub
- [x] Slack/email notification on failure
- [x] Production requires approval from `production` GitHub environment

## Task 3: Cloudflare Workers Deployment (Engine)
**File:** `.github/workflows/deploy-cf-worker.yml`
- [x] Trigger after CI tests pass on main (staging) or on tags (production)
- [x] Install wrangler CLI
- [x] Set `ADMIN_SERVICE_URL` and `SYNC_API_KEY` via `wrangler secret put`
- [x] Run `wrangler deploy` from `redir-engine/runtimes/cf-worker/`
- [x] Validate health check on deployed worker URL
- [x] Support staging vs production environments via wrangler environments
- [x] Production requires approval from `production` GitHub environment

## Task 4: AWS Deployment (Engine — Optional)
**File:** `.github/workflows/deploy-aws.yml`
- [x] Build and push engine Docker image to AWS ECR
- [x] Deploy to ECS/Fargate or Lambda
- [x] Configure ADMIN_SERVICE_URL pointing to VPS admin
- [x] Health check validation
- [x] Document AWS-specific secrets required (AWS credentials)

## Task 5: Deployment Documentation
**File:** `docs/deployment/cd-pipeline.md`
- [x] Document pipeline architecture and multi-platform strategy
- [x] Document GitHub secrets required per platform (SSH keys, Cloudflare API token, AWS credentials)
- [x] Document image tagging strategy
- [x] Document rollback procedure per platform (VPS, CF Workers, AWS)
- [x] Document environment setup (staging, production)
