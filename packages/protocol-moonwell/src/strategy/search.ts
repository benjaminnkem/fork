import { moonwellComptrollerAbi, moonwellOracleAbi } from "@fork/abis";
import { evaluatePolicy } from "@fork/risk-engine";
import type { AnvilInstance } from "@fork/simulation-core";
import {
  findMinimumPassingAmount,
  type StrategyBranchEvidence,
  type StrategyFeasibility,
  type StrategySearchResult,
  type TransactionPlan,
} from "@fork/strategy-engine";
import type { Address, BlockAnchor, Hex, ProtocolPosition, UserRiskPolicy } from "@fork/shared";
import type { MoonwellAdapter, MoonwellMarket } from "../adapter.js";
import {
  assessAddCollateralFeasibility,
  assessRepayFeasibility,
  readAllowance,
  readMarketConstraints,
  readTokenBalance,
  type MarketConstraints,
} from "./feasibility.js";
import { applyDestinationCall, readEnrichedRisk, verifyExecutedPlan } from "./execute.js";
import { buildAddCollateralPlan, buildRepayPlan } from "./plans.js";

export interface StrategySearchSession {
  anvil: AnvilInstance;
  adapter: MoonwellAdapter;
  client: { readContract: (args: object) => Promise<unknown> };
  wallet: Address;
  anchor: BlockAnchor;
  comptroller: Address;
  temporalGovernor: Address;
  destination: { to: Address; data: Hex; value: bigint };
  policy: UserRiskPolicy;
  positions: ProtocolPosition[];
  markets: MoonwellMarket[];
  maxProbes: number;
}

export async function collectBalances(
  session: StrategySearchSession,
): Promise<Map<string, bigint>> {
  const tokens = new Set<string>();
  for (const position of session.positions) {
    tokens.add(position.underlying.toLowerCase());
  }
  for (const market of session.markets) {
    if (market.underlying) tokens.add(market.underlying.toLowerCase());
  }
  const balances = new Map<string, bigint>();
  for (const token of tokens) {
    const balance = await readTokenBalance({
      client: session.client,
      token: token as Address,
      wallet: session.wallet,
      blockNumber: session.anchor.blockNumber,
    });
    balances.set(token, balance);
  }
  return balances;
}

export async function collectConstraints(
  session: StrategySearchSession,
): Promise<Map<string, MarketConstraints>> {
  const constraints = new Map<string, MarketConstraints>();
  for (const market of session.markets) {
    constraints.set(
      market.market.toLowerCase(),
      await readMarketConstraints({
        client: session.client,
        comptroller: session.comptroller,
        market: market.market,
        blockNumber: session.anchor.blockNumber,
      }),
    );
  }
  return constraints;
}

export async function collectPrices(
  session: StrategySearchSession,
): Promise<Map<string, bigint>> {
  const oracle = (await session.client.readContract({
    address: session.comptroller,
    abi: moonwellComptrollerAbi,
    functionName: "oracle",
    blockNumber: session.anchor.blockNumber,
  })) as Address;
  const prices = new Map<string, bigint>();
  for (const market of session.markets) {
    const price = (await session.client.readContract({
      address: oracle,
      abi: moonwellOracleAbi,
      functionName: "getUnderlyingPrice",
      args: [market.market],
      blockNumber: session.anchor.blockNumber,
    })) as bigint;
    prices.set(market.market.toLowerCase(), price);
  }
  return prices;
}

export async function evaluateChangeOnly(
  session: StrategySearchSession,
): Promise<{ passed: boolean; riskBufferBps?: number; reasons: string[] }> {
  const snapshot = await session.anvil.client.snapshot();
  try {
    const applied = await applyDestinationCall(
      session.anvil,
      session.temporalGovernor,
      session.destination.to,
      session.destination.data,
      session.destination.value,
    );
    if (!applied.success) {
      return { passed: false, reasons: [applied.error ?? "destination effect reverted"] };
    }
    const latest = await session.anvil.client.getBlock({ blockTag: "latest" });
    if (!latest.hash) {
      return { passed: false, reasons: ["missing after-block hash"] };
    }
    const risk = await readEnrichedRisk(
      session.adapter,
      session.client,
      session.comptroller,
      session.wallet,
      {
        chainId: session.anchor.chainId,
        blockNumber: latest.number,
        blockHash: latest.hash,
        timestamp: Number(latest.timestamp),
        finality: "latest",
        rpcProviderId: "anvil-fork",
      },
    );
    const evaluation = evaluatePolicy(risk, session.policy);
    return {
      passed: evaluation.passed,
      riskBufferBps: risk.derived?.safetyBufferBps,
      reasons: evaluation.reasons,
    };
  } finally {
    await session.anvil.client.revert({ id: snapshot });
  }
}

