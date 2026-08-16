import { Schema } from "mongoose";
import { COLLECTION_INDEXES } from "./indexes.js";

const mixed = Schema.Types.Mixed;

export const walletSchema = new Schema(
  {
    chainId: { type: Number, required: true },
    address: { type: String, required: true, lowercase: true },
    monitoringEnabled: { type: Boolean, required: true, default: false },
    ownerAuth: { type: mixed },
  },
  { collection: "wallets", timestamps: true },
);

export const walletRiskPolicySchema = new Schema(
  {
    wallet: { type: String, required: true, lowercase: true },
    policyVersion: { type: String, required: true },
    version: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true },
    minSafetyBufferBps: { type: Number, required: true },
    minSafetyBufferBpsSource: { type: String, required: true },
    optimizationGoal: { type: String, required: true },
    allowRepayDebt: { type: Boolean, required: true },
    allowAddCollateral: { type: Boolean, required: true },
    maxRepayRawByAsset: { type: mixed },
    maxCollateralRawByAsset: { type: mixed },
  },
  { collection: "walletRiskPolicies", timestamps: true },
);

export const positionSnapshotSchema = new Schema(
  {
    wallet: { type: String, required: true, lowercase: true },
    protocol: { type: String, required: true },
    anchor: {
      chainId: { type: Number, required: true },
      blockNumber: { type: String, required: true },
      blockHash: { type: String, required: true },
    },
    positions: { type: mixed, required: true },
    riskState: { type: mixed, required: true },
    capturedAt: { type: Date, required: true },
  },
  { collection: "positionSnapshots", timestamps: true },
);

export const governanceRawEventSchema = new Schema(
  {
    id: { type: String, required: true },
    chainId: { type: Number, required: true },
    sourceId: { type: String, required: true },
    blockNumber: { type: String, required: true },
    blockHash: { type: String, required: true },
    txHash: { type: String },
    logIndex: { type: Number },
    topic0: { type: String },
    raw: { type: mixed, required: true },
    decoded: { type: mixed },
  },
  { collection: "governanceRawEvents", timestamps: true },
);

export const protocolChangeSchema = new Schema(
  {
    id: { type: String, required: true },
    protocol: { type: String, required: true },
    sourceChainId: { type: Number, required: true },
    destinationChainId: { type: Number, required: true },
    status: { type: String, required: true },
    type: { type: String, required: true },
    proposalId: { type: String },
    sourceTxHashes: { type: [String], default: [] },
    destinationTxHashes: { type: [String], default: [] },
    targetCalls: { type: mixed, required: true },
    affectedMarkets: { type: [String], default: [] },
    affectedAssets: { type: [String], default: [] },
    earliestExecutionAt: { type: Date },
    latestExecutionAt: { type: Date },
    supportLevel: { type: String, required: true },
    evidence: { type: mixed, required: true },
  },
  { collection: "protocolChanges", timestamps: true },
);

export const exposureSchema = new Schema(
  {
    wallet: { type: String, required: true, lowercase: true },
    protocolChangeId: { type: String, required: true },
    relevant: { type: Boolean, required: true },
    severityHint: { type: String, required: true },
    matchedMarkets: { type: [String], default: [] },
    matchedAssets: { type: [String], default: [] },
    rationaleCodes: { type: [String], default: [] },
    evidence: { type: mixed, required: true },
  },
  { collection: "exposures", timestamps: true },
);

