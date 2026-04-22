#!/bin/bash
set -e

# Production Deployment Script for Admin Service
# This script is meant to be run on the production VPS.

TAG=$1

if [ -z "$TAG" ]; then
  echo "Error: You must provide a Docker image tag (e.g., v1.0.0) as the first argument."
  exit 1
fi

echo "Starting deployment to Production for tag: $TAG"

# Set the ADMIN_IMAGE_TAG environment variable so docker compose uses it
export ADMIN_IMAGE_TAG=$TAG

# 1. Pull the specific tagged image
echo "Pulling Docker image for admin-service:$TAG..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull admin

# 2. Restart the services
echo "Applying changes..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Basic Health Check
echo "Waiting for services to become healthy..."
sleep 10
if curl -s http://localhost:3001/api/health | grep -q '"status":"ok"'; then
  echo "Deployment to Production successful!"
else
  echo "Warning: Health check failed or endpoint not ready yet. Please investigate."
fi
