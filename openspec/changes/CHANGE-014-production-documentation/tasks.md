# Implementation Tasks: Production Documentation

## Task 1: Top-Level README
**File:** `README.md`
- [ ] Project name, description, and badges
- [ ] Feature highlights (redirect engine, analytics, targeting, A/B testing, etc.)
- [ ] Architecture overview with Mermaid diagram
- [ ] Quick start: clone, configure .env, docker compose up
- [ ] Configuration reference: table of all environment variables
- [ ] Links to docs/ subdirectory
- [ ] License section

## Task 2: Developer Onboarding Docs
**Files:** `docs/getting-started.md`, `docs/development/testing.md`, `docs/development/contributing.md`
- [ ] Prerequisites (Node 20+, Docker, Supabase CLI)
- [ ] Step-by-step local setup
- [ ] Project structure overview
- [ ] How to run tests (unit, E2E, perf)
- [ ] Coding conventions summary (from constitution.md)
- [ ] PR workflow and review process

## Task 3: Admin API Reference
**File:** `docs/api/admin-api.md`
- [ ] Document all endpoints from server/api/
- [ ] Request format (headers, body schema)
- [ ] Response format with examples
- [ ] Error codes and messages
- [ ] Authentication requirements per endpoint
- [ ] Rate limiting details per endpoint

## Task 4: Operations Runbook
**File:** `docs/operations/runbook.md`
- [ ] Common tasks: restart services, check logs, clear cache
- [ ] Debugging SSE sync issues
- [ ] Scaling: adding engine instances
- [ ] Troubleshooting common errors
- [ ] Contact and escalation procedures
