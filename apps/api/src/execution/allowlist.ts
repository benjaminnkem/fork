import { erc20Abi, moonwellComptrollerAbi, moonwellMTokenAbi } from "@fork/abis";
import {
  ALLOWLIST_ENTER_MARKETS,
  ALLOWLIST_ERC20_APPROVE_EXACT,
  ALLOWLIST_ERC20_APPROVE_RESET,
  ALLOWLIST_MTOKEN_MINT,
  ALLOWLIST_MTOKEN_REPAY_BORROW,
  type PlannedCall,
  type TransactionPlan,
} from "@fork/strategy-engine";
import { BASE_CHAIN_ID, ForkError, type Address, type Hex } from "@fork/shared";
import { decodeFunctionData, getAddress } from "viem";

export interface DecodedPlannedCall {
  to: Address;
  value: string;
  data: Hex;
  description: string;
  allowlistRuleId: string;
  functionName: string;
  args: unknown[];
  spender?: Address;
  amountRaw?: string;
}

const ALLOWED_RULES = new Set([
  ALLOWLIST_ERC20_APPROVE_EXACT,
  ALLOWLIST_ERC20_APPROVE_RESET,
  ALLOWLIST_MTOKEN_REPAY_BORROW,
  ALLOWLIST_MTOKEN_MINT,
  ALLOWLIST_ENTER_MARKETS,
]);

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

function decodeOrReject(abi: readonly unknown[], data: Hex) {
  try {
    return decodeFunctionData({ abi, data });
  } catch {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Calldata is not an allowlisted function");
  }
}

export function decodePlannedCall(call: PlannedCall, plan: TransactionPlan): DecodedPlannedCall {
  if (!ALLOWED_RULES.has(call.allowlistRuleId)) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", `Unknown allowlist rule ${call.allowlistRuleId}`);
  }
  if (call.value !== 0n) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Execution calls must have zero value");
  }
  if (plan.chainId !== BASE_CHAIN_ID) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Execution is only allowed on Base 8453");
  }

  if (
    call.allowlistRuleId === ALLOWLIST_ERC20_APPROVE_EXACT ||
    call.allowlistRuleId === ALLOWLIST_ERC20_APPROVE_RESET
  ) {
    const decoded = decodeOrReject(erc20Abi, call.data);
    if (decoded.functionName !== "approve") {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Approval call must be ERC20 approve");
    }
    const [spender, amount] = decoded.args as [Address, bigint];
    if (asAddress(spender) !== asAddress(plan.market)) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Approval spender must be the mToken market");
    }
    if (asAddress(call.to) !== asAddress(plan.underlying)) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Approval target must be the underlying token");
    }
    if (call.allowlistRuleId === ALLOWLIST_ERC20_APPROVE_RESET && amount !== 0n) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Reset approval must be zero");
    }
    if (call.allowlistRuleId === ALLOWLIST_ERC20_APPROVE_EXACT && amount !== plan.amountRaw) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Exact approval must match the plan amount");
    }
    return {
      to: asAddress(call.to),
      value: "0",
      data: call.data,
      description: call.description,
      allowlistRuleId: call.allowlistRuleId,
      functionName: "approve",
      args: [asAddress(spender), amount.toString()],
      spender: asAddress(spender),
      amountRaw: amount.toString(),
    };
  }

  if (call.allowlistRuleId === ALLOWLIST_MTOKEN_REPAY_BORROW) {
    const decoded = decodeOrReject(moonwellMTokenAbi, call.data);
    if (decoded.functionName !== "repayBorrow") {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Repay call must be repayBorrow");
    }
    const [amount] = decoded.args as [bigint];
    if (asAddress(call.to) !== asAddress(plan.market)) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Repay target must be the borrowed market");
    }
    if (amount !== plan.amountRaw) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Repay amount must match the plan");
    }
    return {
      to: asAddress(call.to),
      value: "0",
      data: call.data,
      description: call.description,
      allowlistRuleId: call.allowlistRuleId,
      functionName: "repayBorrow",
      args: [amount.toString()],
      amountRaw: amount.toString(),
    };
  }

  if (call.allowlistRuleId === ALLOWLIST_MTOKEN_MINT) {
    const decoded = decodeOrReject(moonwellMTokenAbi, call.data);
    if (decoded.functionName !== "mint") {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Collateral call must be mint");
    }
    const [amount] = decoded.args as [bigint];
    if (asAddress(call.to) !== asAddress(plan.market)) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Mint target must be the collateral market");
    }
    if (amount !== plan.amountRaw) {
      throw new ForkError("STRATEGY_POLICY_REJECTED", "Mint amount must match the plan");
    }
    return {
      to: asAddress(call.to),
      value: "0",
      data: call.data,
      description: call.description,
      allowlistRuleId: call.allowlistRuleId,
      functionName: "mint",
      args: [amount.toString()],
      amountRaw: amount.toString(),
    };
  }

  const decoded = decodeOrReject(moonwellComptrollerAbi, call.data);
  if (decoded.functionName !== "enterMarkets") {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Comptroller call must be enterMarkets");
  }
  const [markets] = decoded.args as [Address[]];
  if (markets.length !== 1 || asAddress(markets[0]!) !== asAddress(plan.market)) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "enterMarkets must include only the plan market");
  }
  return {
    to: asAddress(call.to),
    value: "0",
    data: call.data,
    description: call.description,
    allowlistRuleId: call.allowlistRuleId,
    functionName: "enterMarkets",
    args: [markets.map((item) => asAddress(item))],
  };
}

export function assertAllowlistedPlan(plan: TransactionPlan): DecodedPlannedCall[] {
  if (plan.strategyType !== "REPAY_DEBT" && plan.strategyType !== "ADD_COLLATERAL") {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Only REPAY_DEBT and ADD_COLLATERAL are executable");
  }
  if (plan.amountRaw <= 0n) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Plan amount must be positive");
  }
  if (plan.calls.length === 0) {
    throw new ForkError("STRATEGY_POLICY_REJECTED", "Plan has no calls");
  }
  return plan.calls.map((call) => decodePlannedCall(call, plan));
}
