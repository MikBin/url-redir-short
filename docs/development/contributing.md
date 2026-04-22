# Contributing Guidelines

Thank you for your interest in contributing to the `url-redir-short` system!

## Contribution Workflow

1. **Fork and Branch:** Create a fork of the repository and branch off `main`.
2. **Develop:** Implement your changes. Make sure to adhere to the coding conventions outlined below.
3. **Test:** Add tests covering the new or changed behavior. Ensure all existing tests pass.
4. **Pull Request:** Open a Pull Request (PR) against the `main` branch. Provide a clear description of the problem solved and the approach taken.
5. **Review:** A project maintainer or automated CI system will review your PR.

## Code Conventions

The project enforces several architectural and style rules, primarily documented in our internal `AGENTS.md`.

- **TypeScript Strict Mode:** All code must be strictly typed. Avoid `any`. Interfaces/types are typically defined in `src/core/config/types.ts`.
- **Naming:**
  - Use `camelCase` for TypeScript code, variables, and function names.
  - Use `snake_case` for Database columns and Supabase responses.
  - Note: A specific utility (`transformer.ts`) handles the conversion between these two layers.
- **Style:**
  - Prefer functional programming styles.
  - Use `async/await` over raw Promises or callbacks.
  - Avoid inline comments unless explaining a complex algorithm. Code should be self-documenting.
  - Avoid adding new external dependencies unless strictly necessary. Utilize existing utilities where possible.

## Design Principles

We strictly follow **SOLID** principles and Clean Architecture.

- **Pure Functions:** Prefer pure functions. Business logic (`src/core/`) must have no side effects, deterministic output, and explicit inputs/outputs.
- **Isolate Side Effects:** Keep side effects (I/O, State Mutation, Network, Cache) at the edges of the system, inside the `adapters/` or `handlers/` layers.
- **Dependency Inversion:** Depend on abstractions (interfaces) rather than concrete implementations, especially when bridging from the `use-cases/` layer to `adapters/`.

## Testing Requirements

- **Test Coverage is Mandatory:** Every new feature, bug fix, or refactor must include tests. If a PR lacks coverage for the new code path, it will not be merged.
- **Scope:** Unit tests should cover pure functions and domain logic. E2E/Integration tests must cover adapters, endpoints, and the SSE synchronization flow.

## Commit Message Conventions

We prefer descriptive, conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation updates
- `test:` for adding or updating tests
- `refactor:` for code changes that neither fix a bug nor add a feature

Example: `feat: add distributed rate limiting adapter`

## OpenSpec Workflow

This repository uses a specification-driven development model governed by the `openspec/` directory. Significant changes should first be discussed and formalized as an OpenSpec change request (e.g., `CHANGE-00X`) before implementation begins.
