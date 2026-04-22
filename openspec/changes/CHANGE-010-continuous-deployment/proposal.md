# Change Proposal: Continuous Deployment Pipeline

## Problem
The CI pipeline (`ci.yml`) only runs tests. There is no automated deployment to staging or production environments. Deployments must be done manually, increasing risk of human error and slowing release cycles.

## Opportunity
Adding CD pipelines with Docker image building, registry push, and automated deployment enables reliable, repeatable releases with rollback capability.

## Success Metrics
- Docker images built and pushed to container registry on main branch merge
- Staging deployment triggered automatically after tests pass
- Production deployment triggered manually (approval gate) or on tag
- Rollback to previous version possible within minutes
- Deployment status visible in GitHub

## Scope
- Docker image build and push workflow
- Staging auto-deploy workflow
- Production deploy workflow with approval
- Container registry configuration (GHCR)
- Deployment to target platform (Docker Compose on VPS, or Fly.io/Railway)
