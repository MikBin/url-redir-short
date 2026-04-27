# Operational Runbook

This runbook outlines standard operating procedures for monitoring, maintaining, and troubleshooting the `url-redir-short` system in a production environment.

## 1. Service Health Checks

To determine if the system is operating normally, verify the health endpoints of the services.

- **Admin Service:** `GET https://admin.yourdomain.com/api/health`
  Expect a 200 OK with a JSON response confirming database connectivity.
- **Redirect Engine:** `GET https://yourdomain.com/_health`
  Expect a 200 OK.
- **SSE Stream:** The engine logs should show successful connections to the `/api/sync/stream` endpoint without continuous reconnections.

## 2. Managing Docker Services

The stack is managed via Docker Compose.

### Restarting Services

If a specific service is misbehaving, you can restart it individually to avoid full system downtime.

```bash
# Restart the redirect engine (safest, no state lost as it pulls from DB/Admin on boot)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart engine

# Restart the admin service
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart admin

# Restart the reverse proxy (Caddy)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart caddy
```

### Full System Restart

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 3. Viewing Logs

Monitoring logs is crucial for diagnosing issues.

```bash
# Tail logs for all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100

# View specific service logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f engine
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f admin
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f supabase-db
```

**What to look for:**
- **Engine:** Look for `SSE connection established` to ensure sync is working. Look for memory eviction warnings if `CACHE_MAX_HEAP_MB` is being hit frequently.
- **Admin:** Look for Supabase connection errors or unhandled exceptions in the Nuxt server layer.

## 4. Scaling Considerations

### Redirect Engine Memory Pressure

The engine caches routing rules in memory. If you have millions of links, monitor the memory usage.
- If the engine logs frequent cache evictions, consider increasing `CACHE_MAX_HEAP_MB` in your `.env` or `docker-compose.prod.yml`.
- Example: `CACHE_MAX_HEAP_MB=512` (allows up to 512MB for the LRU cache).

### Horizontal Scaling

The current out-of-the-box setup is designed for a single VPS. To scale horizontally across multiple nodes:
1. **Engine:** The Redirect Engine is completely stateless and pulls its state via SSE. You can deploy N instances behind a load balancer without configuration changes.
2. **Admin:** The Admin Service can also be scaled, provided all instances connect to the same centralized PostgreSQL database.
3. **Database:** Ensure the externalized database can handle the combined connection pool.

## 5. Troubleshooting Guide

### Issue: New links created in Admin are not redirecting

**Diagnosis:** The SSE sync stream might be broken.
**Steps:**
1. Check the Engine logs: `docker compose logs --tail=50 engine`. Look for SSE disconnection or parsing errors.
2. Ensure the `SYNC_API_KEY` matches exactly between the Admin Service and the Engine.
3. Check if the Admin Service is successfully emitting events by creating a link and watching the Admin logs.
4. Restart the engine: `docker compose restart engine`.

### Issue: Caddy is failing to issue SSL certificates

**Diagnosis:** Let's Encrypt rate limits or DNS misconfiguration.
**Steps:**
1. Check Caddy logs: `docker compose logs caddy`.
2. Ensure your domain A records point to the server's correct public IP.
3. Ensure ports 80 and 443 are open on the server's firewall (e.g., `ufw status`).

### Issue: Admin UI shows "Unable to connect to database"

**Diagnosis:** PostgreSQL connection failure or Supabase realtime is down.
**Steps:**
1. Check DB logs: `docker compose logs supabase-db`.
2. Ensure database credentials in `secrets/db_password.txt` match the `.env` settings.
3. If running out of disk space, PostgreSQL will halt. Check disk usage with `df -h`.

## 6. Backup & Disaster Recovery

Automated backups are performed daily with tiered retention.

- **SOP:** Refer to the [Backup & Disaster Recovery Guide](file:///c:/Users/miche/Documents/projects/url-redir-short/docs/operations/backup-dr.md).
- **Manual Backup:** Run `bash ./scripts/backup.sh`.
- **Manual Restore:** Run `bash ./scripts/restore.sh <backup_file_path>`.
- **Retention:** 30 daily, 4 weekly, and 3 monthly backups are kept.

## 7. Monitoring & Observability

The system uses Prometheus, Loki, and Grafana for monitoring.

- **Setup Guide:** Refer to the [Observability Stack Guide](file:///c:/Users/miche/Documents/projects/url-redir-short/docs/operations/observability.md).
- **Grafana Dashboard:** [http://localhost:3004](http://localhost:3004) (admin/admin)
- **Key Metrics:** Monitor `engine_requests_total` and `engine_sse_connection_status` for core redirect health.
