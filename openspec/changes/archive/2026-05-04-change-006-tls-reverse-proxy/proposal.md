# Change Proposal: TLS/HTTPS Reverse Proxy Configuration

## Problem
The system has no reverse proxy or TLS termination configuration. All traffic is served over plain HTTP, which is unacceptable for production. HSTS headers are configured per-link but meaningless without HTTPS.

## Opportunity
Adding a production-ready reverse proxy (Caddy or nginx) with automatic TLS certificate management enables secure production deployments and enforces HTTPS for all endpoints.

## Success Metrics
- All production traffic served over HTTPS
- Automatic TLS certificate provisioning (Let's Encrypt)
- HTTP → HTTPS redirect enforced
- Reverse proxy configuration for both Admin Service and Redirect Engine
- Zero downtime certificate renewal

## Scope
- Caddy/nginx reverse proxy configuration files
- Docker Compose production overlay with TLS
- Environment-based configuration (dev=HTTP, prod=HTTPS)
- Documentation for custom domain setup
