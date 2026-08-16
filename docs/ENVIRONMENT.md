# Environment variables

Keep this file synchronized with `.env.example`.

| Variable | Required | Service | Secret | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | no, default development | all | no | Node environment |
| `APP_ENV` | no, default local | all | no | local/test/staging/production |
| `APP_VERSION` | no | all | no | receipt/log version |
| `LOG_LEVEL` | no | all | no | pino level |
| `API_PORT` | no, 4000 | api | no | HTTP port |
| `WEB_ORIGIN` | no | api | no | CORS origin |
| `API_PUBLIC_URL` | no | api | no | public API URL |
| `SESSION_SECRET` | production | api | yes | wallet-auth sessions (Phase 10) |
| `AUTH_NONCE_TTL_SECONDS` | no | api | no | signed-nonce TTL |
| `PUBLIC_RATE_LIMIT_*` | no | api | no | public analysis limits |
| `MONGODB_URI` | production | api/indexer/simulator | yes | durable state |
| `MONGODB_DB_NAME` | no | api | no | database name |
| `REDIS_URL` | production | api/indexer/simulator | yes | queues |
| `BASE_CHAIN_ID` | must be 8453 | blockchain | no | locked V1 chain |
| `BASE_RPC_URL` | local real-chain + production | blockchain | yes if keyed | archive-capable Base RPC (Alchemy/QuickNode HTTPS) |
| `BASE_FALLBACK_RPC_URL` | no | blockchain | maybe | public fallback, rate-limited |
| `ETHEREUM_CHAIN_ID` | must be 1 | blockchain | no | governance source |
| `ETHEREUM_RPC_URL` | local real-chain + production | blockchain | yes if keyed | Ethereum RPC |
| `ETHEREUM_FALLBACK_RPC_URL` | no | blockchain | maybe | optional Ethereum fallback |
| `MOONWELL_REGISTRY_VERSION` | no | protocol | no | pinned registry id |
| `MOONWELL_ALLOW_REGISTRY_OVERRIDE` | no, default false | protocol | no | fail-closed override |
| `GOVERNANCE_POLL_INTERVAL_MS` | no, 60000 | indexer | no | poll interval |
| `GOVERNANCE_*_START_BLOCK` | later | indexer | no | backfill cursors |
| `GOVERNANCE_LOG_BLOCK_RANGE` | no | indexer | no | eth_getLogs window |
| `ANVIL_*` / `MAX_PARALLEL_FORKS` / `SIMULATION_*` | Phase 4 | simulator | no | fork controls; `FORK_START_TIMEOUT_MS` default 180000 |
| `GROQ_API_KEY` | Phase 7 / live agent tests | agent | yes | Groq Console key (`gsk_…`) |
| `GROQ_PLANNER_MODEL` | no | agent | no | default `openai/gpt-oss-120b` |
| `GROQ_FALLBACK_MODEL` | no | agent | no | default `openai/gpt-oss-20b` |
| `AGENT_*` | no | agent | no | step/time/token/invalid-call limits. `AGENT_INCLUDE_REASONING` stays false in production |
| `DEFAULT_MIN_SAFETY_BUFFER_BPS` | product decision | risk | no | **do not invent**; unset until approved. Receipts record `NO_ADDITIONAL_BUFFER` when empty |
| `SIMULATION_MAX_AGE_SECONDS` | no | simulation | no | freshness |
| `ENABLE_MAINNET_TRANSACTION_PREPARATION` | no, false | execution | no | Phase 10 |
| `ENABLE_AUTONOMOUS_MAINNET_EXECUTION` | must stay false | execution | no | V1 forbids this |
| `NEXT_PUBLIC_API_URL` | web | web | no | public API |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | web | web | no | 8453 |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | web | no | later wallet UX |

Production (`NODE_ENV=production` or `APP_ENV=production`) refuses to start without session, Mongo, Redis, Base RPC, and Ethereum RPC. It also refuses autonomous mainnet execution.
