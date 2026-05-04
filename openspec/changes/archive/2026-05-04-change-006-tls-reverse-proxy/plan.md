# Implementation Plan: TLS/HTTPS Reverse Proxy

## Phase 1: Caddy Configuration
- [ ] Create `infra/caddy/Caddyfile` with reverse proxy rules
- [ ] Configure automatic HTTPS with Let's Encrypt
- [ ] Set up routing: admin subdomain → Admin Service, default → Engine
- [ ] Add security headers (already in Caddy defaults)

## Phase 2: Docker Compose Production Overlay
- [ ] Create `docker-compose.prod.yml` with Caddy service
- [ ] Add certificate volume for persistence across restarts
- [ ] Add environment variable substitution for domains
- [ ] Test with local self-signed certificates

## Phase 3: Documentation
- [ ] Create `docs/deployment/tls-setup.md` with step-by-step guide
- [ ] Document custom domain configuration
- [ ] Document manual certificate mode for enterprise deployments
- [ ] Update README with production deployment instructions
