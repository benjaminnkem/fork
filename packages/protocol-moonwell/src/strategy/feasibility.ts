import {
  erc20Abi,
  moonwellComptrollerAbi,
  moonwellMTokenAbi,
} from "@fork/abis";
import { minBound, parsePolicyMax, type StrategyFeasibility } from "@fork/strategy-engine";
import type { Address, ProtocolPosition, UserRiskPolicy } from "@fork/shared";
import { getAddress } from "viem";
import type { MoonwellMarket } from "../adapter.js";

export interface ConstraintReader {
  readContract: (args: object) => Promise<unknown>;
}

export interface MarketConstraints {
  mintPaused: boolean;
  supplyCapRaw: bigint;
  totalUnderlyingRaw: bigint;
  remainingSupplyRaw: bigint | null;
}

export async function readMarketConstraints(input: {
  client: ConstraintReader;
  comptroller: Address;
  market: Address;
  blockNumber?: bigint;
}): Promise<MarketConstraints> {
  const [mintPaused, supplyCapRaw, totalSupply, exchangeRate] = await Promise.all([
    input.client.readContract({
      address: input.comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "mintGuardianPaused",
      args: [input.market],
      blockNumber: input.blockNumber,
    }) as Promise<boolean>,
    input.client.readContract({
      address: input.comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "supplyCaps",
      args: [input.market],
      blockNumber: input.blockNumber,
    }) as Promise<bigint>,
    input.client.readContract({
      address: input.market,
      abi: moonwellMTokenAbi,
      functionName: "totalSupply",
      blockNumber: input.blockNumber,
    }) as Promise<bigint>,
    input.client.readContract({
      address: input.market,
      abi: moonwellMTokenAbi,
      functionName: "exchangeRateStored",
      blockNumber: input.blockNumber,
    }) as Promise<bigint>,
  ]);
  const totalUnderlyingRaw = (totalSupply * exchangeRate) / 10n ** 18n;
  const remainingSupplyRaw =
    supplyCapRaw === 0n
      ? null
      : supplyCapRaw > totalUnderlyingRaw
        ? supplyCapRaw - totalUnderlyingRaw
        : 0n;
  return { mintPaused, supplyCapRaw, totalUnderlyingRaw, remainingSupplyRaw };
}

export async function readTokenBalance(input: {
  client: ConstraintReader;
  token: Address;
  wallet: Address;
  blockNumber?: bigint;
}): Promise<bigint> {
  return input.client.readContract({
    address: input.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [input.wallet],
    blockNumber: input.blockNumber,
  }) as Promise<bigint>;
}

export async function readAllowance(input: {
  client: ConstraintReader;
  token: Address;
  wallet: Address;
  spender: Address;
  blockNumber?: bigint;
}): Promise<bigint> {
  return input.client.readContract({
    address: input.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [input.wallet, input.spender],
    blockNumber: input.blockNumber,
  }) as Promise<bigint>;
}

function usdValue(amount: bigint, price: bigint | undefined): bigint {
  if (!price || price <= 0n) return 0n;
  return (amount * price) / 10n ** 18n;
}

export function assessRepayFeasibility(input: {
  positions: ProtocolPosition[];
  balances: Map<string, bigint>;
  prices: Map<string, bigint>;
  policy: UserRiskPolicy;
}): StrategyFeasibility {
  if (!input.policy.allowRepayDebt) {
    return {
      feasible: false,
      strategyType: "REPAY_DEBT",
      boundRaw: 0n,
      reasons: ["POLICY_DISALLOWS_REPAY"],
    };
  }
  const debts = input.positions
    .filter((position) => position.borrowedRaw > 0n)
    .map((position) => {
      const balance = input.balances.get(position.underlying.toLowerCase()) ?? 0n;
      const max = parsePolicyMax(input.policy.maxRepayRawByAsset?.[position.underlying.toLowerCase()]);
      const bound = minBound([position.borrowedRaw, balance, max ?? position.borrowedRaw]);
      const price = input.prices.get(position.market.toLowerCase());
      return { position, bound, balance, usd: usdValue(bound, price) };
    })
    .filter((item) => item.bound > 0n)
    .sort((a, b) => (a.usd === b.usd ? 0 : a.usd > b.usd ? -1 : 1));

  const best = debts[0];
  if (!best) {
    return {
      feasible: false,
      strategyType: "REPAY_DEBT",
      boundRaw: 0n,
      reasons: ["NO_REPAY_ASSET_AT_ANCHOR"],
    };
  }
  return {
    feasible: true,
    strategyType: "REPAY_DEBT",
    market: asAddress(best.position.market),
    underlying: asAddress(best.position.underlying),
    boundRaw: best.bound,
    reasons: ["HAS_DEBT", "HAS_UNDERLYING_BALANCE"],
  };
}

export function assessAddCollateralFeasibility(input: {
  positions: ProtocolPosition[];
  markets: MoonwellMarket[];
  balances: Map<string, bigint>;
  constraints: Map<string, MarketConstraints>;
  prices: Map<string, bigint>;
  policy: UserRiskPolicy;
}): StrategyFeasibility {
  if (!input.policy.allowAddCollateral) {
    return {
      feasible: false,
      strategyType: "ADD_COLLATERAL",
      boundRaw: 0n,
      reasons: ["POLICY_DISALLOWS_ADD_COLLATERAL"],
    };
  }

  const entered = new Map(
    input.positions.map((position) => [position.market.toLowerCase(), position.collateralEnabled]),
  );
  const candidates: Array<{ market: MoonwellMarket; bound: bigint; usd: bigint; reasons: string[] }> =
    [];
  for (const market of input.markets) {
    if (!market.supported || !market.underlying || !market.listed) continue;
    const constraints = input.constraints.get(market.market.toLowerCase());
    if (!constraints || constraints.mintPaused) continue;
    const balance = input.balances.get(market.underlying.toLowerCase()) ?? 0n;
    if (balance <= 0n) continue;
    const max = parsePolicyMax(
      input.policy.maxCollateralRawByAsset?.[market.underlying.toLowerCase()],
    );
    const remaining = constraints.remainingSupplyRaw;
    const bound = minBound([balance, max ?? balance, remaining ?? balance]);
    if (bound <= 0n) continue;
    const reasons = ["HAS_WALLET_BALANCE", "MINT_NOT_PAUSED"];
    if (entered.get(market.market.toLowerCase())) reasons.push("ALREADY_COLLATERAL");
    const usd = usdValue(bound, input.prices.get(market.market.toLowerCase()));
    candidates.push({ market, bound, usd, reasons });
  }

  candidates.sort((a, b) => (a.usd === b.usd ? 0 : a.usd > b.usd ? -1 : 1));
  const best = candidates[0];
  if (!best || !best.market.underlying) {
    return {
      feasible: false,
      strategyType: "ADD_COLLATERAL",
      boundRaw: 0n,
      reasons: ["NO_MINTABLE_COLLATERAL_AT_ANCHOR"],
    };
  }
  return {
    feasible: true,
    strategyType: "ADD_COLLATERAL",
    market: asAddress(best.market.market),
    underlying: asAddress(best.market.underlying),
    boundRaw: best.bound,
    reasons: best.reasons,
  };
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}
