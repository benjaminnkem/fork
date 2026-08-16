import { describe, expect, it } from "vitest";
import { RISK_POLICY_SCHEMA_VERSION, type RiskState } from "@fork/shared";
import {
  assessMaterialRisk,
  classifyComptrollerLiquidity,
  classifyRisk,
  computeSafetyBufferBps,
  createUserRiskPolicy,
  evaluatePolicy,
  liquidityDropBps,
  policyPasses,
} from "./index.js";

function state(partial: Pick<RiskState, "liquidityRaw" | "shortfallRaw" | "status">): RiskState {
  return {
    wallet: "0x9eec3976435a37b0340ecbd966c226a691956b35",
    protocol: "moonwell",
    anchor: {
      chainId: 8453,
      blockNumber: 1n,
      blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
      timestamp: 1,
      finality: "historical",
      rpcProviderId: "test",
    },
    evidence: [],
    ...partial,
  };
}

describe("risk-engine", () => {
  it("classifies shortfall from canonical integers", () => {
    expect(classifyRisk(0n, 1n)).toBe("SHORTFALL");
    expect(classifyRisk(10n, 0n)).toBe("SAFE");
  });

  it("returns UNKNOWN when Comptroller error is nonzero", () => {
    expect(classifyComptrollerLiquidity(1n, 10n, 0n)).toBe("UNKNOWN");
    expect(classifyComptrollerLiquidity(0n, 0n, 1n)).toBe("SHORTFALL");
  });

  it("versions policy and does not invent a safety-buffer default", () => {
    const unset = createUserRiskPolicy();
    expect(unset.policyVersion).toBe(RISK_POLICY_SCHEMA_VERSION);
    expect(unset.minSafetyBufferBps).toBe(0);
    expect(unset.minSafetyBufferBpsSource).toBe("NO_ADDITIONAL_BUFFER");

    const env = createUserRiskPolicy({ envMinSafetyBufferBps: 250 });
    expect(env.minSafetyBufferBps).toBe(250);
    expect(env.minSafetyBufferBpsSource).toBe("ENV");

    const explicit = createUserRiskPolicy({
      minSafetyBufferBps: 100,
      envMinSafetyBufferBps: 250,
    });
    expect(explicit.minSafetyBufferBps).toBe(100);
    expect(explicit.minSafetyBufferBpsSource).toBe("EXPLICIT");
  });

  it("fails closed on shortfall, unknown status, and missing buffer when required", () => {
    const noBuffer = createUserRiskPolicy();
    expect(policyPasses(state({ liquidityRaw: 1n, shortfallRaw: 0n, status: "SAFE" }), noBuffer)).toBe(
      true,
    );
    expect(policyPasses(state({ liquidityRaw: 0n, shortfallRaw: 0n, status: "AT_RISK" }), noBuffer)).toBe(
      true,
    );
    expect(
      policyPasses(state({ liquidityRaw: 0n, shortfallRaw: 1n, status: "SHORTFALL" }), noBuffer),
    ).toBe(false);
    expect(
      policyPasses(state({ liquidityRaw: 1n, shortfallRaw: 0n, status: "UNKNOWN" }), noBuffer),
    ).toBe(false);

    const required = createUserRiskPolicy({ minSafetyBufferBps: 100 });
    const missing = evaluatePolicy(
      state({ liquidityRaw: 5n, shortfallRaw: 0n, status: "SAFE" }),
      required,
    );
    expect(missing.passed).toBe(false);
    expect(missing.reasons).toContain("SAFETY_BUFFER_UNAVAILABLE");

    const below = evaluatePolicy(
      {
        ...state({ liquidityRaw: 5n, shortfallRaw: 0n, status: "SAFE" }),
        derived: { safetyBufferBps: 50 },
      },
      required,
    );
    expect(below.passed).toBe(false);
    expect(below.reasons).toContain("SAFETY_BUFFER_BELOW_MINIMUM");

    const ok = evaluatePolicy(
      {
        ...state({ liquidityRaw: 5n, shortfallRaw: 0n, status: "SAFE" }),
        derived: { safetyBufferBps: 100 },
      },
      required,
    );
    expect(ok.passed).toBe(true);
  });

  it("computes floored liquidity-drop bps without floats", () => {
    expect(liquidityDropBps(100n, 80n)).toBe("2000");
    expect(liquidityDropBps(3n, 1n)).toBe("6666");
    expect(liquidityDropBps(10n, 10n)).toBe("0");
    expect(liquidityDropBps(0n, 0n)).toBeNull();
  });

  it("classifies material risk from before/after Comptroller state", () => {
    const before = state({ liquidityRaw: 100n, shortfallRaw: 0n, status: "SAFE" });
    const reduced = assessMaterialRisk(
      before,
      state({ liquidityRaw: 40n, shortfallRaw: 0n, status: "SAFE" }),
    );
    expect(reduced.classification).toBe("LIQUIDITY_REDUCED");
    expect(reduced.liquidityDropBps).toBe("6000");
    expect(reduced.liquidityDeltaRaw).toBe("-60");

    const created = assessMaterialRisk(
      before,
      state({ liquidityRaw: 0n, shortfallRaw: 2n, status: "SHORTFALL" }),
    );
    expect(created.classification).toBe("SHORTFALL_CREATED");

    const improved = assessMaterialRisk(
      state({ liquidityRaw: 10n, shortfallRaw: 0n, status: "SAFE" }),
      state({ liquidityRaw: 12n, shortfallRaw: 0n, status: "SAFE" }),
    );
    expect(improved.classification).toBe("IMPROVED");
  });

  it("computes safety buffer bps from liquidity and oracle-priced borrows", () => {
    expect(computeSafetyBufferBps(100n, 0n)).toBeUndefined();
    expect(computeSafetyBufferBps(0n, 10n)).toBe(0);
    expect(computeSafetyBufferBps(50n, 100n)).toBe(5000);
    expect(computeSafetyBufferBps(1n, 3n)).toBe(3333);
  });

  it("treats a required buffer as passed when there is no borrow value", () => {
    const required = createUserRiskPolicy({ minSafetyBufferBps: 100 });
    const noBorrow = {
      ...state({ liquidityRaw: 5n, shortfallRaw: 0n, status: "SAFE" as const }),
      derived: { usd: { borrowValueRaw: "0" } },
    };
    expect(policyPasses(noBorrow, required)).toBe(true);
  });
});
