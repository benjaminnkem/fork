import {
  RISK_POLICY_SCHEMA_VERSION,
  type OptimizationGoal,
  type RiskState,
  type UserRiskPolicy,
} from "@fork/shared";

export interface PolicyEvaluation {
  passed: boolean;
  reasons: string[];
  evaluatedAtStatus: RiskState["status"];
  minSafetyBufferBps: number;
}

export interface CreateUserRiskPolicyInput {
  minSafetyBufferBps?: number;
  envMinSafetyBufferBps?: number;
  optimizationGoal?: OptimizationGoal;
  allowRepayDebt?: boolean;
  allowAddCollateral?: boolean;
  maxRepayRawByAsset?: Record<string, string>;
  maxCollateralRawByAsset?: Record<string, string>;
}

export function createUserRiskPolicy(input: CreateUserRiskPolicyInput = {}): UserRiskPolicy {
  let minSafetyBufferBps = 0;
  let minSafetyBufferBpsSource: UserRiskPolicy["minSafetyBufferBpsSource"] = "NO_ADDITIONAL_BUFFER";
  if (input.minSafetyBufferBps !== undefined) {
    minSafetyBufferBps = input.minSafetyBufferBps;
    minSafetyBufferBpsSource = "EXPLICIT";
  } else if (input.envMinSafetyBufferBps !== undefined) {
    minSafetyBufferBps = input.envMinSafetyBufferBps;
    minSafetyBufferBpsSource = "ENV";
  }

  return {
    policyVersion: RISK_POLICY_SCHEMA_VERSION,
    minSafetyBufferBps,
    minSafetyBufferBpsSource,
    optimizationGoal: input.optimizationGoal ?? "MIN_CAPITAL",
    allowRepayDebt: input.allowRepayDebt ?? true,
    allowAddCollateral: input.allowAddCollateral ?? true,
    maxRepayRawByAsset: input.maxRepayRawByAsset,
    maxCollateralRawByAsset: input.maxCollateralRawByAsset,
  };
}

export function evaluatePolicy(state: RiskState, policy: UserRiskPolicy): PolicyEvaluation {
  const reasons: string[] = [];
  if (state.status === "UNKNOWN") {
    reasons.push("UNKNOWN_STATUS");
  }
  if (state.status === "SHORTFALL") {
    reasons.push("SHORTFALL");
  }
  if (policy.minSafetyBufferBps > 0 && state.derived?.usd?.borrowValueRaw !== "0") {
    const buffer = state.derived?.safetyBufferBps;
    if (buffer === undefined) {
      reasons.push("SAFETY_BUFFER_UNAVAILABLE");
    } else if (buffer < policy.minSafetyBufferBps) {
      reasons.push("SAFETY_BUFFER_BELOW_MINIMUM");
    }
  }

  return {
    passed: reasons.length === 0,
    reasons: reasons.length === 0 ? ["POLICY_PASSED"] : reasons,
    evaluatedAtStatus: state.status,
    minSafetyBufferBps: policy.minSafetyBufferBps,
  };
}

export function policyPasses(state: RiskState, policy: UserRiskPolicy): boolean {
  return evaluatePolicy(state, policy).passed;
}
