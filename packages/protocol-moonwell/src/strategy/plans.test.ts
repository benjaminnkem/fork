import { describe, expect, it } from "vitest";
import { ForkError, RISK_POLICY_SCHEMA_VERSION, type Address } from "@fork/shared";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { ALLOWLIST_MTOKEN_MINT, ALLOWLIST_MTOKEN_REPAY_BORROW } from "@fork/strategy-engine";
import { buildAddCollateralPlan, buildRepayPlan } from "./plans.js";

const policy = createUserRiskPolicy({ minSafetyBufferBps: 0 });
const market = "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22" as Address;
const underlying = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const wallet = "0x494c7fdb753c15b69fea2293e1b76567ca94462d" as Address;
const comptroller = "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C" as Address;

describe("strategy plans", () => {
  it("rejects zero and over-bound amounts", () => {
    expect(() =>
      buildRepayPlan({
        wallet,
        market,
        underlying,
        amountRaw: 0n,
        boundRaw: 10n,
        allowanceRaw: 0n,
        collateralEnabled: true,
        policy,
      }),
    ).toThrow(ForkError);
    expect(() =>
      buildAddCollateralPlan({
        wallet,
        market,
        underlying,
        amountRaw: 11n,
        boundRaw: 10n,
        allowanceRaw: 0n,
        collateralEnabled: false,
        policy,
        comptroller,
      }),
    ).toThrow(ForkError);
  });

  it("builds exact-approval repay and mint plans", () => {
    const repay = buildRepayPlan({
      wallet,
      market,
      underlying,
      amountRaw: 5n,
      boundRaw: 10n,
      allowanceRaw: 0n,
      collateralEnabled: true,
      policy,
    });
    expect(repay.strategyType).toBe("REPAY_DEBT");
    expect(repay.calls.some((call) => call.allowlistRuleId === ALLOWLIST_MTOKEN_REPAY_BORROW)).toBe(
      true,
    );
    expect(repay.amountRaw).toBe(5n);

    const add = buildAddCollateralPlan({
      wallet,
      market,
      underlying,
      amountRaw: 5n,
      boundRaw: 10n,
      allowanceRaw: 0n,
      collateralEnabled: false,
      policy,
      comptroller,
    });
    expect(add.strategyType).toBe("ADD_COLLATERAL");
    expect(add.calls.some((call) => call.allowlistRuleId === ALLOWLIST_MTOKEN_MINT)).toBe(true);
    expect(add.calls).toHaveLength(3);
    expect(policy.policyVersion).toBe(RISK_POLICY_SCHEMA_VERSION);
  });
});
