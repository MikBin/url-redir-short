# Continuous Deployment (CD) Pipeline

This document outlines the Continuous Deployment architecture and procedures for the `url-redir-short` project.

## Pipeline Architecture

The pipeline consists of continuous integration on PRs, and a structured deployment path from main branches to tags.

```text
Push to main → CI Tests → Build Docker Images → Push to GHCR → Deploy Admin (VPS Staging)
                                                              → Deploy Engine (CF Workers Staging)

Tag vX.Y.Z   → CI Tests → Build Docker Images → Push to GHCR → Approval → Deploy Admin (VPS Prod)
                                                                        → Deploy Engine (CF Workers Prod)
```

## Docker Image Strategy

Docker images are built and pushed to the GitHub Container Registry (GHCR).

- **Registry:** `ghcr.io`
- **Owner:** `MikBin`
- **Images:**
  - `ghcr.io/MikBin/url-redir-admin` (Admin Service - Nuxt/Supabase)
  - `ghcr.io/MikBin/url-redir-engine` (Redirect Engine - Node/Hono)

### Tagging
- `latest`: Always points to the most recent build from `main`.
- `main-<short-sha>`: Useful for targeting specific commits from `main`.
- `vX.Y.Z`: Explicit semantic version tags generated when a Git tag is pushed.

## Deployment Targets

### Admin Service
- **Hosting:** VPS instances (Staging and Production) using Docker Compose.
- **Process:** GitHub Actions uses an SSH connection to log into the VPS and execute `scripts/deploy-staging.sh` or `scripts/deploy-production.sh`.

### Redirect Engine
- **Hosting:** Cloudflare Workers.
- **Process:** GitHub Actions uses the `wrangler deploy` command to deploy the engine directly to the Edge.

## Setup Requirements

### GitHub Repository Secrets
To fully utilize the CI/CD pipeline, the following secrets must be configured in your GitHub repository (`Settings > Secrets and variables > Actions`):

- **Cloudflare (Engine Deployment)**
  - `CF_API_TOKEN`: Cloudflare API token with worker deployment permissions.
  - `CF_ACCOUNT_ID`: Your Cloudflare Account ID.

- **Staging VPS (Admin Deployment)**
  - `STAGING_VPS_HOST`: IP or domain of the staging server.
  - `STAGING_VPS_USER`: SSH username (e.g., `deploy`).
  - `STAGING_SSH_KEY`: The private SSH key for the staging server.

- **Production VPS (Admin Deployment)**
  - `PROD_VPS_HOST`: IP or domain of the production server.
  - `PROD_VPS_USER`: SSH username.
  - `PROD_SSH_KEY`: The private SSH key for the production server.

### Environment Protection Rules
The production deployment workflow (`.github/workflows/deploy-production.yml`) utilizes a GitHub Environment named `production`.
- Navigate to **Settings > Environments** in the GitHub repository.
- Create an environment named `production`.
- Add **Required Reviewers** so that production deployments pause for manual approval.

### VPS Initial Setup
Ensure the target VPS has the correct file structure before the first deployment:
1. Ensure `/opt/url-redir-short` exists.
2. Clone the repository or copy `docker-compose.yml`, `docker-compose.prod.yml`, and `scripts/` to this directory.
3. Configure your production `.env` and `secrets/` directory as described in `CHANGE-006` and `CHANGE-008`.

## Deployment Scripts

There are two primary helper scripts located in the `scripts/` directory:

1. **`scripts/deploy-staging.sh`**
   - Pulls the `latest` image tags.
   - Runs `docker compose up -d`.
   - Checks the health endpoint.

2. **`scripts/deploy-production.sh <TAG>`**
   - Takes a specific tag (e.g., `v1.0.0`) as an argument.
   - Sets `ADMIN_IMAGE_TAG` locally.
   - Pulls the specific image version and updates the services.
   - Checks the health endpoint.

## Rollback Procedures

### Admin Service (VPS)
If a production deployment fails or causes an issue, you can roll back to a previous Docker image tag via SSH:
```bash
cd /opt/url-redir-short
bash scripts/deploy-production.sh v<PREVIOUS_VERSION>
```

### Redirect Engine (Cloudflare Workers)
To roll back the Cloudflare Worker, you can trigger a previous successful GitHub Action deployment, or use the Cloudflare Dashboard / Wrangler CLI to revert to a previous deployment.
```bash
wrangler rollback --env production
```
