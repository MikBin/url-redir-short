# url-redir-short

![CI Status](https://github.com/MikBin/url-redir-short/actions/workflows/deploy-staging.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A high-performance, distributed URL redirection platform.

## Overview

The system consists of two main components:
- **Admin Service**: A modern control plane built with Nuxt 4, Vue 3, and Supabase for link management, analytics visualization, and configuration.
- **Redirect Engine**: A blazing-fast edge-optimized redirection engine built with Hono and TypeScript, capable of running on Node.js or Cloudflare Workers.

## Quick Start

The easiest way to run the project locally is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/MikBin/url-redir-short.git
cd url-redir-short

# Copy the environment template
cp .env.example .env

# Start the services
docker compose up -d
```

For a comprehensive guide, see the [Getting Started Guide](docs/getting-started.md).

## Architecture Overview

The platform uses a Clean Architecture for the Redirect Engine and a modern Server-Side Rendered framework for the Admin Service. The state between the Admin Service and the Redirect Engine is synchronized in real-time via Server-Sent Events (SSE).

For more details, see the [Architecture Documentation](docs/architecture.md).

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- **Deployment**
  - [Quick Start Deployment](docs/deployment/quick-start.md)
  - [TLS/HTTPS Setup](docs/deployment/tls-setup.md)
  - [Secrets Management](docs/deployment/secrets.md)
  - [CI/CD Pipeline](docs/deployment/cd-pipeline.md)
- **Operations**
  - [Operational Runbook](docs/operations/runbook.md)
- **Development**
  - [Testing Guide](docs/development/testing.md)
  - [Database Migrations](docs/development/migrations.md)
  - [Contributing Guidelines](docs/development/contributing.md)
- **API**
  - [Admin API](docs/api/admin-api.md)

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](docs/development/contributing.md) for details on our code of conduct, development workflow, and pull request process.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
