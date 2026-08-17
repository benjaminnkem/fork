import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { ForkError } from "@fork/shared";
import { buildRepayPlan } from "@fork/protocol-moonwell";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { assertAllowlistedPlan } from "./allowlist.js";

const market = getAddress("0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22");
const underlying = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const wallet = getAddress("0x494c7fdb753c15b69fea2293e1b76567ca94462d");

describe("assertAllowlistedPlan", () => {
  it("accepts an adapter-built repay plan", () => {
    const plan = buildRepayPlan({
      wallet,
      market,
      underlying,
      amountRaw: 100n,
      boundRaw: 1000n,
      allowanceRaw: 0n,
      collateralEnabled: true,
      policy: createUserRiskPolicy(),
    });
    const decoded = assertAllowlistedPlan(plan);
    expect(decoded.some((call) => call.functionName === "approve")).toBe(true);
    expect(decoded.some((call) => call.functionName === "repayBorrow")).toBe(true);
    expect(decoded.every((call) => call.spender === undefined || call.spender === market)).toBe(true);
  });

  it("rejects unlimited approvals", () => {
    const plan = buildRepayPlan({
      wallet,
      market,
      underlying,
      amountRaw: (1n << 256n) - 1n,
      boundRaw: (1n << 256n) - 1n,
      allowanceRaw: 0n,
      collateralEnabled: true,
      policy: createUserRiskPolicy(),
    });
    expect(() => assertAllowlistedPlan(plan)).toThrow(/Unlimited approvals/);
  });

  it("rejects arbitrary calldata", () => {
    const plan = buildRepayPlan({
      wallet,
      market,
      underlying,
      amountRaw: 100n,
      boundRaw: 1000n,
      allowanceRaw: 100n,
      collateralEnabled: true,
      policy: createUserRiskPolicy(),
    });
    plan.calls[0]!.data = "0xdeadbeef";
    expect(() => assertAllowlistedPlan(plan)).toThrow(ForkError);
  });
});
