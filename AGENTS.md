# Repository Guidelines

## Project Context

This npm-workspace repository is Project Thriveward / Thriveward Funding Intelligence. Preserve the current uncommitted working tree. Never reset, clean, stash, checkout, revert, commit, or push unless explicitly authorized.

Codex is the primary implementation agent. Other agents may review, but must not edit the same working tree simultaneously. Reports should concisely list files changed, tests run and results, unresolved blockers, and Git status.

## Project Structure

- `apps/api/src/`: Express/TypeScript routes, services, integrations, scripts, and Vitest tests.
- `apps/api/prisma/`: Prisma schema, migrations, and seed tooling.
- `apps/web/src/`: React/Vite dashboard and colocated component tests.
- `packages/shared/`: shared TypeScript interfaces, enums, and utilities.
- `services/funding-agent/`: Python funding-intelligence service.
- `docs/`: product and architecture references.

Do not edit generated `dist/`, `node_modules/`, or runtime document-storage directories.

## Commands, Style, and Tests

- `npm run dev:api` / `npm run dev:web`: start local API or web development.
- `npm run build`: build shared types, API, and web.
- `npm test`: run workspace Vitest suites; prefer focused workspace or file tests during development.
- `npm run db:generate`: regenerate Prisma client after an approved schema change.

Use TypeScript with two-space indentation, semicolons, single quotes, `camelCase` variables/functions, and `PascalCase` classes/components. Tests use `*.test.ts` or `*.test.tsx`. Diagnose before modifying, prefer the smallest principled fix, and avoid broad rewrites for isolated defects. Batch related implementation and verification into one meaningful phase; do not repeatedly run the full suite after speculative changes.

## Database Safety

`bridge_ai_db` is operational/protected. `bridge_ai_test_db` is the protected manual-acceptance sandbox. Automated Vitest may use only disposable `bridge_ai_vitest_*` databases. Never reset, truncate, reseed, drop, or destructively modify either protected database. Never run migrations against them without explicit authorization.

## Authentication and Secrets

Never invent, rotate, reset, or change a human password unless explicitly instructed. Never print passwords, session tokens, API keys, database credentials, `.env` values, or other secrets; do not guess credentials or repeatedly retry logins.

Explicitly label development-only accounts. A human must choose development passwords and store them only in Git-ignored local environment files or a password manager. Never commit them. Agents must use development-only authentication instead of altering the human acceptance account.

## AI and Provider Safety

Never call paid AI providers without explicit authorization, and never print `OPENAI_API_KEY`. Automated tests must run with:

```text
OPENAI_API_KEY=""
AI_FUNDING_ANALYST_ENABLED=false
AI_DOCUMENT_GROUNDING_ENABLED=false
DOCUMENT_INGESTION_ENABLED=false
```

Stop for authorization at material risk boundaries: protected-database mutation, paid-provider calls, production or deployment operations, credentials, destructive commands, commits, and pushes.

## Current Verified Milestone State

- Full API suite: 33 files and 438 tests passed with disposable database isolation.
- Project Thriveward: `INCORPORATED`, California entity `B20260372748`; tax exemption and 501(c)(3) not obtained; SAM/UEI and Grants.gov not registered.
- BJA discovery passed for `O-BJA-2026-172698`, external ID `363637`: `FUTURE_OPPORTUNITY`, `NEEDS_REGISTRATIONS`, recommended pathway `registration`.

Discovery and routing semantics are frozen for this milestone unless a concrete blocker is proven.

## Commits and Pull Requests

Use focused Conventional Commit-style subjects such as `feat(ai2b): ...`, `fix(sec): ...`, or `test(org): ...`. Pull requests should describe behavior changes, verification results, configuration or migration impact, linked work, and screenshots for visible UI changes.
