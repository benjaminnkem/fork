import { describe, expect, it } from "vitest";
import { RISK_POLICY_SCHEMA_VERSION, type Address } from "@fork/shared";
import {
  compareEconomicReceipts,
  hashReceipt,
  SIMULATION_RECEIPT_SCHEMA_VERSION,
  impactSimulationJobId,
  simulationIdempotencyKey,
  type SimulationReceipt,
} from "./receipt.js";

const wallet = "0x9eec3976435a37b0340ecbd966c226a691956b35" as Address;
const forkHash = "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc" as const;

function receipt(overrides: Partial<SimulationReceipt> = {}): SimulationReceipt {
  const base: SimulationReceipt = {
    receiptSchemaVersion: SIMULATION_RECEIPT_SCHEMA_VERSION,
    engineVersion: "dev",
    replayGrade: "DESTINATION_EFFECT_REPLAY",
    proposalId: "176",
    changeId: "moonwell:eth:176",
    wallet,
    chainId: 8453,
    fork: {
      chainId: 8453,
      blockNumber: 48025643n,
      blockHash: forkHash,
      timestamp: 1,
      finality: "historical",
      rpcProviderId: "anvil-fork",
    },
    policy: {
      policyVersion: RISK_POLICY_SCHEMA_VERSION,
      minSafetyBufferBps: 0,
      minSafetyBufferBpsSource: "NO_ADDITIONAL_BUFFER",
      optimizationGoal: "MIN_CAPITAL",
      allowRepayDebt: true,
      allowAddCollateral: true,
    },
    policyEvaluation: {
      passed: true,
      reasons: ["POLICY_PASSED"],
      evaluatedAtStatus: "SAFE",
      minSafetyBufferBps: 0,
    },
    exposure: {
      relevant: true,
      severityHint: "HIGH",
      matchedMarkets: ["0xfC41B49d064Ac646015b459C522820DB9472F4B5"],
      matchedAssets: ["0x1111111111111111111111111111111111111111"],
      rationaleCodes: ["MARKET_MATCH", "COLLATERAL_ENABLED", "SUPPLY_EXPOSURE"],
      evidence: [],
    },
    impersonations: [
      {
        account: "0x8b621804a7637b781e2BbD58e256a591F2dF7d51",
        reason: "DESTINATION_EFFECT_REPLAY authorized Temporal Governor",
        fundedWei: "10000000000000000000",
      },
    ],
    timeJumps: [],
    targetCalls: [
      {
        destinationChainId: 8453,
        target: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",
        valueRaw: "0",
        calldata: "0xe4028eee",
        selector: "0xe4028eee",
      },
    ],
    calls: [
      {
        to: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",
        data: "0xe4028eee",
        value: "0",
        from: "0x8b621804a7637b781e2BbD58e256a591F2dF7d51",
        hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        success: true,
      },
    ],
    before: {
      collateralFactorMantissa: "680000000000000000",
      risk: {
        wallet,
        protocol: "moonwell",
        anchor: {
          chainId: 8453,
          blockNumber: 48025643n,
          blockHash: forkHash,
          timestamp: 1,
          finality: "historical",
          rpcProviderId: "anvil-fork",
        },
        liquidityRaw: 100n,
        shortfallRaw: 0n,
        status: "SAFE",
        evidence: [],
      },
    },
    after: {
      collateralFactorMantissa: "520000000000000000",
      risk: {
        wallet,
        protocol: "moonwell",
        anchor: {
          chainId: 8453,
          blockNumber: 48025644n,
          blockHash: "0x76af174fa79a4cf9cd8a78a57c7bf2776c254ebd39f01ab5576a66ffc777416c",
          timestamp: 2,
          finality: "latest",
          rpcProviderId: "anvil-fork",
        },
        liquidityRaw: 40n,
        shortfallRaw: 0n,
        status: "SAFE",
        evidence: [],
      },
    },
    liquidityDeltaRaw: "-60",
    materialRisk: {
      classification: "LIQUIDITY_REDUCED",
      liquidityDropBps: "6000",
      liquidityDeltaRaw: "-60",
      shortfallDeltaRaw: "0",
      beforeStatus: "SAFE",
      afterStatus: "SAFE",
    },
    provenance: {
      comptroller: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",
      temporalGovernor: "0x8b621804a7637b781e2BbD58e256a591F2dF7d51",
      market: "0xfC41B49d064Ac646015b459C522820DB9472F4B5",
      comptrollerCodeHash: "0xaaa",
      marketCodeHash: "0xbbb",
      temporalGovernorCodeHash: "0xccc",
    },
    runEvidence: {
      simulatedTxHashes: ["0x1111111111111111111111111111111111111111111111111111111111111111"],
      afterBlockNumber: "48025644",
      afterBlockHash: "0x76af174fa79a4cf9cd8a78a57c7bf2776c254ebd39f01ab5576a66ffc777416c",
      completedAt: "2026-08-16T00:00:00.000Z",
    },
    evidence: [],
  };
  return { ...base, ...overrides };
}

