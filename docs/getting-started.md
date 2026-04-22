# Getting Started

Welcome to the url-redir-short project! This guide will help you set up the project locally for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) (for running services via containers)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, but recommended for local database management)
- `git`

## Clone and Setup

First, clone the repository to your local machine:

```bash
git clone https://github.com/MikBin/url-redir-short.git
cd url-redir-short
```

## Environment Configuration

The project uses environment variables for configuration. Create a `.env` file by copying the provided example:

```bash
cp .env.example .env
```

Review the `.env` file and adjust the values if necessary, particularly the JWT secrets and database credentials if you plan to run a custom setup. For standard local development using Docker Compose, the default values in `.env.example` are usually sufficient.

## Running Locally

The easiest and recommended way to run the entire stack locally is using Docker Compose. This will start the Admin Service, Redirect Engine, Database (PostgreSQL/Supabase), and any necessary routing components (like Caddy).

```bash
# Start all services in the background
docker compose up -d

# View logs for all services
docker compose logs -f

# To stop the services
docker compose down
```

### Accessing the Services

Once the containers are up and running, you can access:
- **Admin Service UI:** http://localhost:3001 (or the port defined in your docker-compose setup)
- **Redirect Engine:** http://localhost:3002

## Development Workflow

If you want to actively develop the code without rebuilding containers for every change, you can run the individual services locally using Node.js.

### 1. Install Dependencies

You'll need to install dependencies for both the Admin Service and the Redirect Engine.

```bash
# Install root dependencies
npm install

# Install Admin Service dependencies
cd admin-service/supabase
npm install
cd ../..

# Install Redirect Engine dependencies
cd redir-engine
npm install
cd ..
```

### 2. Start the Database

Even when running the services locally via Node, it's best to keep the database running in Docker:

```bash
# Start only the database and related Supabase services
docker compose up -d supabase-db
```

### 3. Run the Services in Dev Mode

Open two separate terminal windows or tabs:

**Terminal 1: Admin Service**
```bash
cd admin-service/supabase
npm run dev
```

**Terminal 2: Redirect Engine**
```bash
cd redir-engine
npm run dev
```

## Running Tests

The project has comprehensive test suites.

### Unit Tests
```bash
# Admin Service tests
cd admin-service/supabase
npm run test

# Redirect Engine tests (from root)
cd redir-engine
npm run test
```

### E2E Tests
The end-to-end suite requires both services to be running or mockable.

```bash
cd redir-engine/e2e-suite
npm install
npm test
```

For more detailed information on testing, refer to the [Testing Guide](development/testing.md).
