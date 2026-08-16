import type { Address, Hex, StrategyType } from "@fork/shared";

export const ALLOWLIST_ERC20_APPROVE_EXACT = "MOONWELL_ERC20_APPROVE_EXACT";
export const ALLOWLIST_ERC20_APPROVE_RESET = "MOONWELL_ERC20_APPROVE_RESET";
export const ALLOWLIST_MTOKEN_REPAY_BORROW = "MOONWELL_MTOKEN_REPAY_BORROW";
export const ALLOWLIST_MTOKEN_MINT = "MOONWELL_MTOKEN_MINT";
export const ALLOWLIST_ENTER_MARKETS = "MOONWELL_COMPTROLLER_ENTER_MARKETS";

export type StrategyStatus =
  | "VERIFIED"
  | "REJECTED"
  | "INFEASIBLE"
  | "NOT_REQUIRED"
  | "INCOMPLETE";

export interface PlannedCall {
  to: Address;
  value: bigint;
  data: Hex;
  description: string;
  allowlistRuleId: string;
}

export interface TransactionPlan {
  chainId: 8453;
  strategyType: StrategyType;
  market: Address;
  underlying: Address;
  amountRaw: bigint;
  calls: PlannedCall[];
  expectedState: {
    maxShortfallRaw: string;
    minSafetyBufferBps: number;
  };
}

export interface StrategyFeasibility {
  feasible: boolean;
  strategyType: StrategyType;
  market?: Address;
  underlying?: Address;
  boundRaw: bigint;
  reasons: string[];
}

export interface StrategyBranchEvidence {
  amountRaw: string;
  status: "VERIFIED" | "REJECTED";
  reasons: string[];
  callSuccess: boolean[];
  liquidityRaw: string;
  shortfallRaw: string;
  safetyBufferBps?: number;
}

export interface StrategySearchResult {
  strategyType: StrategyType;
  status: StrategyStatus;
  amountRaw: string | null;
  boundRaw: string;
  reasons: string[];
  plan: TransactionPlan | null;
  branches: StrategyBranchEvidence[];
  probes: number;
}
