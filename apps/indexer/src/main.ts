import { resolve } from "node:path";
import { createForkClients, requireChainClient } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createLogger } from "@fork/observability";
import { JsonFileGovernanceStore, syncMoonwellGovernor } from "@fork/protocol-moonwell";
import { ETHEREUM_CHAIN_ID } from "@fork/shared";

loadRootEnv();
const config = loadConfig();
const logger = createLogger({ name: "indexer", service: "indexer", level: config.LOG_LEVEL });
const store = new JsonFileGovernanceStore(resolve(process.cwd(), ".data/governance-store.json"));

async function tick() {
  const clients = createForkClients(config);
  const result = await syncMoonwellGovernor({
    ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
    base: clients.base,
    store,
  });
  logger.info(
    {
      upserted: result.upserted,
      fromProposalId: result.fromProposalId.toString(),
      toProposalId: result.toProposalId.toString(),
      reorgDetected: result.reorgDetected,
    },
    "governance sync completed",
  );
}

await tick();
const heartbeat = setInterval(() => {
  void tick().catch((error: unknown) => {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, "governance sync failed");
  });
}, config.GOVERNANCE_POLL_INTERVAL_MS);

function shutdown(signal: string) {
  logger.info({ signal }, "indexer shutting down");
  clearInterval(heartbeat);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
