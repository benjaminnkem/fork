import {
  erc20Abi,
  moonwellComptrollerAbi,
  moonwellMTokenAbi,
} from "@fork/abis";
import {
  ALLOWLIST_ENTER_MARKETS,
  ALLOWLIST_ERC20_APPROVE_EXACT,
  ALLOWLIST_ERC20_APPROVE_RESET,
  ALLOWLIST_MTOKEN_MINT,
  ALLOWLIST_MTOKEN_REPAY_BORROW,
  assertPositiveAmount,
  type PlannedCall,
  type TransactionPlan,
} from "@fork/strategy-engine";
import { BASE_CHAIN_ID, type Address, type Hex, type UserRiskPolicy } from "@fork/shared";
import { encodeFunctionData, getAddress } from "viem";

export interface BuildPlanInput {
  wallet: Address;
  market: Address;
  underlying: Address;
  amountRaw: bigint;
  boundRaw: bigint;
  allowanceRaw: bigint;
  collateralEnabled: boolean;
  policy: UserRiskPolicy;
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

function approveCalls(input: BuildPlanInput): PlannedCall[] {
  const calls: PlannedCall[] = [];
  if (input.allowanceRaw >= input.amountRaw) return calls;
  if (input.allowanceRaw > 0n) {
    calls.push({
      to: input.underlying,
      value: 0n,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [input.market, 0n],
      }) as Hex,
      description: "reset existing ERC20 allowance to zero",
      allowlistRuleId: ALLOWLIST_ERC20_APPROVE_RESET,
    });
  }
  calls.push({
    to: input.underlying,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [input.market, input.amountRaw],
    }) as Hex,
    description: "approve exact underlying amount",
    allowlistRuleId: ALLOWLIST_ERC20_APPROVE_EXACT,
  });
  return calls;
}

export function buildRepayPlan(input: BuildPlanInput): TransactionPlan {
  assertPositiveAmount(input.amountRaw, input.boundRaw);
  const market = asAddress(input.market);
  const underlying = asAddress(input.underlying);
  const calls = [
    ...approveCalls({ ...input, market, underlying }),
    {
      to: market,
      value: 0n,
      data: encodeFunctionData({
        abi: moonwellMTokenAbi,
        functionName: "repayBorrow",
        args: [input.amountRaw],
      }) as Hex,
      description: "repay Moonwell borrow",
      allowlistRuleId: ALLOWLIST_MTOKEN_REPAY_BORROW,
    },
  ];
  return {
    chainId: BASE_CHAIN_ID,
    strategyType: "REPAY_DEBT",
    market,
    underlying,
    amountRaw: input.amountRaw,
    calls,
    expectedState: {
      maxShortfallRaw: "0",
      minSafetyBufferBps: input.policy.minSafetyBufferBps,
    },
  };
}

export function buildAddCollateralPlan(input: BuildPlanInput & { comptroller: Address }): TransactionPlan {
  assertPositiveAmount(input.amountRaw, input.boundRaw);
  const market = asAddress(input.market);
  const underlying = asAddress(input.underlying);
  const comptroller = asAddress(input.comptroller);
  const calls = [
    ...approveCalls({ ...input, market, underlying }),
    {
      to: market,
      value: 0n,
      data: encodeFunctionData({
        abi: moonwellMTokenAbi,
        functionName: "mint",
        args: [input.amountRaw],
      }) as Hex,
      description: "mint Moonwell mTokens",
      allowlistRuleId: ALLOWLIST_MTOKEN_MINT,
    },
  ];
  if (!input.collateralEnabled) {
    calls.push({
      to: comptroller,
      value: 0n,
      data: encodeFunctionData({
        abi: moonwellComptrollerAbi,
        functionName: "enterMarkets",
        args: [[market]],
      }) as Hex,
      description: "enter market as collateral",
      allowlistRuleId: ALLOWLIST_ENTER_MARKETS,
    });
  }
  return {
    chainId: BASE_CHAIN_ID,
    strategyType: "ADD_COLLATERAL",
    market,
    underlying,
    amountRaw: input.amountRaw,
    calls,
    expectedState: {
      maxShortfallRaw: "0",
      minSafetyBufferBps: input.policy.minSafetyBufferBps,
    },
  };
}
