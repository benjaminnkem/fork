import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";

loadRootEnv();
const config = loadConfig();
const logger = createLogger({ name: "indexer", service: "indexer", level: config.LOG_LEVEL });

logger.info(
  {
    pollIntervalMs: config.GOVERNANCE_POLL_INTERVAL_MS,
    registry: config.MOONWELL_REGISTRY_VERSION,
  },
  "indexer skeleton started; Phase 3 implements Ethereum/Base governance sync",
);

const heartbeat = setInterval(() => {
  logger.debug("indexer skeleton idle");
}, config.GOVERNANCE_POLL_INTERVAL_MS);

function shutdown(signal: string) {
  logger.info({ signal }, "indexer shutting down");
  clearInterval(heartbeat);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
