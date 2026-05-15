## ADDED Requirements

### Requirement: Per-Platform Deployment Templates
The system SHALL provide a `deployments/` directory at the repository root containing one subdirectory per supported target platform. Each subdirectory MUST contain: (1) the platform-specific deployment configuration file(s), and (2) a `README.md` with a "last verified" date and the minimum steps to go from clone to live deployment.

#### Scenario: Client deploys to Fly.io
- **WHEN** a client navigates to `deployments/fly/`
- **THEN** they SHALL find a `fly.toml`, a `Dockerfile.fly`, and a `README.md` that instructs them to set exactly the required environment variables and run `fly deploy`

#### Scenario: Client deploys to Deno Deploy
- **WHEN** a client navigates to `deployments/deno/`
- **THEN** they SHALL find a `deno.json` and a `README.md` documenting the cold-start trade-off and the GitHub integration steps

#### Scenario: Client deploys via Supabase Edge Functions
- **WHEN** a client navigates to `deployments/supabase-edge/`
- **THEN** they SHALL find a `config.toml` and a `README.md` explaining the latency trade-off of DB-per-request vs in-memory and how to configure the Supabase client environment variables

#### Scenario: Client sees AWS Lambda as a future option
- **WHEN** a client navigates to `deployments/aws-lambda/`
- **THEN** they SHALL find a `README.md` clearly marked as "Planned — Adapter not yet implemented" with an explanation of what is required and how to track progress

### Requirement: Template Freshness Metadata
Each template `README.md` SHALL include a "Last verified" date so consumers can judge whether the template may be stale against current platform API/config versions.

#### Scenario: Platform updates their config format
- **WHEN** a template's config format becomes outdated
- **THEN** the "Last verified" date SHALL make it visible that the template needs re-validation, without requiring code changes to signal this
