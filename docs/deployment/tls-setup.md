# TLS Setup with Caddy

This guide covers setting up TLS (HTTPS) for the `url-redir-short` project using Caddy as a reverse proxy. Caddy provides automatic HTTPS with Let's Encrypt and zero-configuration TLS.

## Architecture

```text
Internet -> Caddy (TLS termination) -> Admin Service (Port 3001 in Docker network)
                                    -> Redirect Engine (Port 3002 in Docker network)
```

## Prerequisites

1.  A server with Docker and Docker Compose installed.
2.  A primary domain name (e.g., `short.example.com`) for public redirects.
3.  A subdomain (e.g., `admin.short.example.com`) for the admin dashboard.
4.  DNS A/AAAA records for both domains pointing to your server's public IP address.
5.  Ports 80 and 443 open on your server's firewall.

## Quick Start (Automatic TLS)

Caddy will automatically provision and renew TLS certificates from Let's Encrypt or ZeroSSL.

1.  Set the required environment variables. You can export these or add them to a `.env` file in the project root:

    ```bash
    export DOMAIN=short.example.com
    export ADMIN_DOMAIN=admin.short.example.com
    export TLS_EMAIL=your-email@example.com
    ```

2.  Start the services using the production Docker Compose overlay:

    ```bash
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    ```

Caddy will automatically fetch certificates, redirect HTTP to HTTPS, enable HTTP/2, and configure OCSP stapling.

## Custom Certificate Configuration

If you cannot use automatic TLS (e.g., internal network without internet access) or want to use your own certificates, you can configure Caddy to use manual certificates.

1.  Update the `infra/caddy/Caddyfile` to point to your certificate files:

    ```caddyfile
    {$ADMIN_DOMAIN} {
        tls /etc/caddy/certs/admin.crt /etc/caddy/certs/admin.key
        reverse_proxy admin:3001
    }

    {$DOMAIN} {
        tls /etc/caddy/certs/engine.crt /etc/caddy/certs/engine.key
        reverse_proxy engine:3002
    }
    ```

2.  Update `docker-compose.prod.yml` to mount your certificates into the Caddy container:

    ```yaml
    services:
      caddy:
        ...
        volumes:
          - ./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
          - caddy_data:/data
          - caddy_config:/config
          - /path/to/your/certs:/etc/caddy/certs:ro # Add this line
    ```

## Troubleshooting Common TLS Issues

*   **Certificates failing to provision:**
    *   Ensure DNS records have propagated and point to the correct IP.
    *   Ensure ports 80 and 443 are publicly accessible.
    *   Check Caddy logs for Let's Encrypt rate limits or validation errors: `docker compose logs caddy`.
*   **502 Bad Gateway:**
    *   This means Caddy cannot reach the upstream backend.
    *   Ensure the `admin` and `engine` containers are running: `docker compose ps`.
    *   Check backend logs for errors: `docker compose logs admin` or `docker compose logs engine`.
*   **Connection Refused:**
    *   Ensure Caddy is running and bound to ports 80 and 443.

## Certificate Renewal Verification

Caddy automatically handles certificate renewals in the background. You don't need to configure cron jobs or manual scripts.

To verify renewals are working or check certificate status:

1.  Check the Caddy logs:
    ```bash
    docker compose logs caddy | grep "certificate"
    ```
2.  Use a browser or `curl` to inspect the certificate details:
    ```bash
    curl -vI https://short.example.com
    ```
