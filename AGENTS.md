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
