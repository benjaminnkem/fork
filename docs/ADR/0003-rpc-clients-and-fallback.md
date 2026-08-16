# ADR 0003 — RPC clients and fallback

- Status: accepted
- Date: 2026-08-16

Use viem public clients with an explicit primary URL and optional fallback URL. Application code classifies RPC failures and retries only rate-limits/timeouts. Missing historical state and chain-ID mismatches fail closed. Never silently substitute a different block than the one requested. Do not log RPC URLs.
