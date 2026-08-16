import type { StrategyType } from "@fork/shared";

export const V1_STRATEGY_TYPES: StrategyType[] = ["REPAY_DEBT", "ADD_COLLATERAL"];

export {
  ALLOWLIST_ENTER_MARKETS,
  ALLOWLIST_ERC20_APPROVE_EXACT,
  ALLOWLIST_ERC20_APPROVE_RESET,
  ALLOWLIST_MTOKEN_MINT,
  ALLOWLIST_MTOKEN_REPAY_BORROW,
  type PlannedCall,
  type StrategyBranchEvidence,
  type StrategyFeasibility,
  type StrategySearchResult,
  type StrategyStatus,
  type TransactionPlan,
} from "./types.js";
export { assertPositiveAmount, minBound, parsePolicyMax } from "./amounts.js";
export { findMinimumPassingAmount, type BinarySearchInput, type BinarySearchOutput } from "./search.js";
