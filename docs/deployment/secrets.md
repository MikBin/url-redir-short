# Production Secrets Management

This project manages production secrets using Docker/Podman file-based secrets (`/run/secrets/`). We support both Docker Compose and Podman Compose reliably through this primary mechanism.

## Secret Inventory

| Secret | Service | Purpose |
|--------|---------|---------|
| `POSTGRES_PASSWORD` | DB | Database authentication |
| `SUPABASE_KEY` | Admin | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | Admin | Supabase service role key |
| `SYNC_API_KEY` | Admin, Engine | SSE sync authentication |
| `IP_HASH_SALT` | Admin | IP anonymization salt |
| `SUPABASE_JWT_SECRET` | Admin | JWT token signing |

## Development Setup

For local development or testing without a cloud provider, you can use the file-based secrets infrastructure locally:

1. Copy the example `.env.example` to `.env` if you haven't.
2. We provide a convenient helper script to setup the secrets directory and files interactively or via env vars.
   Run:
   ```bash
   ./scripts/setup-secrets.sh
   ```
   This will create a `.txt` file for each required secret in the `secrets/` directory.

The `secrets/*.txt` files are `.gitignore`'d so they will never be accidentally committed.

## Production Setup (Docker/Podman Secrets)

### Using Docker/Podman Compose (Local Files)
If you are deploying using Compose directly on a server, you can manually create the `secrets/` folder (or use `scripts/setup-secrets.sh`) containing your plain-text secrets and run:
```bash
docker compose up -d
```
The compose file maps these files using the `secrets:` configuration and mounts them automatically to `/run/secrets/`. An entrypoint script (`scripts/docker-entrypoint.sh`) runs on startup for the services, reads these files, and sets the respective environment variables before starting the node process.

### Using Docker/Podman Secrets (External)
If you are running in Swarm or prefer to use predefined secrets, create them via the CLI:
```bash
echo -n "prod-password" | podman secret create POSTGRES_PASSWORD -
echo -n "prod-key" | podman secret create SUPABASE_KEY -
# ... repeat for all 6 secrets
```
Then, update your `docker-compose.yml` to specify `external: true` for the secrets rather than `file: ./secrets/...`.

## Rotation Procedures

To rotate a secret:
1. Update the underlying secret source (e.g., in your Cloud Provider's Secret Manager, or edit the file in `./secrets/`).
2. Restart the affected services so the entrypoint script picks up the new value from `/run/secrets/`.
   ```bash
   docker compose restart <service-name>
   ```
3. If using external secrets (`podman secret create`), you will need to update the compose file to reference the new secret version or remove the container, replace the secret, and recreate the container.
