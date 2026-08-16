import type { RiskState } from "@fork/shared";

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

export {
  createUserRiskPolicy,
  evaluatePolicy,
  policyPasses,
  type CreateUserRiskPolicyInput,
  type PolicyEvaluation,
} from "./policy.js";
export {
  assessMaterialRisk,
  liquidityDropBps,
  type MaterialRiskAssessment,
  type MaterialRiskClassification,
} from "./material.js";
export { computeSafetyBufferBps } from "./buffer.js";
