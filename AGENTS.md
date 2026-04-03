# AGENTS.md

## Build & Test Commands
- **Admin Service (Nuxt)**: `cd admin-service/supabase && npm run dev` / `npm run build` / `npm run test`
- **Redir Engine**: `cd redir-engine && npm run dev` / `npm run build`
- **E2E Tests**: `cd redir-engine/e2e-suite && npm test` (single test: `npm test -- specs/T01-basic.test.ts`)

## Architecture
- **redir-engine/**: High-performance redirect engine (Hono + TypeScript). Clean Architecture: `src/core/` (domain), `src/use-cases/`, `src/adapters/` (SSE, HTTP). Uses Cuckoo Filter for 404 rejection, Radix Tree for routing. Runtimes: `runtimes/node/`, `runtimes/cf-worker/`.
- **admin-service/supabase/**: Nuxt 4 + Vue 3 + Supabase. Schema in `schema.sql`. SSE sync via `server/plugins/realtime.ts`.
- **Sync Protocol**: Admin → Engine via SSE. Data transformed in `transformer.ts` (snake_case DB → camelCase Engine).

## Code Conventions
- TypeScript strict mode. Types in `src/core/config/types.ts`.
- Use camelCase for code, snake_case for DB columns. Use existing utilities before adding new deps.
- Tests: Vitest for unit/E2E. E2E specs in `e2e-suite/specs/`. Admin tests in `admin-service/supabase/tests/`.
- No comments unless complex. Async/await over callbacks. Functional style preferred.

## Jules Orchestrator Mode

When acting as a Jules orchestrator, you delegate tasks to Google Jules (a remote coding agent) via the `jules-mcp` MCP server. Jules is an advanced senior software engineer — give him clear requirements, not code snippets.

### Available MCP Tools
- `jules_create_session` — create a session (owner, repo, branch, prompt). Use `automationMode: "AUTO_CREATE_PR"`. The `branch` parameter must always be the repository's default branch (e.g., `main` or `master`) because Jules creates its own working branch from it.
- `jules_check_jules` — lightweight status poll returning `Q` (needs input), `C` (completed), `F` (failed), `N` (in progress).
- `jules_get_session` — full session details (use only after `Q`/`C`/`F`, never for polling).
- `jules_send_message` / `jules_approve_plan` — respond when Jules is stuck or awaiting approval.
- `jules_extract_pr_from_session` — get PR info from a completed session.
- `jules_delete_session` — clean up after merging.
- `jules_wait` — pause for N seconds (max 600) to conserve context tokens.

### Workflow
1. **Dispatch tasks**: Create Jules sessions with clear, self-contained requirement prompts. Only start tasks in parallel when they are truly fully separated (no shared files, no ordering dependencies).
2. **Wait & poll**: After dispatching, use `jules_wait` in blocks of **300 seconds (5 minutes)**, then call `jules_check_jules` for each active session. Repeat until status is `Q`, `C`, or `F`.
3. **Handle questions**: If status is `Q`, call `jules_get_session` to read the question, then use `jules_send_message` or `jules_approve_plan` to unblock Jules. Resume the wait/poll loop.
4. **Merge completed work**: When status is `C`, use `jules_extract_pr_from_session` to get the PR, then use **GitHub MCP** to merge the pull request.
5. **Clean up**: After merging, delete the Jules branch and session with `jules_delete_session`.
6. **Handle merge conflicts**: If a merge fails due to conflicts, pull the branch locally, resolve conflicts, push, and then merge.

### Key Rules
- Never actively poll — always idle with `jules_wait` (300s blocks) between checks.
- Do not send Jules code snippets; send clear written requirements and let him figure out the implementation.
- Only parallelize tasks you are certain have zero overlap in files or dependencies.
