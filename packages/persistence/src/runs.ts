import { randomUUID } from "node:crypto";
import type { PersistenceModels } from "./connect.js";

export const SIMULATION_EVENT_TYPES = [
  "SIMULATION_QUEUED",
  "FORK_STARTING",
  "FORK_READY",
  "BASELINE_CAPTURED",
  "CHANGE_REPLAY_STARTED",
  "CHANGE_REPLAY_COMPLETED",
  "RISK_MEASURED",
  "AGENT_STARTED",
  "STRATEGY_OPTIMIZATION_STARTED",
  "STRATEGY_BRANCH_RESULT",
  "RECOMMENDATION_READY",
  "PROOF_READY",
  "FAILED",
  "CANCELLED",
] as const;

export type SimulationEventType = (typeof SIMULATION_EVENT_TYPES)[number];

export interface SimulationEvent {
  id: string;
  type: SimulationEventType;
  at: Date;
  data?: Record<string, unknown>;
}

export interface SimulationRunRecord {
  id: string;
  wallet: string;
  protocolChangeId: string;
  mode: string;
  status: string;
  replayGrade: string;
  idempotencyKey: string;
  engineVersion: string;
  policyVersion: string;
  forkBlockNumber: string;
  forkBlockHash: string;
  scenario?: string;
  includeStrategies?: boolean;
  receiptHash?: string;
  before?: unknown;
  after?: unknown;
  errorCode?: string;
  events: SimulationEvent[];
  startedAt?: Date;
  completedAt?: Date;
}

export function createEvent(
  type: SimulationEventType,
  data?: Record<string, unknown>,
): SimulationEvent {
  return { id: randomUUID(), type, at: new Date(), data };
}

export async function insertSimulationRun(
  models: PersistenceModels,
  run: Omit<SimulationRunRecord, "events" | "id"> & { events?: SimulationEvent[] },
): Promise<SimulationRunRecord> {
  const created = await models.simulationRuns.create({
    ...run,
    events: run.events ?? [],
  });
  return toRun(created.toObject());
}

export async function findRunById(
  models: PersistenceModels,
  id: string,
): Promise<SimulationRunRecord | undefined> {
  const doc = await models.simulationRuns.findById(id).lean();
  return doc ? toRun(doc) : undefined;
}

export async function findOpenRunsByChange(
  models: PersistenceModels,
  protocolChangeId: string,
): Promise<SimulationRunRecord[]> {
  const docs = await models.simulationRuns
    .find({ protocolChangeId, status: { $in: ["QUEUED", "RUNNING"] } })
    .lean();
  return (docs as Record<string, unknown>[]).map((doc) => toRun(doc));
}

export async function findRunByIdempotencyKey(
  models: PersistenceModels,
  idempotencyKey: string,
): Promise<SimulationRunRecord | undefined> {
  const doc = await models.simulationRuns.findOne({ idempotencyKey }).lean();
  return doc ? toRun(doc) : undefined;
}

export async function requeueSimulationRun(
  models: PersistenceModels,
  id: string,
  patch?: { includeStrategies?: boolean },
): Promise<SimulationRunRecord | undefined> {
  const queued = createEvent("SIMULATION_QUEUED");
  const doc = await models.simulationRuns
    .findByIdAndUpdate(
      id,
      {
        $set: {
          status: "QUEUED",
          ...(patch?.includeStrategies !== undefined
            ? { includeStrategies: patch.includeStrategies }
            : {}),
        },
        $unset: {
          receiptHash: 1,
          before: 1,
          after: 1,
          errorCode: 1,
          startedAt: 1,
          completedAt: 1,
        },
        $push: { events: queued },
      },
      { returnDocument: "after" },
    )
    .lean();
  return doc ? toRun(doc) : undefined;
}

export async function appendRunEvent(
  models: PersistenceModels,
  id: string,
  event: SimulationEvent,
  patch?: Record<string, unknown>,
): Promise<SimulationRunRecord | undefined> {
  const doc = await models.simulationRuns
    .findByIdAndUpdate(
      id,
      { $push: { events: event }, $set: patch ?? {} },
      { returnDocument: "after" },
    )
    .lean();
  return doc ? toRun(doc) : undefined;
}

export async function saveReceipt(
  models: PersistenceModels,
  input: {
    receiptHash: string;
    receiptSchemaVersion: string;
    engineVersion: string;
    wallet: string;
    protocolChangeId: string;
    proposalId?: string;
    forkBlockNumber: string;
    forkBlockHash: string;
    replayGrade: string;
    body: unknown;
  },
): Promise<void> {
  await models.receipts.updateOne(
    { receiptHash: input.receiptHash },
    { $setOnInsert: input },
    { upsert: true },
  );
}

export async function findReceiptByHash(
  models: PersistenceModels,
  receiptHash: string,
): Promise<Record<string, unknown> | undefined> {
  const doc = await models.receipts.findOne({ receiptHash }).lean();
  return doc ? (doc as Record<string, unknown>) : undefined;
}

function toRun(doc: Record<string, unknown>): SimulationRunRecord {
  const events = Array.isArray(doc.events)
    ? (doc.events as SimulationEvent[]).map((event) => ({
        id: String(event.id),
        type: event.type,
        at: new Date(event.at),
        data: event.data,
      }))
    : [];
  return {
    id: String(doc._id),
    wallet: String(doc.wallet),
    protocolChangeId: String(doc.protocolChangeId),
    mode: String(doc.mode),
    status: String(doc.status),
    replayGrade: String(doc.replayGrade),
    idempotencyKey: String(doc.idempotencyKey),
    engineVersion: String(doc.engineVersion),
    policyVersion: String(doc.policyVersion),
    forkBlockNumber: String(doc.forkBlockNumber),
    forkBlockHash: String(doc.forkBlockHash),
    scenario: doc.scenario ? String(doc.scenario) : undefined,
    includeStrategies: Boolean(doc.includeStrategies),
    receiptHash: doc.receiptHash ? String(doc.receiptHash) : undefined,
    before: doc.before,
    after: doc.after,
    errorCode: doc.errorCode ? String(doc.errorCode) : undefined,
    events,
    startedAt: doc.startedAt ? new Date(String(doc.startedAt)) : undefined,
    completedAt: doc.completedAt ? new Date(String(doc.completedAt)) : undefined,
  };
}
