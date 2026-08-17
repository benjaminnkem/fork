import { moonwellComptrollerAbi, moonwellMTokenAbi, moonwellOracleAbi } from "@fork/abis";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import {
  loadMoonwell176Manifest,
  PINNED_ADD_COLLATERAL_WALLET,
  PINNED_REPLAY_WALLET,
  replayPinnedCollateralFactor,
} from "@fork/protocol-moonwell";
import { classifyComptrollerLiquidity } from "@fork/risk-engine";
import { BASE_CHAIN_ID, ETHEREUM_CHAIN_ID, type Address } from "@fork/shared";
import { getAddress } from "viem";

loadRootEnv();

const manifest = loadMoonwell176Manifest();
const MARKET = getAddress(manifest.contracts.market) as Address;
const COMPTROLLER = getAddress(manifest.contracts.comptroller) as Address;
const FORK_BLOCK = BigInt(manifest.fork.blockNumber);
const BEFORE_CF = BigInt(manifest.action.beforeCollateralFactorMantissa);
const AFTER_CF = BigInt(manifest.action.afterCollateralFactorMantissa);
const CF_DELTA = BEFORE_CF - AFTER_CF;
const SCALE = 10n ** 18n;

interface Candidate {
  wallet: Address;
  suppliedRaw: string;
  borrowedRaw: string;
  collateralEnabled: boolean;
  beforeStatus: string;
  beforeLiquidityRaw: string;
  beforeShortfallRaw: string;
  predictedHaircutRaw: string;
  predictedAfterLiquidityRaw: string;
  predictedAfterShortfallRaw: string;
  predictedAfterStatus: string;
  wouldCreateShortfall: boolean;
}

function predictedAfter(liquidity: bigint, shortfall: bigint, haircut: bigint) {
  if (shortfall > 0n) {
    return {
      afterLiquidity: 0n,
      afterShortfall: shortfall + haircut,
      status: "SHORTFALL" as const,
      created: false,
    };
  }
  if (haircut < liquidity) {
    return {
      afterLiquidity: liquidity - haircut,
      afterShortfall: 0n,
      status: "SAFE" as const,
      created: false,
    };
  }
  if (haircut === liquidity) {
    return {
      afterLiquidity: 0n,
      afterShortfall: 0n,
      status: "AT_RISK" as const,
      created: false,
    };
  }
  return {
    afterLiquidity: 0n,
    afterShortfall: haircut - liquidity,
    status: "SHORTFALL" as const,
    created: true,
  };
}

