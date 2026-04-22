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

### Design Principles
- **Pure functions**: Prefer pure functions wherever possible — no side effects, deterministic output, explicit inputs/outputs. Isolate side effects (I/O, state mutation, network calls) to the edges of the system (adapters, handlers). Business logic and use cases must be pure and testable.
- **SOLID principles**: Apply SOLID rigorously:
  - **Single Responsibility**: Each module/class/function does one thing.
  - **Open/Closed**: Extend behavior via composition or new modules, not by modifying existing ones.
  - **Liskov Substitution**: Subtypes must be substitutable for their base types — favor interfaces and contracts.
  - **Interface Segregation**: Define narrow, focused interfaces rather than fat general-purpose ones.
  - **Dependency Inversion**: Depend on abstractions (interfaces/types), not concrete implementations. Inject dependencies via constructors or function parameters.

### Test Coverage
- Every new feature, bug fix, or refactor **must include tests** that cover the new or changed behavior.
- Aim for **full coverage** of all new code paths: happy path, edge cases, and error scenarios.
- Unit tests for pure functions and domain logic; integration/E2E tests for adapters and endpoints.
- If a change is not covered by tests, the task is not complete.

## Jules Orchestrator Mode

When acting as a Jules orchestrator, you delegate tasks to Google Jules (a remote coding agent) via the `jules-mcp` MCP server. Jules is an advanced senior software engineer — give him clear requirements, not code snippets.

### Available MCP Tools

**Session Management:**
- `jules_create_session` — create a session (`owner`, `repo`, `branch`, `prompt`). Use `automationMode: "AUTO_CREATE_PR"`. The `branch` parameter must always be the repository's default branch (e.g., `main` or `master`) because Jules creates its own working branch from it.
- `jules_get_session` — full session details (use only after `Q`/`C`/`F`, never for polling).
- `jules_check_jules` — lightweight status poll returning `Q` (needs input), `C` (completed), `F` (failed), `N` (in progress).
- `jules_list_sessions` — list all Jules sessions.
- `jules_delete_session` — delete a session (clean up after merging).
- `jules_approve_plan` — approve a session's plan when awaiting approval.
- `jules_send_message` — send clarification or instructions to a session.

**Monitoring & Activity:**
- `jules_list_activities` — list activities for a session.
- `jules_get_activity` — get a single activity by ID.
- `jules_monitor_session` — poll a session until completion with real-time progress notifications. Returns early if Jules needs input.
- `jules_wait` — pause for N seconds (max 600) to conserve context tokens between polling checks.

**PR Extraction:**
- `jules_extract_pr_from_session` — get PR info from a completed session's outputs.

**Sources:**
- `jules_list_sources` / `jules_get_source` — list/get available GitHub repositories.

### Workflow
1. **Pull latest**: `git pull origin <branch>` before creating any session to ensure Jules works with up-to-date code.
2. **Create session**: Use `jules_create_session` with clear, self-contained requirement prompt. Set `automationMode: "AUTO_CREATE_PR"` and `branch` to the repo's default branch.
3. **Wait & poll**: Use `jules_wait` in blocks of **300 seconds (5 minutes)**, then call `jules_check_jules`. Repeat until status is `Q`, `C`, or `F`.
4. **Handle questions**: If status is `Q`, call `jules_get_session` to read the question, then use `jules_send_message` or `jules_approve_plan` to unblock Jules. Resume the wait/poll loop.
5. **Extract PR**: When status is `C`, use `jules_extract_pr_from_session` to get the PR URL and details.
6. **Merge PR**: Use **GitHub MCP** `merge_pull_request` (squash recommended) to merge the pull request.
7. **Delete branch**: Use GitHub MCP to delete the merged feature branch.
8. **Clean up session**: Delete the Jules session with `jules_delete_session`.
9. **Pull locally**: `git pull origin <branch>` to sync your local repo with the merged changes.

### Sequential Processing
Sessions must be processed **sequentially**. Do not create a new Jules session while another is still active. Always complete the full workflow (create → monitor → approve if needed → extract PR → merge → delete branch → pull) before starting the next session.

### Session States

| State | Description |
|-------|-------------|
| `IN_PROGRESS` | Session is actively working |
| `AWAITING_PLAN_APPROVAL` | Plan ready for review and approval |
| `AWAITING_USER_FEEDBACK` | Session needs input or clarification |
| `COMPLETED` | Session finished successfully (check outputs for PR) |
| `FAILED` | Session encountered an error |

### Error Handling
- If session fails, review error details via `jules_get_session` and create a new session with corrected instructions if needed.
- If PR merge fails due to conflicts, pull the branch locally, resolve conflicts, push, and then retry the merge.
- Always clean up branches and sessions even on failure to avoid orphans.

### Key Rules
- Never actively poll — always idle with `jules_wait` (300s blocks) between checks.
- Never use `jules_get_session` for periodic polling — use `jules_check_jules` only (compact `Q`/`C`/`F`/`N` response).
- Do not send Jules code snippets; send clear written requirements and let him figure out the implementation.
- Process sessions sequentially — complete the full workflow before starting the next.
