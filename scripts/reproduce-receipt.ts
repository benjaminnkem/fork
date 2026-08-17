import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import {
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  type Address,
} from "@fork/shared";
import {
  describeReplayHonesty,
  loadMoonwell176Manifest,
  receiptMatchesManifestAction,
  replayPinnedCollateralFactor,
  verifyPinnedReplayAnchors,
} from "@fork/protocol-moonwell";
import { compareEconomicReceipts, hashReceipt } from "@fork/simulation-core";

loadRootEnv();

function isReceiptFile(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.exposure && record.materialRisk && record.policy && record.provenance);
}

async function main() {
  const maybeFile = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : undefined;
  const stored =
    maybeFile && existsSync(maybeFile)
      ? (JSON.parse(readFileSync(maybeFile, "utf8")) as Record<string, unknown>)
      : undefined;
  if (maybeFile && !stored) {
    throw new Error(`File not found: ${maybeFile}`);
  }
  if (stored && stored.proposalId && String(stored.proposalId) !== "176" && stored.slug !== "moonwell-176") {
    throw new Error(`Unsupported stored proposal '${String(stored.proposalId)}'`);
  }

  const manifest = loadMoonwell176Manifest();
  const config = loadConfig();
  if (!config.BASE_RPC_URL || !config.ETHEREUM_RPC_URL) {
    throw new Error("BASE_RPC_URL and ETHEREUM_RPC_URL are required to reproduce moonwell-176");
  }
  const clients = createForkClients(config);
  const ethereum = requireChainClient(clients, ETHEREUM_CHAIN_ID);
  const base = requireChainClient(clients, BASE_CHAIN_ID);
  const anchors = await verifyPinnedReplayAnchors({ ethereum, base, manifest });

  const wallet =
    stored && isReceiptFile(stored) && typeof stored.wallet === "string"
      ? (stored.wallet as Address)
      : manifest.wallets.historical.address;
  const replayed = await replayPinnedCollateralFactor({
    ethereum,
    baseRpcUrl: config.BASE_RPC_URL,
    wallet,
  });
  const action = receiptMatchesManifestAction(replayed, manifest);
  const honesty = describeReplayHonesty(replayed);
  const replayedHash = hashReceipt(replayed);
  const storedHash = stored && typeof stored.receiptHash === "string" ? stored.receiptHash : undefined;
  const comparison =
    stored && isReceiptFile(stored) ? compareEconomicReceipts(stored, replayed) : undefined;

  const report = {
    source: stored && isReceiptFile(stored) ? maybeFile : "replays/moonwell-176.json",
    recomputed: true,
    anchors: anchors.checks,
    actionMatch: action.match,
    actionDiffs: action.diffs,
    honesty,
    wallet: replayed.wallet,
    replayedReceiptHash: replayedHash,
    storedReceiptHash: storedHash ?? null,
    hashMatch: storedHash !== undefined ? storedHash === replayedHash : null,
    economicMatch: comparison?.match ?? null,
    diffs: comparison?.diffs ?? [],
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
  if (!action.match || (comparison && !comparison.match)) {
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
