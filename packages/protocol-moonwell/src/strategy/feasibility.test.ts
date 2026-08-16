import { describe, expect, it } from "vitest";
import { createUserRiskPolicy } from "@fork/risk-engine";
import type { Address, ProtocolPosition } from "@fork/shared";
import { assessAddCollateralFeasibility, assessRepayFeasibility } from "./feasibility.js";
import type { MoonwellMarket } from "../adapter.js";

const market = "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22" as Address;
const underlying = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const wallet = "0x494c7fdb753c15b69fea2293e1b76567ca94462d" as Address;
const anchor = {
  chainId: 8453 as const,
  blockNumber: 1n,
  blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc" as const,
  timestamp: 1,
  finality: "historical" as const,
  rpcProviderId: "test",
};

const position: ProtocolPosition = {
  protocol: "moonwell",
  chainId: 8453,
  wallet,
  market,
  underlying,
  suppliedRaw: 0n,
  borrowedRaw: 100n,
  collateralEnabled: true,
  metadata: {},
  anchor,
};

const listed: MoonwellMarket = {
  market,
  underlying,
  listed: true,
  collateralFactorMantissa: 1n,
  supported: true,
};

describe("strategy feasibility", () => {
  it("marks repay infeasible without a matching wallet balance", () => {
    const result = assessRepayFeasibility({
      positions: [position],
      balances: new Map(),
      prices: new Map([[market.toLowerCase(), 10n ** 30n]]),
      policy: createUserRiskPolicy(),
    });
    expect(result.feasible).toBe(false);
    expect(result.reasons).toContain("NO_REPAY_ASSET_AT_ANCHOR");
  });

  it("marks repay feasible when debt and balance overlap", () => {
    const result = assessRepayFeasibility({
      positions: [position],
      balances: new Map([[underlying.toLowerCase(), 40n]]),
      prices: new Map([[market.toLowerCase(), 10n ** 30n]]),
      policy: createUserRiskPolicy(),
    });
    expect(result.feasible).toBe(true);
    expect(result.boundRaw).toBe(40n);
  });

  it("rejects add-collateral when mint is paused", () => {
    const result = assessAddCollateralFeasibility({
      positions: [],
      markets: [listed],
      balances: new Map([[underlying.toLowerCase(), 50n]]),
      constraints: new Map([
        [
          market.toLowerCase(),
          { mintPaused: true, supplyCapRaw: 0n, totalUnderlyingRaw: 0n, remainingSupplyRaw: null },
        ],
      ]),
      prices: new Map([[market.toLowerCase(), 10n ** 30n]]),
      policy: createUserRiskPolicy(),
    });
    expect(result.feasible).toBe(false);
  });

  it("accepts add-collateral when mint is open and the wallet holds the asset", () => {
    const result = assessAddCollateralFeasibility({
      positions: [],
      markets: [listed],
      balances: new Map([[underlying.toLowerCase(), 50n]]),
      constraints: new Map([
        [
          market.toLowerCase(),
          { mintPaused: false, supplyCapRaw: 0n, totalUnderlyingRaw: 0n, remainingSupplyRaw: null },
        ],
      ]),
      prices: new Map([[market.toLowerCase(), 10n ** 30n]]),
      policy: createUserRiskPolicy(),
    });
    expect(result.feasible).toBe(true);
    expect(result.boundRaw).toBe(50n);
  });

  it("prefers the mintable asset with the higher oracle USD bound", () => {
    const dustMarket = "0x73902f619CEB9B31FD8EFecf435CbDf89E369Ba6" as Address;
    const dustUnderlying = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as Address;
    const result = assessAddCollateralFeasibility({
      positions: [],
      markets: [
        listed,
        {
          ...listed,
          market: dustMarket,
          underlying: dustUnderlying,
        },
      ],
      balances: new Map([
        [underlying.toLowerCase(), 50n],
        [dustUnderlying.toLowerCase(), 10n ** 18n],
      ]),
      constraints: new Map([
        [
          market.toLowerCase(),
          { mintPaused: false, supplyCapRaw: 0n, totalUnderlyingRaw: 0n, remainingSupplyRaw: null },
        ],
        [
          dustMarket.toLowerCase(),
          { mintPaused: false, supplyCapRaw: 0n, totalUnderlyingRaw: 0n, remainingSupplyRaw: null },
        ],
      ]),
      prices: new Map([
        [market.toLowerCase(), 10n ** 30n],
        [dustMarket.toLowerCase(), 1n],
      ]),
      policy: createUserRiskPolicy(),
    });
    expect(result.market).toBe(market);
    expect(result.boundRaw).toBe(50n);
  });
});
