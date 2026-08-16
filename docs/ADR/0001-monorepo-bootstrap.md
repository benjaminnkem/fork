# ADR 0001 — Monorepo bootstrap

- Status: accepted
- Date: 2026-08-16

Keep API, indexer, and simulator as separate apps even while they can share a laptop. They are different failure domains. Shared domain types live in `@fork/*` packages. Tooling stays in `@repo/*`. Node apps run with `tsx` instead of the Nest CLI to keep Phase 0 thin.
