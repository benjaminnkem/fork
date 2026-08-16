import { resolve } from "node:path";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";
import { defaultGovernanceStore, openMonitorInfra, runMonitorTick } from "./monitor.js";

loadRootEnv();
const config = loadConfig();
const logger = createLogger({ name: "indexer", service: "indexer", level: config.LOG_LEVEL });
const store = defaultGovernanceStore();
const infra = await openMonitorInfra(config);
const metricsPath = resolve(process.cwd(), ".data/monitoring-metrics.json");

async function tick() {
  const result = await runMonitorTick({
    config,
    store,
    models: infra.models,
    queue: infra.queue,
    metricsPath,
  });
  logger.info(
    {
      ethLag: result.metrics.ethereum.lagBlocks,
      baseLag: result.metrics.base.lagBlocks,
      upserted: result.metrics.ethereum.upserted,
      destUpdated: result.metrics.base.updated,
      staleMarked: result.metrics.staleMarked,
      enqueued: result.metrics.enqueued,
      reorg: result.metrics.ethereum.reorgDetected || result.metrics.base.reorgDetected,
      transitions: result.transitions.length,
    },
    "monitor tick completed",
  );
}

await tick();
const heartbeat = setInterval(() => {
  void tick().catch((error: unknown) => {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, "monitor tick failed");
  });
}, config.GOVERNANCE_POLL_INTERVAL_MS);

async function shutdown(signal: string) {
  logger.info({ signal }, "indexer shutting down");
  clearInterval(heartbeat);
  await infra.queue?.close();
  await infra.redis?.quit();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
