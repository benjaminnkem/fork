import { canonicalizeJson } from "@fork/blockchain";
import type {
  Address,
  BlockAnchor,
  EvidenceRef,
  ExposureResult,
  Hex,
  ReplaySupportLevel,
  RiskState,
  UserRiskPolicy,
} from "@fork/shared";
import { keccak256, stringToBytes } from "viem";
import type { ImpersonationRecord, SimulatedCallRecord } from "./actions.js";
import type { MaterialRiskAssessment, PolicyEvaluation } from "@fork/risk-engine";

export const SIMULATION_RECEIPT_SCHEMA_VERSION = "1";

export interface CanonicalGovernanceCall {
  destinationChainId: number;
  target: Address;
  valueRaw: string;
  calldata: Hex;
  selector: Hex;
  decoded?: {
    functionName: string;
    args: unknown[];
    abiSource: string;
  };
}

export interface ReceiptProvenance {
  comptroller: Address;
  temporalGovernor: Address;
  market: Address;
  comptrollerCodeHash: Hex | null;
  marketCodeHash: Hex | null;
  temporalGovernorCodeHash: Hex | null;
}

export interface ReceiptRunEvidence {
  simulatedTxHashes: Array<Hex | null>;
  afterBlockNumber: string;
  afterBlockHash: Hex | null;
  completedAt: string;
}

export interface SimulationReceipt {
  receiptSchemaVersion: string;
  engineVersion: string;
  replayGrade: ReplaySupportLevel;
  proposalId: string;
  changeId: string;
  wallet: Address;
  chainId: number;
  fork: BlockAnchor;
  policy: UserRiskPolicy;
  policyEvaluation: PolicyEvaluation;
  exposure: ExposureResult;
  impersonations: ImpersonationRecord[];
  timeJumps: unknown[];
  targetCalls: CanonicalGovernanceCall[];
  calls: SimulatedCallRecord[];
  before: {
    collateralFactorMantissa: string;
    risk: RiskState;
  };
  after: {
    collateralFactorMantissa: string;
    risk: RiskState;
  };
  liquidityDeltaRaw: string;
  materialRisk: MaterialRiskAssessment;
  provenance: ReceiptProvenance;
  runEvidence: ReceiptRunEvidence;
  evidence: EvidenceRef[];
}

export interface ReceiptFieldDiff {
  path: string;
  expected: unknown;
  actual: unknown;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function sortedLower(values: string[]): string[] {
  return [...values].map(normalizeAddress).sort();
}

export function receiptHashBody(receipt: SimulationReceipt): Record<string, unknown> {
  return {
    receiptSchemaVersion: receipt.receiptSchemaVersion,
    engineVersion: receipt.engineVersion,
    replayGrade: receipt.replayGrade,
    proposalId: receipt.proposalId,
    changeId: receipt.changeId,
    wallet: normalizeAddress(receipt.wallet),
    chainId: receipt.chainId,
    fork: {
      chainId: receipt.fork.chainId,
      blockNumber: receipt.fork.blockNumber.toString(),
      blockHash: normalizeAddress(receipt.fork.blockHash),
    },
    targetCalls: receipt.targetCalls.map((call) => ({
      destinationChainId: call.destinationChainId,
      target: normalizeAddress(call.target),
      valueRaw: call.valueRaw,
      calldata: call.calldata.toLowerCase(),
      selector: call.selector.toLowerCase(),
    })),
    impersonations: receipt.impersonations.map((item) => ({
      account: normalizeAddress(item.account),
      reason: item.reason,
    })),
    timeJumps: receipt.timeJumps,
    before: {
      collateralFactorMantissa: receipt.before.collateralFactorMantissa,
      liquidityRaw: receipt.before.risk.liquidityRaw.toString(),
      shortfallRaw: receipt.before.risk.shortfallRaw.toString(),
      status: receipt.before.risk.status,
    },
    after: {
      collateralFactorMantissa: receipt.after.collateralFactorMantissa,
      liquidityRaw: receipt.after.risk.liquidityRaw.toString(),
      shortfallRaw: receipt.after.risk.shortfallRaw.toString(),
      status: receipt.after.risk.status,
    },
    liquidityDeltaRaw: receipt.liquidityDeltaRaw,
    exposure: {
      relevant: receipt.exposure.relevant,
      severityHint: receipt.exposure.severityHint,
      matchedMarkets: sortedLower(receipt.exposure.matchedMarkets),
      matchedAssets: sortedLower(receipt.exposure.matchedAssets),
      rationaleCodes: [...receipt.exposure.rationaleCodes].sort(),
    },
    materialRisk: {
      classification: receipt.materialRisk.classification,
      liquidityDropBps: receipt.materialRisk.liquidityDropBps,
      liquidityDeltaRaw: receipt.materialRisk.liquidityDeltaRaw,
      shortfallDeltaRaw: receipt.materialRisk.shortfallDeltaRaw,
    },
    policy: {
      policyVersion: receipt.policy.policyVersion,
      minSafetyBufferBps: receipt.policy.minSafetyBufferBps,
      minSafetyBufferBpsSource: receipt.policy.minSafetyBufferBpsSource,
    },
    policyEvaluation: {
      passed: receipt.policyEvaluation.passed,
      reasons: [...receipt.policyEvaluation.reasons].sort(),
    },
    provenance: {
      comptroller: normalizeAddress(receipt.provenance.comptroller),
      temporalGovernor: normalizeAddress(receipt.provenance.temporalGovernor),
      market: normalizeAddress(receipt.provenance.market),
      comptrollerCodeHash: receipt.provenance.comptrollerCodeHash,
      marketCodeHash: receipt.provenance.marketCodeHash,
      temporalGovernorCodeHash: receipt.provenance.temporalGovernorCodeHash,
    },
  };
}

export function canonicalizeReceipt(receipt: SimulationReceipt): string {
  return canonicalizeJson(receiptHashBody(receipt));
}

export function hashReceipt(receipt: SimulationReceipt): `0x${string}` {
  return keccak256(stringToBytes(canonicalizeReceipt(receipt)));
}

export function simulationIdempotencyKey(input: {
  wallet: string;
  changeId: string;
  forkBlockHash: string;
  policyVersion: string;
  engineVersion: string;
}): string {
  return [
    normalizeAddress(input.wallet),
    input.changeId,
    normalizeAddress(input.forkBlockHash),
    input.policyVersion,
    input.engineVersion,
  ].join(":");
}

function asString(value: unknown): string | undefined {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  return undefined;
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "bigint") return current.toString();
  return current;
}

