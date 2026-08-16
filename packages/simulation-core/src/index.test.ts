import { describe, expect, it } from "vitest";
import { hashReceipt, SIMULATION_RECEIPT_SCHEMA_VERSION, type SimulationReceipt } from "./receipt.js";

describe("simulation-core", () => {
  it("hashes receipts deterministically", () => {
    const receipt = {
      receiptSchemaVersion: SIMULATION_RECEIPT_SCHEMA_VERSION,
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      proposalId: "176",
      wallet: "0x9eec3976435a37b0340ecbd966c226a691956b35",
      chainId: 8453,
      fork: {
        chainId: 8453,
        blockNumber: 1n,
        blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
        timestamp: 1,
        finality: "historical",
        rpcProviderId: "anvil-fork",
      },
      impersonations: [],
      timeJumps: [],
      calls: [],
      before: {
        collateralFactorMantissa: "1",
        risk: {
          wallet: "0x9eec3976435a37b0340ecbd966c226a691956b35",
          protocol: "moonwell",
          anchor: {
            chainId: 8453,
            blockNumber: 1n,
            blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
            timestamp: 1,
            finality: "historical",
            rpcProviderId: "anvil-fork",
          },
          liquidityRaw: 2n,
          shortfallRaw: 0n,
          status: "SAFE",
          evidence: [],
        },
      },
      after: {
        collateralFactorMantissa: "1",
        risk: {
          wallet: "0x9eec3976435a37b0340ecbd966c226a691956b35",
          protocol: "moonwell",
          anchor: {
            chainId: 8453,
            blockNumber: 1n,
            blockHash: "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc",
            timestamp: 1,
            finality: "historical",
            rpcProviderId: "anvil-fork",
          },
          liquidityRaw: 1n,
          shortfallRaw: 0n,
          status: "SAFE",
          evidence: [],
        },
      },
      liquidityDeltaRaw: "-1",
    } as SimulationReceipt;
    expect(hashReceipt(receipt)).toBe(hashReceipt(receipt));
    expect(hashReceipt(receipt).startsWith("0x")).toBe(true);
  });
});
