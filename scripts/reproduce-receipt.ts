import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { replayPinnedCollateralFactor } from "@fork/protocol-moonwell";
import { compareEconomicReceipts, hashReceipt } from "@fork/simulation-core";
import { ETHEREUM_CHAIN_ID, type Address } from "@fork/shared";

loadRootEnv();

function isPhase5Receipt(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.exposure && record.materialRisk && record.policy && record.provenance);
}

async function main() {
  const file = resolve(process.cwd(), process.argv[2] ?? ".data/replay-moonwell-176.json");
  if (!existsSync(file)) {
    throw new Error(`Stored receipt not found: ${file}. Run pnpm fork:replay moonwell-176 first.`);
  }

  const stored = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const proposalId = String(stored.proposalId ?? "");
  if (proposalId !== "176") {
    throw new Error(`Unsupported stored proposal '${proposalId || "missing"}'`);
  }

  const config = loadConfig();
  if (!config.BASE_RPC_URL) {
    throw new Error("BASE_RPC_URL is required to reproduce a receipt");
  }
  const clients = createForkClients(config);
  const wallet = typeof stored.wallet === "string" ? (stored.wallet as Address) : undefined;
  const replayed = await replayPinnedCollateralFactor({
    ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
    baseRpcUrl: config.BASE_RPC_URL,
    wallet,
  });

  const comparison = compareEconomicReceipts(stored, replayed);
  const replayedHash = hashReceipt(replayed);
  const storedHash = typeof stored.receiptHash === "string" ? stored.receiptHash : undefined;
  const hashMatch = storedHash !== undefined && storedHash === replayedHash && isPhase5Receipt(stored);

  const report = {
    file,
    proposalId,
    wallet: replayed.wallet,
    economicMatch: comparison.match,
    diffs: comparison.diffs,
    storedReceiptHash: storedHash ?? null,
    replayedReceiptHash: replayedHash,
    hashMatch,
    phase5Stored: isPhase5Receipt(stored),
    replayed: {
      beforeLiquidityRaw: replayed.before.risk.liquidityRaw.toString(),
      afterLiquidityRaw: replayed.after.risk.liquidityRaw.toString(),
      liquidityDeltaRaw: replayed.liquidityDeltaRaw,
      materialRisk: replayed.materialRisk.classification,
      exposureRelevant: replayed.exposure.relevant,
      policyPassed: replayed.policyEvaluation.passed,
    },
  };

  console.log(JSON.stringify(toJsonSafe(report), null, 2));
  if (!comparison.match) {
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
