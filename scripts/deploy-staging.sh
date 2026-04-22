#!/bin/bash
set -e

# Staging Deployment Script for Admin Service
# This script is meant to be run on the staging VPS.

echo "Starting deployment to Staging..."

# 1. Pull the latest images
echo "Pulling latest Docker images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull admin
# (Other services like DB/Redis will be pulled if they don't exist or are updated)

# 2. Restart the services
echo "Applying changes..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Basic Health Check
echo "Waiting for services to become healthy..."
sleep 10
if curl -s http://localhost:3001/api/health | grep -q '"status":"ok"'; then
  echo "Deployment to Staging successful!"
else
  echo "Warning: Health check failed or endpoint not ready yet. Please investigate."
  # In a strict environment, we could exit 1 here, but we will print a warning.
fi