describe("simulation-core receipts", () => {
  it("hashes the economic body independently of Anvil run fields", () => {
    const a = receipt();
    const b = receipt({
      calls: [
        {
          ...a.calls[0]!,
          hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        },
      ],
      runEvidence: {
        ...a.runEvidence,
        simulatedTxHashes: ["0x2222222222222222222222222222222222222222222222222222222222222222"],
        afterBlockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
        completedAt: "2026-08-16T00:00:01.000Z",
      },
      after: {
        ...a.after,
        risk: {
          ...a.after.risk,
          anchor: {
            ...a.after.risk.anchor,
            blockHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
          },
        },
      },
    });
    expect(hashReceipt(a)).toBe(hashReceipt(b));
    expect(hashReceipt(a).startsWith("0x")).toBe(true);
  });

  it("changes the hash when liquidity changes", () => {
    const a = receipt();
    const b = receipt({
      after: {
        ...a.after,
        risk: { ...a.after.risk, liquidityRaw: 39n },
      },
      liquidityDeltaRaw: "-61",
    });
    expect(hashReceipt(a)).not.toBe(hashReceipt(b));
  });

  it("compares economic fields and ignores post-tx hashes", () => {
    const stored = receipt();
    const replayed = receipt({
      calls: [{ ...stored.calls[0]!, hash: "0xdead" }],
      runEvidence: {
        ...stored.runEvidence,
        simulatedTxHashes: ["0xdead"],
        afterBlockHash: "0xbeef",
      },
    });
    expect(compareEconomicReceipts(stored, replayed).match).toBe(true);

    const mismatch = receipt({
      after: {
        ...stored.after,
        collateralFactorMantissa: "1",
      },
    });
    const result = compareEconomicReceipts(stored, mismatch);
    expect(result.match).toBe(false);
    expect(result.diffs.some((diff) => diff.path === "after.collateralFactorMantissa")).toBe(true);
  });

  it("compares Phase 4 preliminary receipts on economic fields only", () => {
    const stored = {
      receiptSchemaVersion: "1",
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      proposalId: "176",
      wallet,
      chainId: 8453,
      fork: {
        chainId: 8453,
        blockNumber: "48025643",
        blockHash: forkHash,
      },
      before: {
        collateralFactorMantissa: "680000000000000000",
        risk: { liquidityRaw: "100", shortfallRaw: "0", status: "SAFE" },
      },
      after: {
        collateralFactorMantissa: "520000000000000000",
        risk: { liquidityRaw: "40", shortfallRaw: "0", status: "SAFE" },
      },
      liquidityDeltaRaw: "-60",
    };
    expect(compareEconomicReceipts(stored, receipt()).match).toBe(true);
  });

  it("builds a stable idempotency key", () => {
    expect(
      simulationIdempotencyKey({
        wallet,
        changeId: "moonwell:eth:176",
        forkBlockHash: forkHash,
        policyVersion: "1",
        engineVersion: "dev",
      }),
    ).toBe(
      `0x9eec3976435a37b0340ecbd966c226a691956b35:moonwell:eth:176:${forkHash}:1:dev`,
    );
  });

  it("builds a colon-free BullMQ job id from the idempotency key", () => {
    const key = simulationIdempotencyKey({
      wallet,
      changeId: "moonwell:eth:176",
      forkBlockHash: forkHash,
      policyVersion: "1",
      engineVersion: "dev",
    });
    const jobId = impactSimulationJobId(key);
    expect(jobId).not.toContain(":");
    expect(jobId).toContain("moonwell-eth-176");
  });
});
