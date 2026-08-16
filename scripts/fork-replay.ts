import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { hashReceipt, simulationIdempotencyKey } from "@fork/simulation-core";
import { replayPinnedCollateralFactor } from "@fork/protocol-moonwell";
import { ETHEREUM_CHAIN_ID } from "@fork/shared";

loadRootEnv();

async function main() {
  const scenario = process.argv[2] ?? "moonwell-176";
  if (scenario !== "moonwell-176") {
    throw new Error("Supported scenario: moonwell-176");
  }
  const config = loadConfig();
  if (!config.BASE_RPC_URL) {
    throw new Error("BASE_RPC_URL is required for archive forking");
  }
  const clients = createForkClients(config);
  const receipt = await replayPinnedCollateralFactor({
    ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
    baseRpcUrl: config.BASE_RPC_URL,
  });
  const receiptHash = hashReceipt(receipt);
  const hashed = {
    ...receipt,
    receiptHash,
    idempotencyKey: simulationIdempotencyKey({
      wallet: receipt.wallet,
      changeId: receipt.changeId,
      forkBlockHash: receipt.fork.blockHash,
      policyVersion: receipt.policy.policyVersion,
      engineVersion: receipt.engineVersion,
    }),
  };
  mkdirSync(resolve(process.cwd(), ".data/receipts"), { recursive: true });
  const outPath = resolve(process.cwd(), ".data/replay-moonwell-176.json");
  writeFileSync(outPath, `${JSON.stringify(toJsonSafe(hashed), null, 2)}\n`);
  writeFileSync(
    resolve(process.cwd(), `.data/receipts/${receiptHash}.json`),
    `${JSON.stringify(toJsonSafe(hashed), null, 2)}\n`,
  );
  console.log(JSON.stringify(toJsonSafe(hashed), null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
