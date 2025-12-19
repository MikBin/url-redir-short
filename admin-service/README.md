# Admin Service - Redirector System

## Overview
This is the central control plane for the Redirector System. It manages the lifecycle of URL redirection rules and synchronizes the state with distributed Redirector Engines (Edge Nodes).

## Architecture
- **Single Instance:** Designed to run as a single long-running service.
- **Database Agnostic:** Can be configured to use PostgreSQL or PocketBase.
- **Real-time Sync:** Uses Server-Sent Events (SSE) to push updates to connected Engines.

## Directory Structure
- `src/api`: REST API endpoints (Admin management & Sync).
- `src/db`: Database adapters (Abstract, Postgres, PocketBase).
- `src/sync_manager.ts`: Logic for broadcasting updates to connected clients.
- `src/server.ts`: Application entry point.

## Getting Started (Draft)
*This is a draft architectural skeleton.*