export const simulationRunSchema = new Schema(
  {
    wallet: { type: String, required: true, lowercase: true },
    protocolChangeId: { type: String, required: true },
    mode: { type: String, required: true },
    status: { type: String, required: true },
    replayGrade: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    engineVersion: { type: String, required: true },
    policyVersion: { type: String, required: true },
    forkBlockNumber: { type: String, required: true },
    forkBlockHash: { type: String, required: true },
    receiptHash: { type: String },
    before: { type: mixed },
    after: { type: mixed },
    errorCode: { type: String },
    scenario: { type: String },
    includeStrategies: { type: Boolean, default: false },
    events: {
      type: [
        {
          id: { type: String, required: true },
          type: { type: String, required: true },
          at: { type: Date, required: true },
          data: { type: mixed },
        },
      ],
      default: [],
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { collection: "simulationRuns", timestamps: true },
);

export const simulationBranchSchema = new Schema(
  {
    runId: { type: String, required: true },
    strategy: { type: String, required: true },
    parameters: { type: mixed, required: true },
    txEvidence: { type: mixed },
    postState: { type: mixed },
    verification: { type: mixed },
    status: { type: String, required: true },
  },
  { collection: "simulationBranches", timestamps: true },
);

export const evidenceSchema = new Schema(
  {
    type: { type: String, required: true },
    chainId: { type: Number, required: true },
    blockNumber: { type: String },
    blockHash: { type: String },
    txHash: { type: String },
    address: { type: String },
    method: { type: String },
    rawHash: { type: String },
    simulationRunId: { type: String },
    receiptHash: { type: String },
  },
  { collection: "evidence", timestamps: true },
);

export const receiptSchema = new Schema(
  {
    receiptHash: { type: String, required: true },
    receiptSchemaVersion: { type: String, required: true },
    engineVersion: { type: String, required: true },
    wallet: { type: String, required: true, lowercase: true },
    protocolChangeId: { type: String, required: true },
    proposalId: { type: String },
    forkBlockNumber: { type: String, required: true },
    forkBlockHash: { type: String, required: true },
    replayGrade: { type: String, required: true },
    body: { type: mixed, required: true },
  },
  { collection: "receipts", timestamps: true },
);

export const agentRunSchema = new Schema(
  {
    simulationRunId: { type: String, required: true },
    status: { type: String, required: true },
    plannerModel: { type: String },
    fallbackModel: { type: String },
  },
  { collection: "agentRuns", timestamps: true },
);

export const agentTraceEventSchema = new Schema(
  {
    runId: { type: String, required: true },
    sequence: { type: Number, required: true },
    type: { type: String, required: true },
    payload: { type: mixed, required: true },
  },
  { collection: "agentTraceEvents", timestamps: true },
);

export const executionAttemptSchema = new Schema(
  {
    wallet: { type: String, required: true, lowercase: true },
    planHash: { type: String, required: true },
    txHashes: { type: [String], default: [] },
    expectedState: { type: mixed },
    actualState: { type: mixed },
    status: { type: String, required: true },
  },
  { collection: "executionAttempts", timestamps: true },
);

export const MONGO_SCHEMAS = {
  wallets: walletSchema,
  walletRiskPolicies: walletRiskPolicySchema,
  positionSnapshots: positionSnapshotSchema,
  governanceRawEvents: governanceRawEventSchema,
  protocolChanges: protocolChangeSchema,
  exposures: exposureSchema,
  simulationRuns: simulationRunSchema,
  simulationBranches: simulationBranchSchema,
  evidence: evidenceSchema,
  receipts: receiptSchema,
  agentRuns: agentRunSchema,
  agentTraceEvents: agentTraceEventSchema,
  executionAttempts: executionAttemptSchema,
} as const;

export type PersistenceCollection = keyof typeof MONGO_SCHEMAS;

export function applyDeclaredIndexes(): void {
  const grouped = new Map<string, typeof COLLECTION_INDEXES>();
  for (const spec of COLLECTION_INDEXES) {
    const list = grouped.get(spec.collection) ?? [];
    list.push(spec);
    grouped.set(spec.collection, list);
  }
  for (const [collection, specs] of grouped) {
    const schema = MONGO_SCHEMAS[collection as PersistenceCollection];
    if (!schema) {
      throw new Error(`No schema registered for collection ${collection}`);
    }
    for (const spec of specs) {
      schema.index(spec.keys, {
        name: spec.name,
        unique: spec.unique ?? false,
        ...(spec.expireAfterSeconds !== undefined
          ? { expireAfterSeconds: spec.expireAfterSeconds }
          : {}),
      });
    }
  }
}

applyDeclaredIndexes();
