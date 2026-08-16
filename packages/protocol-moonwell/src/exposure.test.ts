import { describe, expect, it } from "vitest";
import type { Address, BlockAnchor, ProtocolChange, ProtocolPosition } from "@fork/shared";
import { matchMoonwellExposure } from "./exposure.js";

const market = "0xfC41B49d064Ac646015b459C522820DB9472F4B5" as Address;
const otherMarket = "0x1111111111111111111111111111111111111111" as Address;
const underlying = "0x2222222222222222222222222222222222222222" as Address;
const wallet = "0x9eec3976435a37b0340ecbd966c226a691956b35" as Address;

const anchor: BlockAnchor = {
  chainId: 8453,
  blockNumber: 48025643n,
  blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
  timestamp: 1,
  finality: "historical",
  rpcProviderId: "test",
};

function position(partial: Partial<ProtocolPosition>): ProtocolPosition {
  return {
    protocol: "moonwell",
    chainId: 8453,
    wallet,
    market,
    underlying,
    suppliedRaw: 1n,
    borrowedRaw: 0n,
    collateralEnabled: true,
    metadata: {},
    anchor,
    ...partial,
  };
}

function change(partial: Partial<ProtocolChange> = {}): ProtocolChange {
  return {
    id: "moonwell:eth:176",
    protocol: "moonwell",
    sourceChainId: 1,
    destinationChainId: 8453,
    status: "EXECUTED",
    type: "COLLATERAL_FACTOR_CHANGE",
    proposalId: "176",
    sourceTxHashes: [],
    targetCalls: [],
    affectedMarkets: [market],
    affectedAssets: [underlying],
    discoveredAt: new Date(0),
    updatedAt: new Date(0),
    evidence: [
      {
        type: "CONTRACT_CALL",
        chainId: 1,
        method: "getProposalData",
      },
    ],
    supportLevel: "DESTINATION_EFFECT_REPLAY",
    ...partial,
  };
}

describe("matchMoonwellExposure", () => {
  it("matches CF exposure only when the market is supplied as collateral", () => {
    const result = matchMoonwellExposure([position({})], change());
    expect(result.relevant).toBe(true);
    expect(result.severityHint).toBe("HIGH");
    expect(result.rationaleCodes).toEqual([
      "MARKET_MATCH",
      "COLLATERAL_ENABLED",
      "SUPPLY_EXPOSURE",
    ]);
    expect(result.matchedMarkets).toEqual([market]);
    expect(result.evidence.some((item) => item.method === "getAccountSnapshot")).toBe(true);
  });

  it("rejects CF overlap without collateral supply", () => {
    const result = matchMoonwellExposure(
      [position({ collateralEnabled: false }), position({ suppliedRaw: 0n, borrowedRaw: 5n })],
      change(),
    );
    expect(result.relevant).toBe(false);
    expect(result.rationaleCodes).toContain("CF_REQUIRES_COLLATERAL_SUPPLY");
    expect(result.matchedMarkets).toContain(market);
  });

  it("returns no overlap for an unrelated market", () => {
    const result = matchMoonwellExposure(
      [position({ market: otherMarket, underlying: otherMarket })],
      change(),
    );
    expect(result.relevant).toBe(false);
    expect(result.rationaleCodes).toEqual(["NO_MARKET_OR_ASSET_OVERLAP"]);
  });

  it("treats unsupported overlapping change types as relevant without guessing severity", () => {
    const result = matchMoonwellExposure(
      [position({})],
      change({ type: "UNKNOWN" }),
    );
    expect(result.relevant).toBe(true);
    expect(result.severityHint).toBe("MEDIUM");
    expect(result.rationaleCodes).toEqual(["MARKET_MATCH", "UNSUPPORTED_CHANGE_TYPE"]);
  });
});
