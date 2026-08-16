import type { RiskState, UserRiskPolicy } from "@fork/shared";

export function classifyRisk(liquidityRaw: bigint, shortfallRaw: bigint): RiskState["status"] {
  if (shortfallRaw > 0n) return "SHORTFALL";
  if (liquidityRaw === 0n) return "AT_RISK";
  return "SAFE";
}

export function policyPasses(state: Pick<RiskState, "status">, policy: UserRiskPolicy): boolean {
  void policy;
  return state.status !== "SHORTFALL";
}