async function alchemyTransfers(rpcUrl: string): Promise<Address[]> {
  const found = new Set<string>();
  let pageKey: string | undefined;
  for (let page = 0; page < 25; page += 1) {
    const payload = {
      jsonrpc: "2.0",
      id: page + 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: `0x${FORK_BLOCK.toString(16)}`,
          contractAddresses: [MARKET],
          category: ["erc20"],
          excludeZeroValue: true,
          maxCount: "0x3e8",
          ...(pageKey ? { pageKey } : {}),
        },
      ],
    };
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`alchemy_getAssetTransfers HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      error?: { message?: string };
      result?: { pageKey?: string; transfers?: Array<{ from?: string; to?: string }> };
    };
    if (body.error) {
      throw new Error(body.error.message ?? "alchemy_getAssetTransfers failed");
    }
    for (const transfer of body.result?.transfers ?? []) {
      for (const value of [transfer.from, transfer.to]) {
        if (!value || value === "0x0000000000000000000000000000000000000000") continue;
        try {
          found.add(getAddress(value));
        } catch {
          continue;
        }
      }
    }
    pageKey = body.result?.pageKey;
    if (!pageKey) break;
  }
  return [...found] as Address[];
}

async function main() {
  const config = loadConfig();
  if (!config.BASE_RPC_URL) {
    throw new Error("BASE_RPC_URL is required");
  }
  const clients = createForkClients(config);
  const base = requireChainClient(clients, BASE_CHAIN_ID);
  const block = await base.client.getBlock({ blockNumber: FORK_BLOCK });
  if (!block.hash) throw new Error("Fork block missing hash");

  const seeds = new Set<string>([PINNED_REPLAY_WALLET, PINNED_ADD_COLLATERAL_WALLET]);
  const alchemy = config.BASE_RPC_URL.includes("alchemy.com");
  let discovery = "seed-wallets";
  if (alchemy) {
    const transferred = await alchemyTransfers(config.BASE_RPC_URL);
    for (const wallet of transferred) seeds.add(wallet);
    discovery = `alchemy_getAssetTransfers+seeds:${seeds.size}`;
  }

  const oracle = getAddress(
    (await base.client.readContract({
      address: COMPTROLLER,
      abi: moonwellComptrollerAbi,
      functionName: "oracle",
      blockNumber: FORK_BLOCK,
    })) as string,
  ) as Address;
  const price = (await base.client.readContract({
    address: oracle,
    abi: moonwellOracleAbi,
    functionName: "getUnderlyingPrice",
    args: [MARKET],
    blockNumber: FORK_BLOCK,
  })) as bigint;

  const wallets = [...seeds] as Address[];
  const candidates: Candidate[] = [];
  const chunk = 40;
  for (let i = 0; i < wallets.length; i += chunk) {
    const slice = wallets.slice(i, i + chunk);
    const [memberships, snapshots, liquidities] = await Promise.all([
      base.client.multicall({
        contracts: slice.map((wallet) => ({
          address: COMPTROLLER,
          abi: moonwellComptrollerAbi,
          functionName: "checkMembership" as const,
          args: [wallet, MARKET] as const,
        })),
        allowFailure: true,
        blockNumber: FORK_BLOCK,
      }),
      base.client.multicall({
        contracts: slice.map((wallet) => ({
          address: MARKET,
          abi: moonwellMTokenAbi,
          functionName: "getAccountSnapshot" as const,
          args: [wallet] as const,
        })),
        allowFailure: true,
        blockNumber: FORK_BLOCK,
      }),
      base.client.multicall({
        contracts: slice.map((wallet) => ({
          address: COMPTROLLER,
          abi: moonwellComptrollerAbi,
          functionName: "getAccountLiquidity" as const,
          args: [wallet] as const,
        })),
        allowFailure: true,
        blockNumber: FORK_BLOCK,
      }),
    ]);

    for (let j = 0; j < slice.length; j += 1) {
      const membership = memberships[j];
      const snapshot = snapshots[j];
      const liquidity = liquidities[j];
      if (membership?.status !== "success" || snapshot?.status !== "success" || liquidity?.status !== "success") {
        continue;
      }
      const [error, mTokenBalance, borrowedRaw, exchangeRateRaw] = snapshot.result;
      if (error !== 0n) continue;
      const suppliedRaw = (mTokenBalance * exchangeRateRaw) / SCALE;
      if (suppliedRaw <= 0n || !membership.result) continue;
      const [liqError, liquidityRaw, shortfallRaw] = liquidity.result;
      const beforeStatus = classifyComptrollerLiquidity(liqError, liquidityRaw, shortfallRaw);
      const haircut = (suppliedRaw * price * CF_DELTA) / (SCALE * SCALE);
      const after = predictedAfter(liquidityRaw, shortfallRaw, haircut);
      candidates.push({
        wallet: slice[j]!,
        suppliedRaw: suppliedRaw.toString(),
        borrowedRaw: borrowedRaw.toString(),
        collateralEnabled: true,
        beforeStatus,
        beforeLiquidityRaw: liquidityRaw.toString(),
        beforeShortfallRaw: shortfallRaw.toString(),
        predictedHaircutRaw: haircut.toString(),
        predictedAfterLiquidityRaw: after.afterLiquidity.toString(),
        predictedAfterShortfallRaw: after.afterShortfall.toString(),
        predictedAfterStatus: after.status,
        wouldCreateShortfall: after.created,
      });
    }
  }

  candidates.sort((left, right) => {
    if (left.wouldCreateShortfall !== right.wouldCreateShortfall) {
      return left.wouldCreateShortfall ? -1 : 1;
    }
    return BigInt(left.predictedAfterLiquidityRaw) < BigInt(right.predictedAfterLiquidityRaw) ? -1 : 1;
  });

  const created = candidates.filter((item) => item.wouldCreateShortfall);
  const tightest = candidates.slice(0, 8);
  let replayed: unknown = null;
  const verify = created[0] ?? null;
  if (verify && config.ETHEREUM_RPC_URL) {
    const receipt = await replayPinnedCollateralFactor({
      ethereum: requireChainClient(clients, ETHEREUM_CHAIN_ID),
      baseRpcUrl: config.BASE_RPC_URL,
      wallet: verify.wallet,
    });
    replayed = {
      wallet: receipt.wallet,
      beforeStatus: receipt.before.risk.status,
      afterStatus: receipt.after.risk.status,
      materialRisk: receipt.materialRisk.classification,
      beforeLiquidityRaw: receipt.before.risk.liquidityRaw.toString(),
      afterLiquidityRaw: receipt.after.risk.liquidityRaw.toString(),
      afterShortfallRaw: receipt.after.risk.shortfallRaw.toString(),
    };
  }

  console.log(
    JSON.stringify(
      toJsonSafe({
        forkBlock: FORK_BLOCK.toString(),
        forkHash: block.hash,
        market: MARKET,
        discovery,
        screened: wallets.length,
        collateralSuppliers: candidates.length,
        predictedShortfallCreated: created.length,
        created,
        tightest,
        replayed,
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