export async function searchMoonwellStrategy(
  session: StrategySearchSession,
  strategyType: "REPAY_DEBT" | "ADD_COLLATERAL",
): Promise<StrategySearchResult> {
  const balances = await collectBalances(session);
  const constraints = await collectConstraints(session);
  const prices = await collectPrices(session);
  const feasibility: StrategyFeasibility =
    strategyType === "REPAY_DEBT"
      ? assessRepayFeasibility({
          positions: session.positions,
          balances,
          prices,
          policy: session.policy,
        })
      : assessAddCollateralFeasibility({
          positions: session.positions,
          markets: session.markets,
          balances,
          constraints,
          prices,
          policy: session.policy,
        });

  if (!feasibility.feasible || !feasibility.market || !feasibility.underlying) {
    return {
      strategyType,
      status: "INFEASIBLE",
      amountRaw: null,
      boundRaw: feasibility.boundRaw.toString(),
      reasons: feasibility.reasons,
      plan: null,
      branches: [],
      probes: 0,
    };
  }

  const changeOnly = await evaluateChangeOnly(session);
  if (changeOnly.passed) {
    return {
      strategyType,
      status: "NOT_REQUIRED",
      amountRaw: "0",
      boundRaw: feasibility.boundRaw.toString(),
      reasons: ["POST_CHANGE_POLICY_PASSES", ...changeOnly.reasons],
      plan: null,
      branches: [],
      probes: 0,
    };
  }

  const allowance = await readAllowance({
    client: session.client,
    token: feasibility.underlying,
    wallet: session.wallet,
    spender: feasibility.market,
    blockNumber: session.anchor.blockNumber,
  });
  const collateralEnabled =
    session.positions.find(
      (position) => position.market.toLowerCase() === feasibility.market!.toLowerCase(),
    )?.collateralEnabled ?? false;

  const branches: StrategyBranchEvidence[] = [];
  const goal = session.policy.optimizationGoal;
  const candidates =
    goal === "MAX_SAFETY"
      ? [feasibility.boundRaw]
      : undefined;

  const makePlan = (amount: bigint) =>
    buildPlan({
      strategyType,
      feasibility,
      amount,
      allowance,
      collateralEnabled,
      policy: session.policy,
      comptroller: session.comptroller,
    });

  const testAmount = async (amount: bigint): Promise<boolean> => {
    const snapshot = await session.anvil.client.snapshot();
    try {
      const plan = makePlan(amount);
      const executed = await verifyExecutedPlan({
        adapter: session.adapter,
        client: session.client,
        anvil: session.anvil,
        comptroller: session.comptroller,
        wallet: session.wallet,
        plan,
        policy: session.policy,
        destination: {
          from: session.temporalGovernor,
          to: session.destination.to,
          data: session.destination.data,
          value: session.destination.value,
        },
      });
      const verified = executed.allSucceeded && executed.policyEvaluation.passed;
      branches.push({
        amountRaw: amount.toString(),
        status: verified ? "VERIFIED" : "REJECTED",
        reasons: executed.reasons,
        callSuccess: executed.calls.map((call) => call.success),
        liquidityRaw: executed.risk.liquidityRaw.toString(),
        shortfallRaw: executed.risk.shortfallRaw.toString(),
        safetyBufferBps: executed.risk.derived?.safetyBufferBps,
      });
      return verified;
    } finally {
      await session.anvil.client.revert({ id: snapshot });
    }
  };

  if (candidates) {
    const passed = await testAmount(candidates[0]!);
    return finalizeResult(
      strategyType,
      feasibility,
      passed ? candidates[0]! : null,
      branches,
      1,
      true,
      passed ? makePlan(candidates[0]!) : null,
    );
  }

  const search = await findMinimumPassingAmount({
    lo: 1n,
    hi: feasibility.boundRaw,
    maxProbes: session.maxProbes,
    test: testAmount,
  });
  return finalizeResult(
    strategyType,
    feasibility,
    search.amount,
    branches,
    search.probes.length,
    search.complete,
    search.amount !== null ? makePlan(search.amount) : null,
  );
}

function buildPlan(input: {
  strategyType: "REPAY_DEBT" | "ADD_COLLATERAL";
  feasibility: StrategyFeasibility;
  amount: bigint;
  allowance: bigint;
  collateralEnabled: boolean;
  policy: UserRiskPolicy;
  comptroller: Address;
}): TransactionPlan {
  const base = {
    wallet: "0x0000000000000000000000000000000000000001" as Address,
    market: input.feasibility.market!,
    underlying: input.feasibility.underlying!,
    amountRaw: input.amount,
    boundRaw: input.feasibility.boundRaw,
    allowanceRaw: input.allowance,
    collateralEnabled: input.collateralEnabled,
    policy: input.policy,
  };
  if (input.strategyType === "REPAY_DEBT") {
    return buildRepayPlan(base);
  }
  return buildAddCollateralPlan({ ...base, comptroller: input.comptroller });
}

function finalizeResult(
  strategyType: "REPAY_DEBT" | "ADD_COLLATERAL",
  feasibility: StrategyFeasibility,
  amount: bigint | null,
  branches: StrategyBranchEvidence[],
  probes: number,
  complete: boolean,
  plan: TransactionPlan | null,
): StrategySearchResult {
  if (!complete) {
    return {
      strategyType,
      status: "INCOMPLETE",
      amountRaw: amount?.toString() ?? null,
      boundRaw: feasibility.boundRaw.toString(),
      reasons: ["PROBE_BUDGET_EXHAUSTED"],
      plan: null,
      branches,
      probes,
    };
  }
  if (amount === null) {
    return {
      strategyType,
      status: "INFEASIBLE",
      amountRaw: null,
      boundRaw: feasibility.boundRaw.toString(),
      reasons: ["NO_AMOUNT_PASSES_POLICY", ...feasibility.reasons],
      plan: null,
      branches,
      probes,
    };
  }
  const verified = branches.find(
    (branch) => branch.amountRaw === amount.toString() && branch.status === "VERIFIED",
  );
  return {
    strategyType,
    status: verified ? "VERIFIED" : "REJECTED",
    amountRaw: amount.toString(),
    boundRaw: feasibility.boundRaw.toString(),
    reasons: verified?.reasons ?? ["AMOUNT_NOT_VERIFIED"],
    plan: verified ? plan : null,
    branches,
    probes,
  };
}
