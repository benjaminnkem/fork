import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import {
  comparePinnedStrategies,
  PINNED_ADD_COLLATERAL_WALLET,
} from "@fork/protocol-moonwell";
import { ETHEREUM_CHAIN_ID, type Address } from "@fork/shared";
import { isAddress } from "viem";

loadRootEnv();

function parseArgs(argv: string[]) {
  const walletArg = argv.find((arg) => isAddress(arg));
  const scenarioArg = argv.find((arg) => !arg.startsWith("--") && !isAddress(arg));
  const force = argv.includes("--force-search-buffer");
  return {
    scenario: scenarioArg ?? "moonwell-176",
    wallet: (walletArg as Address | undefined) ?? PINNED_ADD_COLLATERAL_WALLET,
    forceSearch: force,
  };
}

async function main() {
  const { scenario, wallet, forceSearch } = parseArgs(process.argv.slice(2));
  if (scenario !== "moonwell-176") {
    throw new Error("Supported scenario: moonwell-176");
  }
  const config = loadConfig();
  if (!config.BASE_RPC_URL) {
    throw new Error("BASE_RPC_URL is required for archive forking");
  }
  const clients = createForkClients(config);
  const comparison = await comparePinnedStrategies({
    ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
    baseRpcUrl: config.BASE_RPC_URL,
    wallet,
    maxProbes: 40,
    raiseBufferToForceSearch: forceSearch,
  });
  const summary = {
    scenario,
    wallet: comparison.wallet,
    policy: comparison.policy,
    changeOnlyPassed: comparison.changeOnlyPassed,
    changeOnlyBufferBps: comparison.changeOnlyBufferBps ?? null,
    strategies: {
      REPAY_DEBT: {
        status: comparison.repay.status,
        amountRaw: comparison.repay.amountRaw,
        boundRaw: comparison.repay.boundRaw,
        reasons: comparison.repay.reasons,
        probes: comparison.repay.probes,
        rejectedBranches: comparison.repay.branches.filter((branch) => branch.status === "REJECTED")
          .length,
        verifiedBranches: comparison.repay.branches.filter((branch) => branch.status === "VERIFIED")
          .length,
      },
      ADD_COLLATERAL: {
        status: comparison.addCollateral.status,
        amountRaw: comparison.addCollateral.amountRaw,
        boundRaw: comparison.addCollateral.boundRaw,
        reasons: comparison.addCollateral.reasons,
        probes: comparison.addCollateral.probes,
        rejectedBranches: comparison.addCollateral.branches.filter(
          (branch) => branch.status === "REJECTED",
        ).length,
        verifiedBranches: comparison.addCollateral.branches.filter(
          (branch) => branch.status === "VERIFIED",
        ).length,
      },
    },
  };
  mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), ".data/strategies-moonwell-176.json"),
    `${JSON.stringify(toJsonSafe({ summary, comparison }), null, 2)}\n`,
  );
  console.log(JSON.stringify(toJsonSafe(summary), null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
