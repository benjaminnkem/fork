import { resolve } from "node:path";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { ETHEREUM_CHAIN_ID } from "@fork/shared";
import {
  JsonFileGovernanceStore,
  PINNED_BASE_CF_PROPOSAL_ID,
  syncMoonwellGovernor,
} from "@fork/protocol-moonwell";

loadRootEnv();

async function main() {
  const config = loadConfig();
  const clients = createForkClients(config);
  const store = new JsonFileGovernanceStore(resolve(process.cwd(), ".data/governance-store.json"));
  const result = await syncMoonwellGovernor({
    ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
    base: clients.base,
    store,
  });
  const pinned = await store.getIndexedChange(`moonwell:eth:${PINNED_BASE_CF_PROPOSAL_ID}`);
  console.log(
    JSON.stringify(
      toJsonSafe({
        fromProposalId: result.fromProposalId,
        toProposalId: result.toProposalId,
        upserted: result.upserted,
        reorgDetected: result.reorgDetected,
        cursorBlock: result.cursor.lastProcessedBlock,
        pinned,
      }),
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
