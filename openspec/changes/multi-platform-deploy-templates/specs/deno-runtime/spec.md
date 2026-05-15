## ADDED Requirements

### Requirement: Deno Entry Point for the Redirect Engine
The system SHALL provide a `redir-engine/runtimes/deno/index.ts` entry point compatible with Deno Deploy. It MUST use `InMemoryStore` with `SSESyncAdapter`. The entry point MUST use `Deno.serve()` as the HTTP listener.

#### Scenario: Engine starts on Deno Deploy
- **WHEN** the Deno entry point is deployed to Deno Deploy
- **THEN** it SHALL connect to the Admin SSE stream on cold start, populate the Radix Tree, and serve redirect requests via `Deno.serve()`

#### Scenario: Cold-start latency is documented
- **WHEN** a developer reads `deployments/deno/README.md`
- **THEN** they SHALL find an explicit note explaining that each new isolate re-fetches all redirect rules from the Admin SSE stream on first request, and that for large rule sets this adds latency to the first redirect after a cold start

### Requirement: Deno Configuration File
The `deployments/deno/` directory SHALL contain a `deno.json` with import map configuration compatible with the engine's TypeScript source, and a README with Deno Deploy GitHub integration steps.

#### Scenario: Deno Deploy links to GitHub repo
- **WHEN** a developer follows the `deployments/deno/README.md` steps
- **THEN** they SHALL be able to connect their GitHub repo to Deno Deploy and trigger automatic deployments of the Deno runtime on push to `main`
