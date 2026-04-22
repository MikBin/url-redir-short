# Implementation Tasks: TLS/HTTPS Reverse Proxy

## Task 1: Caddyfile Configuration
**File:** `infra/caddy/Caddyfile`
- [x] Define reverse proxy for Admin Service (admin subdomain)
- [x] Define reverse proxy for Redirect Engine (main domain)
- [x] Configure automatic HTTPS with Let's Encrypt
- [x] Enable HTTP/2 and OCSP stapling
- [x] Add health check endpoints for upstream backends
- [x] Test with `caddy validate` and `caddy adapt`

## Task 2: Docker Compose Production Overlay
**File:** `docker-compose.prod.yml`
- [x] Add Caddy service with official image
- [x] Mount Caddyfile and certificate volume
- [x] Remove direct port exposure from admin/engine services
- [x] Add environment variable substitution for DOMAIN, ADMIN_DOMAIN, TLS_EMAIL
- [x] Integration test: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`

## Task 3: Deployment Documentation
**File:** `docs/deployment/tls-setup.md`
- [x] Prerequisites (domain, DNS, server)
- [x] Quick start with automatic TLS
- [x] Custom certificate configuration
- [x] Troubleshooting common TLS issues
- [x] Certificate renewal verification
