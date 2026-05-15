## ADDED Requirements

### Requirement: Bun Entry Point for the Redirect Engine
The system SHALL provide a `redir-engine/runtimes/bun/index.ts` entry point that runs the redirect engine on Bun's native HTTP server. It MUST use `InMemoryStore` with `SSESyncAdapter`, mirroring the Node.js runtime. No new adapters are required.

#### Scenario: Engine starts on Bun
- **WHEN** the Bun entry point is executed with `bun run runtimes/bun/index.ts`
- **THEN** the engine SHALL start, connect to the Admin SSE stream, populate the in-memory Radix Tree, and serve redirect requests

#### Scenario: Bun runtime handles redirects identically to Node.js
- **WHEN** a redirect request is received by the Bun runtime
- **THEN** the response SHALL be identical to that of the Node.js runtime for the same redirect rule — same status code, same `Location` header, same analytics event

### Requirement: Bun Runtime Package Configuration
The `redir-engine/runtimes/bun/` directory SHALL contain a `package.json` (or leverage the parent) with a `bun:start` script, and a corresponding `Dockerfile.fly` in `deployments/fly/` that uses the `oven/bun` base image.

#### Scenario: Fly.io deployment uses Bun
- **WHEN** the `deployments/fly/Dockerfile.fly` is built
- **THEN** it SHALL use the `oven/bun` base image, install dependencies with `bun install`, and run the engine with `bun run runtimes/bun/index.ts`
