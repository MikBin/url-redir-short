## ADDED Requirements

### Requirement: IRedirectStore and ISyncManager as the Runtime Extension Contract
The system SHALL document the two port interfaces (`IRedirectStore` and `ISyncManager`) as the formal contract for adding new runtime targets. A `PORTING.md` file MUST exist at `redir-engine/runtimes/PORTING.md` explaining the Store/Sync pairing model and providing a minimal entry-point template.

#### Scenario: Developer reads the porting guide
- **WHEN** a developer opens `redir-engine/runtimes/PORTING.md`
- **THEN** they SHALL find: (1) an explanation of `IRedirectStore` and `ISyncManager`, (2) a Store/Sync pairing matrix showing which combination suits which platform type, and (3) a minimal annotated entry-point template they can copy

#### Scenario: New runtime satisfies the interfaces
- **WHEN** a new runtime entry point is added under `redir-engine/runtimes/<name>/`
- **THEN** it SHALL instantiate exactly one `IRedirectStore` implementation and one `ISyncManager` implementation, and wire them to `createApp()` — no other core files SHALL be modified

### Requirement: Runtime Compatibility Matrix in README
The root `README.md` SHALL include a runtime compatibility matrix listing all supported and planned platforms with their current support status, storage adapter used, and a brief note.

#### Scenario: Developer evaluates the project
- **WHEN** a developer reads the root `README.md`
- **THEN** they SHALL see a table with at minimum: Platform, Status (Production / Planned / Exploring), Storage, and Notes columns, covering Node.js, Cloudflare Workers, Fly.io/Bun, Deno Deploy, Supabase Edge, and AWS Lambda@Edge
