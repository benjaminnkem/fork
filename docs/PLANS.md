# PLANS.md — Fork execution-plan rules

Fork is complex enough that large phases should be implemented from explicit execution plans.

## When to create/update a plan

Create a plan for any task that:

- spans multiple packages/apps;
- changes protocol/governance semantics;
- changes simulation lifecycle;
- adds a strategy class;
- adds mainnet transaction preparation;
- changes persistence schemas/indexes;
- changes deployment/runtime topology.

## Required plan sections

1. **Goal** — one concrete outcome.
2. **Current verified state** — what already works and what tests prove it.
3. **Primary-source research required** — official docs/repos/onchain facts that must be verified.
4. **Scope** — in/out.
5. **Files/packages affected**.
6. **Domain/API/schema changes**.
7. **Security implications**.
8. **Migration/backward compatibility**.
9. **Failure/edge cases**.
10. **Test plan** — pure, integration, real-chain, E2E.
11. **Observability** — logs/metrics needed.
12. **Rollout/rollback**.
13. **Definition of done**.

## Execution behavior

- Implement one coherent milestone at a time.
- Keep the plan updated as facts are discovered.
- Do not silently change scope.
- If current official protocol behavior contradicts the handoff docs, update the research/ADR first and adapt the implementation; do not force reality to match stale assumptions.
- If a critical unresolved ambiguity remains after primary-source/onchain research, ask the user with the concrete alternatives/tradeoffs.

## Done criteria

A task is done only after:

- code compiles;
- relevant tests pass;
- real-chain acceptance passes if protocol/simulation logic changed;
- docs/env changes are updated;
- no TODO silently replaces a required feature;
- implementation status records remaining limitations.
