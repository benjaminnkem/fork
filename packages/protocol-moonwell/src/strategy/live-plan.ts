import type { ForkChainClient } from "@fork/blockchain";
import { getBlockAnchor } from "@fork/blockchain";
import type { TransactionPlan } from "@fork/strategy-engine";
import {
  ForkError,
  type Address,
  type ProtocolPosition,
  type RiskState,
  type StrategyType,
  type UserRiskPolicy,
} from "@fork/shared";
import { createMoonwellAdapter, getMoonwellBaseComptroller } from "../adapter.js";
import {
  assessAddCollateralFeasibility,
  assessRepayFeasibility,
  readAllowance,
  readMarketConstraints,
  readTokenBalance,
} from "./feasibility.js";
import { readOraclePrices } from "./oracle.js";
import { buildAddCollateralPlan, buildRepayPlan } from "./plans.js";

export async function buildLiveAllowlistedPlan(input: {
  forkClient: ForkChainClient;
  wallet: Address;
  strategyType: StrategyType;
  policy: UserRiskPolicy;
  preferredAmountRaw?: bigint;
}): Promise<{
  plan: TransactionPlan;
  risk: RiskState;
  positions: ProtocolPosition[];
  amountRaw: bigint;
}> {
  const adapter = createMoonwellAdapter(input.forkClient);
  const anchor = await getBlockAnchor(input.forkClient, "safe");
  const [positions, risk, markets] = await Promise.all([
    adapter.getUserPositions(input.wallet, anchor),
    adapter.getRiskState(input.wallet, anchor),
    adapter.listMarkets(anchor),
  ]);
  const client = {
    readContract: (args: object) => input.forkClient.client.readContract(args as never),
  };
  const balances = new Map<string, bigint>();
  const tokens = new Set<string>();
  for (const position of positions) tokens.add(position.underlying.toLowerCase());
  for (const market of markets) {
    if (market.underlying) tokens.add(market.underlying.toLowerCase());
  }
  for (const token of tokens) {
    balances.set(
      token,
      await readTokenBalance({
        client,
        token: token as Address,
        wallet: input.wallet,
        blockNumber: anchor.blockNumber,
      }),
    );
  }
  const comptroller = getMoonwellBaseComptroller() as Address;
  const prices = await readOraclePrices({
    client,
    comptroller,
    markets: markets.map((market) => market.market),
    blockNumber: anchor.blockNumber,
  });
  let market: Address | undefined;
  let underlying: Address | undefined;
  let boundRaw = 0n;
  let collateralEnabled = false;

  if (input.strategyType === "REPAY_DEBT") {
    const feasibility = assessRepayFeasibility({
      positions,
      balances,
      prices,
      policy: input.policy,
    });
    if (!feasibility.feasible || !feasibility.market || !feasibility.underlying) {
      throw new ForkError("NO_FEASIBLE_STRATEGY", feasibility.reasons.join(", ") || "Repay is infeasible");
    }
    market = feasibility.market;
    underlying = feasibility.underlying;
    boundRaw = feasibility.boundRaw;
    collateralEnabled = Boolean(
      positions.find((position) => position.market.toLowerCase() === market!.toLowerCase())
        ?.collateralEnabled,
    );
  } else {
    const constraints = new Map();
    for (const listed of markets) {
      constraints.set(
        listed.market.toLowerCase(),
        await readMarketConstraints({
          client,
          comptroller,
          market: listed.market,
          blockNumber: anchor.blockNumber,
        }),
      );
    }
    const feasibility = assessAddCollateralFeasibility({
      positions,
      markets,
      balances,
      constraints,
      prices,
      policy: input.policy,
    });
    if (!feasibility.feasible || !feasibility.market || !feasibility.underlying) {
      throw new ForkError(
        "NO_FEASIBLE_STRATEGY",
        feasibility.reasons.join(", ") || "Add collateral is infeasible",
      );
    }
    market = feasibility.market;
    underlying = feasibility.underlying;
    boundRaw = feasibility.boundRaw;
    collateralEnabled = Boolean(
      positions.find((position) => position.market.toLowerCase() === market!.toLowerCase())
        ?.collateralEnabled,
    );
  }

  const amountRaw =
    input.preferredAmountRaw && input.preferredAmountRaw > 0n && input.preferredAmountRaw <= boundRaw
      ? input.preferredAmountRaw
      : boundRaw;
  const allowanceRaw = await readAllowance({
    client,
    token: underlying,
    wallet: input.wallet,
    spender: market,
    blockNumber: anchor.blockNumber,
  });
  const planInput = {
    wallet: input.wallet,
    market,
    underlying,
    amountRaw,
    boundRaw,
    allowanceRaw,
    collateralEnabled,
    policy: input.policy,
  };
  const plan =
    input.strategyType === "REPAY_DEBT"
      ? buildRepayPlan(planInput)
      : buildAddCollateralPlan({ ...planInput, comptroller });
  return { plan, risk, positions, amountRaw };
}
