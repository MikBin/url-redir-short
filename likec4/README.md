# LikeC4 Architecture Model

This directory contains the LikeC4 architecture-as-code model for the Universal Redirector System.

## What is LikeC4?

LikeC4 is a tool for modeling software architecture using a declarative DSL (Domain Specific Language). It allows you to:

- Document your architecture as code
- Generate interactive diagrams from code
- Keep architecture documentation in sync with implementation
- Share architecture with teams through web-based visualization

## Overview

This model captures the Universal Redirector System architecture at multiple levels:

- **System Context**: External users and their interactions with the system
- **Containers**: Major components (Admin Service, Redirector Engine, Analytics Service, Database)
- **Components**: Internal structure of each container with detailed interactions
- **Deployment**: Different runtime environments (Cloudflare Workers, AWS Lambda@Edge, VPS)

## Key Architectural Patterns Documented

### Hexagonal Architecture (Ports & Adapters)
The Admin Service follows hexagonal architecture principles:
- **Domain Layer**: Pure business logic (LinkEntity, UserEntity, LinkManagementService)
- **Ports**: Interfaces defining contracts (RepositoryPort, AuthProviderPort, SyncEmitterPort)
- **Adapters**: Implementations of ports (SupabaseAdapter, SseSyncAdapter, REST Controllers)

### Edge-Optimized Architecture
The Redirector Engine is designed for low latency:
- **Cuckoo Filter**: Fast 404 gatekeeper to instantly reject unknown paths
- **Radix Tree**: Efficient routing cache
- **Async Analytics**: Fire-and-forget pattern to prevent blocking redirects

### Data Flow Patterns
- **Sync Protocol**: One-way SSE stream from Admin Service to Edge Nodes
- **Analytics**: Async fire-and-forget POST to Analytics Service
- **Referrer Tracking**: Hybrid Priority Strategy (query params > Referer header)

## Usage

### Installation

```bash
npm install -g @likec4/cli
```

### View the Architecture

```bash
# Start the local dev server
likec4 start

# Open http://localhost:6422 in your browser
```

### Export Diagrams

```bash
# Export all views as PNG
likec4 export

# Export specific view
likec4 export view:Universal Redirector System --format=png
```

### Static Site Generation

```bash
# Build static site for deployment
likec4 build
```

## Architecture Views

### System Level
Shows high-level interactions between:
- Admin Users → Admin Dashboard
- Admin Dashboard → Admin Service, Analytics Service
- Admin Service → Database, Redirector Engine
- End Users → Redirector Engine
- Redirector Engine → Analytics Service

### Component Level - Admin Service
Detailed view showing:
- REST Controllers handling HTTP requests
- Link Management Service (domain logic)
- Multiple adapters for Supabase/PocketBase
- SSE Sync Adapter broadcasting to edge nodes
- Auth Guard validating tokens

### Component Level - Redirector Engine
Detailed view showing:
- HTTP Server handling incoming requests
- Cuckoo Filter for fast 404 detection
- Radix Tree for route lookup
- Advanced routing features:
  - A/B Testing Router
  - Geo Router
  - Language Router
  - Device Router
  - Password Gate
  - HSTS Enforcer
- Analytics Collector with fire-and-forget pattern
- SSE Client receiving updates from Admin Service

### Deployment Level
Shows different deployment options:
- Cloudflare Workers (recommended for edge)
- AWS Lambda@Edge
- VPS / Docker

## Technical Decisions

1. **Hexagonal Architecture**: Enables database-agnostic design (Supabase vs PocketBase)
2. **One-Way SSE Sync**: Ensures low-latency edge updates without complex consensus
3. **Cuckoo Filter**: Provides O(1) 404 detection, crucial for handling traffic spikes
4. **Fire-and-Forget Analytics**: Never blocks user redirect for analytics logging
5. **Edge Platform Headers**: Uses platform-provided headers (cf-ipcountry) instead of external lookups

## Maintaining the Model

When making changes to the system:

1. Update the corresponding elements in `architecture.c4`
2. Keep the relationships (arrows) in sync with actual integrations
3. Update descriptions if component responsibilities change
4. Run `likec4 start` to verify changes visually
5. Commit the updated model alongside code changes

## Further Reading

- [Project Functional Requirements](../functional-requirements.md)
- [Admin Service Architecture](../admin-service/nest/architecture.md)
- [Redirector Engine Architecture](../redir-engine/unified_architecture.md)
- [LikeC4 Documentation](https://likec4.dev/)