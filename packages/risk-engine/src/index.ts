import type { RiskState, UserRiskPolicy } from "@fork/shared";

export function classifyRisk(liquidityRaw: bigint, shortfallRaw: bigint): RiskState["status"] {
  if (shortfallRaw > 0n) return "SHORTFALL";
  if (liquidityRaw === 0n) return "AT_RISK";
  return "SAFE";
}

export function classifyComptrollerLiquidity(
  error: bigint,
  liquidityRaw: bigint,
  shortfallRaw: bigint,
): RiskState["status"] {
  if (error !== 0n) return "UNKNOWN";
  return classifyRisk(liquidityRaw, shortfallRaw);
}

export function policyPasses(state: Pick<RiskState, "status">, policy: UserRiskPolicy): boolean {
  void policy;
  return state.status !== "SHORTFALL";
}
