import type { RiskState } from "@fork/shared";

export type MaterialRiskClassification =
  | "IMPROVED"
  | "UNCHANGED"
  | "LIQUIDITY_REDUCED"
  | "SHORTFALL_INCREASED"
  | "SHORTFALL_CREATED";

export interface MaterialRiskAssessment {
  classification: MaterialRiskClassification;
  liquidityDropBps: string | null;
  liquidityDeltaRaw: string;
  shortfallDeltaRaw: string;
  beforeStatus: RiskState["status"];
  afterStatus: RiskState["status"];
}

export function liquidityDropBps(beforeLiquidityRaw: bigint, afterLiquidityRaw: bigint): string | null {
  if (beforeLiquidityRaw <= 0n) {
    return null;
  }
  if (afterLiquidityRaw >= beforeLiquidityRaw) {
    return "0";
  }
  return ((beforeLiquidityRaw - afterLiquidityRaw) * 10000n / beforeLiquidityRaw).toString();
}

export function assessMaterialRisk(before: RiskState, after: RiskState): MaterialRiskAssessment {
  const liquidityDelta = after.liquidityRaw - before.liquidityRaw;
  const shortfallDelta = after.shortfallRaw - before.shortfallRaw;

  let classification: MaterialRiskClassification = "UNCHANGED";
  if (before.status !== "SHORTFALL" && after.status === "SHORTFALL") {
    classification = "SHORTFALL_CREATED";
  } else if (shortfallDelta > 0n) {
    classification = "SHORTFALL_INCREASED";
  } else if (liquidityDelta < 0n) {
    classification = "LIQUIDITY_REDUCED";
  } else if (liquidityDelta > 0n || shortfallDelta < 0n) {
    classification = "IMPROVED";
  }

  return {
    classification,
    liquidityDropBps: liquidityDropBps(before.liquidityRaw, after.liquidityRaw),
    liquidityDeltaRaw: liquidityDelta.toString(),
    shortfallDeltaRaw: shortfallDelta.toString(),
    beforeStatus: before.status,
    afterStatus: after.status,
  };
}
