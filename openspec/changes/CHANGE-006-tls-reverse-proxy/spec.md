# Specification: TLS/HTTPS Reverse Proxy

## Architecture
```
Internet → Caddy (TLS termination) → Admin Service (port 3000)
                                    → Redirect Engine (port 3000)
```

## Requirements

### Reverse Proxy Selection
- **Caddy** as primary choice (automatic HTTPS, zero-config TLS)
- Alternative nginx configuration provided for advanced users

### TLS Configuration
- Automatic certificate provisioning via Let's Encrypt (ACME)
- TLS 1.2+ minimum
- OCSP stapling enabled
- HTTP/2 enabled by default
- Automatic HTTP → HTTPS redirect

### Routing Rules
| Path | Backend | Notes |
|------|---------|-------|
| `/admin/*` or admin subdomain | Admin Service (port 3001) | Dashboard, API, SSE |
| `/*` (everything else) | Redirect Engine (port 3002) | Public redirect traffic |

### Docker Compose Production Overlay
- `docker-compose.prod.yml` extending base `docker-compose.yml`
- Adds Caddy service with TLS
- Volume for certificate persistence
- Environment variables for domain configuration

### Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Primary domain for redirects | `short.example.com` |
| `ADMIN_DOMAIN` | Admin dashboard domain | `admin.short.example.com` |
| `TLS_EMAIL` | Let's Encrypt contact email | `admin@example.com` |
| `TLS_MODE` | `auto` (Let's Encrypt) or `manual` (custom certs) | `auto` |
