# Implementation Plan: Continuous Deployment Pipeline

## Phase 1: Docker Image Build Workflow
- [ ] Create `.github/workflows/build-images.yml`
- [ ] Build admin and engine Docker images on main branch push
- [ ] Push to GitHub Container Registry (ghcr.io)
- [ ] Tag with commit SHA and `latest`
- [ ] Tag with version on git tags `v*`

## Phase 2: VPS Deployment (Admin Service + Analytics)
- [ ] Create `.github/workflows/deploy-vps.yml`
- [ ] SSH-based deployment to VPS
- [ ] Pull images from GHCR, run docker compose with production overlay
- [ ] Health check validation post-deploy
- [ ] Staging auto-deploy on main, production deploy on tags with approval

## Phase 3: Cloudflare Workers Deployment (Engine)
- [ ] Create `.github/workflows/deploy-cf-worker.yml`
- [ ] Install wrangler, configure secrets, run `wrangler deploy`
- [ ] Support staging/production wrangler environments
- [ ] Health check validation on deployed worker URL

## Phase 4: AWS Deployment (Engine — Optional)
- [ ] Create `.github/workflows/deploy-aws.yml`
- [ ] Push engine image to AWS ECR, deploy to ECS/Fargate
- [ ] Configure SSE sync back to VPS admin service

## Phase 5: Documentation
- [ ] Create `docs/deployment/cd-pipeline.md`
- [ ] Document multi-platform deployment strategy
- [ ] Document rollback procedure per platform
- [ ] Document environment variable and secrets configuration per platform
