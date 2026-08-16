import { ForkError, type StrategyType } from "@fork/shared";

export const V1_STRATEGY_TYPES: StrategyType[] = ["REPAY_DEBT", "ADD_COLLATERAL"];

export function optimizeStrategy(type: StrategyType): never {
  void type;
  throw new ForkError("NOT_IMPLEMENTED", "Deterministic rescue search is Phase 6");
}
