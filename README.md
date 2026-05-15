# url-redir-short

![CI Status](https://github.com/MikBin/url-redir-short/actions/workflows/deploy-staging.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Coverage Goal](https://img.shields.io/badge/coverage-95%25-brightgreen)

A high-performance, distributed URL redirection platform designed for low latency and high scalability.

## 🚀 Overview

The system consists of a blazing-fast edge-optimized redirection engine and a modern control plane with multiple backend options.

- **Redirect Engine**: Built with **Hono + TypeScript**. Uses advanced data structures for extreme performance:
  - **Radix Tree** for O(k) routing complexity.
  - **Cuckoo Filter** for fast negative lookups (rejecting 404s before hitting the store).
  - Multi-runtime support: **Node.js** and **Cloudflare Workers**.
- **Admin Service**: A Nuxt 4 + Vue 3 control plane.
  - **Dual Backend Support**: Choose between **Supabase** (PostgreSQL/Redis) or **PocketBase** (SQLite/Go).
  - **Real-time Sync**: State synchronization between Admin and Engine via **Server-Sent Events (SSE)**.

## 🏗️ Architecture Highlights

- **Clean Architecture**: Decoupled domain logic, use-cases, and adapters.
- **Strict TypeScript**: 100% type safety with `any` strictly forbidden.
- **SSE Protocol**: Automated data transformation from DB (snake_case) to Engine (camelCase).
- **Edge Native**: Optimized for distributed deployments with global caching.

## ⚡ Quick Start

### Option A: Standard (Supabase + Engine)
```bash
# Start Supabase locally
npm run dev:supabase

# Run Admin (Supabase) and Engine in parallel
npm run dev:all
```

### Option B: Lightweight (PocketBase + Engine)
```bash
# Start PocketBase, Admin (PB), and Engine in parallel
npm run dev:pb:all
```

For more detailed setup instructions, including environment variables and Docker configuration, see the [Getting Started Guide](docs/getting-started.md).

## 🧪 Testing & Quality

We maintain a rigorous quality standard with a goal of **>95% test coverage** across all subsystems.

- **Unit Tests**: Pure logic and domain models (Vitest).
- **Integration Tests**: API handlers and service adapters with full mocking of external clients (Redis, Supabase).
- **System E2E**: End-to-end user journeys using Playwright.
- **Performance**: Automated benchmarks and load testing suites.

Run all tests:
```bash
npm test
```

## 📚 Documentation

Detailed guides are available in the `docs/` directory:

- [Architecture Deep Dive](docs/architecture.md)
- [Deployment Runbook](docs/deployment/quick-start.md)
- [Security & Secrets](docs/deployment/secrets.md)
- [Testing Standards](docs/development/testing.md)
- [CI/CD Pipeline](docs/deployment/cd-pipeline.md)

## 🤝 Contributing

We welcome contributions! Please refer to [AGENTS.md](AGENTS.md) for internal architecture notes and [Contributing Guidelines](docs/development/contributing.md) for the workflow.

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
