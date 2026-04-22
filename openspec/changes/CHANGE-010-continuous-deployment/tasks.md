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

## Task 2: Staging Deployment Workflow
**File:** `.github/workflows/deploy-staging.yml`
- [ ] Trigger after build-images workflow completes
- [ ] SSH into staging server (using GitHub secrets for SSH key)
- [ ] Pull latest images from GHCR
- [ ] Run `docker compose up -d` with production overlay
- [ ] Wait for health checks to pass
- [ ] Post deployment status to GitHub
- [ ] Slack/email notification on failure

## Task 3: Production Deployment Workflow
**File:** `.github/workflows/deploy-production.yml`
- [ ] Trigger on version tags `v*`
- [ ] Require approval from `production` GitHub environment
- [ ] Same deploy steps as staging but targeting production server
- [ ] Run smoke tests after deployment
- [ ] Create GitHub release with changelog

## Task 4: Deployment Documentation
**File:** `docs/deployment/cd-pipeline.md`
- [ ] Document pipeline architecture and workflow
- [ ] Document GitHub secrets required (SSH keys, registry token)
- [ ] Document image tagging strategy
- [ ] Document rollback procedure step-by-step
- [ ] Document environment setup (staging, production)