const CORE_COMPARE_PATHS = [
  "receiptSchemaVersion",
  "replayGrade",
  "proposalId",
  "wallet",
  "chainId",
  "fork.blockNumber",
  "fork.blockHash",
  "before.collateralFactorMantissa",
  "after.collateralFactorMantissa",
  "before.risk.liquidityRaw",
  "after.risk.liquidityRaw",
  "before.risk.shortfallRaw",
  "after.risk.shortfallRaw",
  "before.risk.status",
  "after.risk.status",
  "liquidityDeltaRaw",
] as const;

const PHASE5_COMPARE_PATHS = [
  "exposure.relevant",
  "exposure.severityHint",
  "materialRisk.classification",
  "materialRisk.liquidityDropBps",
  "policy.policyVersion",
  "policy.minSafetyBufferBps",
  "policyEvaluation.passed",
] as const;

function isPhase5Receipt(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.exposure && record.materialRisk && record.policy);
}

function comparable(value: unknown, path: string): unknown {
  if (path === "wallet" || path === "fork.blockHash") {
    const text = asString(value);
    return text?.toLowerCase();
  }
  if (
    path.endsWith("liquidityRaw") ||
    path.endsWith("shortfallRaw") ||
    path.endsWith("blockNumber") ||
    path.endsWith("collateralFactorMantissa") ||
    path.endsWith("liquidityDeltaRaw") ||
    path.endsWith("liquidityDropBps") ||
    path.endsWith("minSafetyBufferBps")
  ) {
    return asString(value);
  }
  return value;
}

export function compareEconomicReceipts(
  expected: unknown,
  actual: unknown,
): { match: boolean; diffs: ReceiptFieldDiff[] } {
  const diffs: ReceiptFieldDiff[] = [];
  const paths = isPhase5Receipt(expected)
    ? [...CORE_COMPARE_PATHS, ...PHASE5_COMPARE_PATHS]
    : [...CORE_COMPARE_PATHS];
  for (const path of paths) {
    const leftRaw = readPath(expected, path);
    const rightRaw = readPath(actual, path);
    if (leftRaw === undefined && rightRaw === undefined) continue;
    const left = comparable(leftRaw, path);
    const right = comparable(rightRaw, path);
    if (left !== right) {
      diffs.push({ path, expected: left, actual: right });
    }
  }

  const expectedCalls = readPath(expected, "targetCalls");
  const actualCalls = readPath(actual, "targetCalls");
  if (Array.isArray(expectedCalls) && Array.isArray(actualCalls)) {
    const left = expectedCalls.map((call) => {
      const record = call as Record<string, unknown>;
      return `${asString(record.target)?.toLowerCase()}:${asString(record.calldata)?.toLowerCase()}:${asString(record.valueRaw) ?? "0"}`;
    });
    const right = actualCalls.map((call) => {
      const record = call as Record<string, unknown>;
      return `${asString(record.target)?.toLowerCase()}:${asString(record.calldata)?.toLowerCase()}:${asString(record.valueRaw) ?? "0"}`;
    });
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push({ path: "targetCalls", expected: left, actual: right });
    }
  }

  return { match: diffs.length === 0, diffs };
}
