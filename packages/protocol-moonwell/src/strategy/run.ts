import type { ForkChainClient } from "@fork/blockchain";
import { createUserRiskPolicy } from "@fork/risk-engine";
import type { StrategySearchResult } from "@fork/strategy-engine";
import type { Address, UserRiskPolicy } from "@fork/shared";
import { openPinnedReplaySession } from "../governance/pinned-fork.js";
import { executePlanCalls } from "./execute.js";
import { assessRepayFeasibility, readAllowance } from "./feasibility.js";
import { buildRepayPlan } from "./plans.js";
import {
  collectBalances,
  collectPrices,
  evaluateChangeOnly,
  searchMoonwellStrategy,
  type StrategySearchSession,
} from "./search.js";

export interface StrategyComparison {
  wallet: Address;
  policy: UserRiskPolicy;
  changeOnlyPassed: boolean;
  changeOnlyBufferBps?: number;
  repay: StrategySearchResult;
  addCollateral: StrategySearchResult;
}

export async function smokeRepayExecution(input: {
  ethereum: ForkChainClient;
  baseRpcUrl: string;
  wallet: Address;
}): Promise<{
  feasible: boolean;
  amountRaw: string | null;
  borrowBefore: string | null;
  borrowAfter: string | null;
  success: boolean;
  reasons: string[];
}> {
  const session = await openPinnedReplaySession({
    ethereum: input.ethereum,
    baseRpcUrl: input.baseRpcUrl,
    wallet: input.wallet,
  });
  try {
    const positions = await session.adapter.getUserPositions(session.wallet, session.anchor);
    const markets = await session.adapter.listMarkets(session.anchor);
    const searchSession: StrategySearchSession = {
      anvil: session.anvil,
      adapter: session.adapter,
      client: session.anvil.client,
      wallet: session.wallet,
      anchor: session.anchor,
      comptroller: session.comptroller,
      temporalGovernor: session.temporalGovernor,
      destination: {
        to: session.cfCall.target,
        data: session.cfCall.calldata,
        value: session.cfCall.valueRaw,
      },
      policy: session.policy,
      positions,
      markets,
      maxProbes: 1,
    };
    const balances = await collectBalances(searchSession);
    const prices = await collectPrices(searchSession);
    const feasibility = assessRepayFeasibility({
      positions,
      balances,
      prices,
      policy: session.policy,
    });
    if (!feasibility.feasible || !feasibility.market || !feasibility.underlying) {
      return {
        feasible: false,
        amountRaw: null,
        borrowBefore: null,
        borrowAfter: null,
        success: false,
        reasons: feasibility.reasons,
      };
    }
    const debt = positions.find(
      (position) => position.market.toLowerCase() === feasibility.market!.toLowerCase(),
    );
    const amount = feasibility.boundRaw;
    const allowance = await readAllowance({
      client: session.anvil.client,
      token: feasibility.underlying,
      wallet: session.wallet,
      spender: feasibility.market,
      blockNumber: session.anchor.blockNumber,
    });
    const plan = buildRepayPlan({
      wallet: session.wallet,
      market: feasibility.market,
      underlying: feasibility.underlying,
      amountRaw: amount,
      boundRaw: feasibility.boundRaw,
      allowanceRaw: allowance,
      collateralEnabled: debt?.collateralEnabled ?? true,
      policy: session.policy,
    });
    const executed = await executePlanCalls(session.anvil, session.wallet, plan);
    const afterPositions = await session.adapter.getUserPositions(session.wallet, {
      ...session.anchor,
      blockNumber: (await session.anvil.client.getBlock({ blockTag: "latest" })).number,
      blockHash: (await session.anvil.client.getBlock({ blockTag: "latest" })).hash!,
      finality: "latest",
    });
    const afterDebt = afterPositions.find(
      (position) => position.market.toLowerCase() === feasibility.market!.toLowerCase(),
    );
    const success =
      executed.reasons.length === 0 &&
      afterDebt !== undefined &&
      debt !== undefined &&
      afterDebt.borrowedRaw < debt.borrowedRaw;
    return {
      feasible: true,
      amountRaw: amount.toString(),
      borrowBefore: debt?.borrowedRaw.toString() ?? null,
      borrowAfter: afterDebt?.borrowedRaw.toString() ?? null,
      success,
      reasons: success ? ["REPAY_REDUCED_DEBT"] : executed.reasons,
    };
  } finally {
    await session.close();
  }
}

export async function comparePinnedStrategies(input: {
  ethereum: ForkChainClient;
  baseRpcUrl: string;
  wallet?: Address;
  policy?: UserRiskPolicy;
  maxProbes?: number;
  raiseBufferToForceSearch?: boolean;
}): Promise<StrategyComparison> {
  const session = await openPinnedReplaySession({
    ethereum: input.ethereum,
    baseRpcUrl: input.baseRpcUrl,
    wallet: input.wallet,
    policy: input.policy,
  });
  try {
    const positions = await session.adapter.getUserPositions(session.wallet, session.anchor);
    const markets = await session.adapter.listMarkets(session.anchor);
    const searchSession: StrategySearchSession = {
      anvil: session.anvil,
      adapter: session.adapter,
      client: session.anvil.client,
      wallet: session.wallet,
      anchor: session.anchor,
      comptroller: session.comptroller,
      temporalGovernor: session.temporalGovernor,
      destination: {
        to: session.cfCall.target,
        data: session.cfCall.calldata,
        value: session.cfCall.valueRaw,
      },
      policy: session.policy,
      positions,
      markets,
      maxProbes: input.maxProbes ?? 20,
    };

    const changeOnly = await evaluateChangeOnly(searchSession);
    if (input.raiseBufferToForceSearch && changeOnly.passed) {
      const measured = changeOnly.riskBufferBps ?? 0;
      searchSession.policy = createUserRiskPolicy({
        minSafetyBufferBps: measured + 1,
        optimizationGoal: session.policy.optimizationGoal,
        allowRepayDebt: session.policy.allowRepayDebt,
        allowAddCollateral: session.policy.allowAddCollateral,
        maxRepayRawByAsset: session.policy.maxRepayRawByAsset,
        maxCollateralRawByAsset: session.policy.maxCollateralRawByAsset,
      });
    }

    const repay = await searchMoonwellStrategy(searchSession, "REPAY_DEBT");
    const addCollateral = await searchMoonwellStrategy(searchSession, "ADD_COLLATERAL");
    return {
      wallet: session.wallet,
      policy: searchSession.policy,
      changeOnlyPassed: changeOnly.passed,
      changeOnlyBufferBps: changeOnly.riskBufferBps,
      repay,
      addCollateral,
    };
  } finally {
    await session.close();
  }
}
