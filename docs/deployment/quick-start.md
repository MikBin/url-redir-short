# Quick Start Deployment Guide

This guide outlines the process of deploying the `url-redir-short` platform from scratch onto a single VPS (Virtual Private Server) using Docker Compose and Caddy.

This is a high-level guide. It relies on the configurations defined in `docker-compose.yml` and `docker-compose.prod.yml`.

## Prerequisites

- A fresh Linux VPS (Ubuntu 22.04/24.04 recommended).
- A domain name pointing to your VPS's public IP address (e.g., `admin.yourdomain.com` for the admin panel, and `yourdomain.com` for the redirect engine).
- Basic familiarity with SSH and Linux command line.

## Step 1: Server Preparation

1. **SSH into your server:**
   ```bash
   ssh root@your_server_ip
   ```

2. **Update the system:**
   ```bash
   apt update && apt upgrade -y
   ```

3. **Install Docker and Git:**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Install Git
   apt install git -y
   ```

## Step 2: Clone the Repository

Clone the project repository to your desired location, usually `/opt` or `/var/www`.

```bash
cd /opt
git clone https://github.com/MikBin/url-redir-short.git
cd url-redir-short
```

## Step 3: Secrets Configuration

For production security, the system uses Docker Secrets rather than plain environment variables.

1. Review the [Secrets Management Documentation](secrets.md) to understand the setup.
2. Ensure you create the necessary secret files in the `secrets/` directory (e.g., `db_password.txt`, `jwt_secret.txt`, `sync_api_key.txt`).
3. You can generate strong secrets using OpenSSL:
   ```bash
   mkdir -p secrets
   openssl rand -hex 32 > secrets/jwt_secret.txt
   openssl rand -hex 16 > secrets/db_password.txt
   openssl rand -hex 32 > secrets/sync_api_key.txt
   ```

## Step 4: Environment Variables

Create your production `.env` file from the example.

```bash
cp .env.example .env
```

Edit the `.env` file:
- Set `NODE_ENV=production`.
- Update `NUXT_PUBLIC_SITE_URL` to your admin domain (e.g., `https://admin.yourdomain.com`).
- Update `ENGINE_BASE_URL` to your engine domain (e.g., `https://yourdomain.com`).

*(Note: Sensitive keys are handled by secrets, so you can leave those blank or default in the `.env` file if you are strictly using the secret files as per the `docker-compose.prod.yml` overrides.)*

## Step 5: TLS and Domain Setup

The project uses Caddy as an auto-HTTPS reverse proxy.

1. Ensure your DNS A/AAAA records for your domains point to the server.
2. Edit the `infra/caddy/Caddyfile` to replace the placeholder domains with your actual domains.
3. For detailed Caddy configuration, refer to the [TLS/HTTPS Setup Documentation](tls-setup.md).

## Step 6: Deploy

Use the provided production deployment script to spin up the services. This script utilizes both the base `docker-compose.yml` and the production overrides in `docker-compose.prod.yml`.

```bash
./scripts/deploy-production.sh
```

Alternatively, if you prefer to run it manually:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Step 7: Verify Health

Wait a minute for the databases to initialize and the Nuxt server to boot, then verify the services:

```bash
docker compose logs -f caddy
docker compose logs -f admin
docker compose logs -f engine
```

Navigate to your domains in a web browser to confirm they are accessible and secured with HTTPS.

## Further Reading

- For continuous integration and automated deployments, see the [CI/CD Pipeline Documentation](cd-pipeline.md).
- To understand how to update the database schema, refer to the [Database Migrations Guide](../development/migrations.md).
