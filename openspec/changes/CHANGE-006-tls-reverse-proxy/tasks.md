# Implementation Tasks: TLS/HTTPS Reverse Proxy

## Task 1: Caddyfile Configuration
**File:** `infra/caddy/Caddyfile`
- [ ] Define reverse proxy for Admin Service (admin subdomain)
- [ ] Define reverse proxy for Redirect Engine (main domain)
- [ ] Configure automatic HTTPS with Let's Encrypt
- [ ] Enable HTTP/2 and OCSP stapling
- [ ] Add health check endpoints for upstream backends
- [ ] Test with `caddy validate` and `caddy adapt`

## Task 2: Docker Compose Production Overlay
**File:** `docker-compose.prod.yml`
- [ ] Add Caddy service with official image
- [ ] Mount Caddyfile and certificate volume
- [ ] Remove direct port exposure from admin/engine services
- [ ] Add environment variable substitution for DOMAIN, ADMIN_DOMAIN, TLS_EMAIL
- [ ] Integration test: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`

## Task 3: Deployment Documentation
**File:** `docs/deployment/tls-setup.md`
- [ ] Prerequisites (domain, DNS, server)
- [ ] Quick start with automatic TLS
- [ ] Custom certificate configuration
- [ ] Troubleshooting common TLS issues
- [ ] Certificate renewal verification
