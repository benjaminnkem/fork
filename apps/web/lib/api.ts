import { isAddress, getAddress } from "viem";

export const API_V1 =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const API_ORIGIN = API_V1.replace(/\/api\/v1\/?$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface JsonPosition {
  protocol: "moonwell";
  chainId: 8453;
  wallet: string;
  market: string;
  underlying: string;
  suppliedRaw: string;
  borrowedRaw: string;
  collateralEnabled: boolean;
  exchangeRateRaw?: string;
  metadata: Record<string, unknown>;
  anchor: {
    chainId: number;
    blockNumber: string;
    blockHash: string;
    timestamp: number;
    finality: string;
    rpcProviderId: string;
  };
}

export interface JsonRiskState {
  wallet: string;
  protocol: "moonwell";
  anchor: JsonPosition["anchor"];
  liquidityRaw: string;
  shortfallRaw: string;
  status: "SAFE" | "AT_RISK" | "SHORTFALL" | "UNKNOWN";
  derived?: {
    safetyBufferBps?: number;
    usd?: Record<string, string>;
  };
  evidence: JsonEvidence[];
}

export interface JsonEvidence {
  type: string;
  chainId: number;
  blockNumber?: string;
  blockHash?: string;
  txHash?: string;
  address?: string;
  method?: string;
  rawHash?: string;
}

export interface JsonProtocolChange {
  id: string;
  protocol: "moonwell";
  sourceChainId: number;
  destinationChainId: 8453;
  status: string;
  type: string;
  proposalId?: string;
  sourceTxHashes: string[];
  destinationTxHashes?: string[];
  targetCalls: Array<{
    destinationChainId: number;
    target: string;
    valueRaw: string;
    calldata: string;
    selector: string;
    decoded?: {
      functionName: string;
      args: unknown[];
      abiSource: string;
    };
  }>;
  affectedMarkets: string[];
  affectedAssets: string[];
  evidence: JsonEvidence[];
  supportLevel: string;
}

export interface JsonIndexedChange {
  change: JsonProtocolChange;
  sourceStatus: string;
  destinationStatus: string;
  rawGovernorState: number;
  forVotesRaw: string;
  againstVotesRaw: string;
  abstainVotesRaw: string;
}

export interface JsonExposure {
  relevant: boolean;
  severityHint: string;
  matchedMarkets: string[];
  matchedAssets: string[];
  rationaleCodes: string[];
  evidence: JsonEvidence[];
}

export interface RelevantChangeMatch {
  change: JsonProtocolChange;
  exposure: JsonExposure;
  sourceStatus: string;
  destinationStatus: string;
  rawGovernorState: number;
}

export interface SimulationEvent {
  id: string;
  type: string;
  at: string;
  data?: Record<string, unknown>;
}

export interface SimulationRun {
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
  startedAt?: string;
  completedAt?: string;
}

export interface HistoricalReplay {
  slug: string;
  proposalId: string;
  forkBlockNumber: string;
  forkBlockHash: string;
  replayGrade: string;
}

export interface AgentTraceResponse {
  run: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
}

export interface PositionsResponse {
  wallet: string;
  positions: JsonPosition[];
}

export interface RiskResponse {
  wallet: string;
  risk: JsonRiskState;
}

export interface RelevantChangesResponse {
  wallet: string;
  matches: RelevantChangeMatch[];
}

export interface ChangesResponse {
  changes: JsonIndexedChange[];
}

export interface StrategiesResponse {
  simulationId: string;
  status: string;
  strategies: unknown;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_V1}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      typeof record.code === "string" ? record.code : "INTERNAL",
      typeof record.message === "string" ? record.message : response.statusText,
      body,
    );
  }
  return body as T;
}

export function normalizeAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

export function getPositions(address: string) {
  return request<PositionsResponse>(`/wallets/${address}/positions`);
}

export function getRisk(address: string) {
  return request<RiskResponse>(`/wallets/${address}/risk`);
}

export function getRelevantChanges(address: string) {
  return request<RelevantChangesResponse>(`/wallets/${address}/relevant-changes`);
}

export function getChanges() {
  return request<ChangesResponse>("/changes");
}

export function getChange(id: string) {
  return request<JsonIndexedChange>(`/changes/${encodeURIComponent(id)}`);
}

export function createImpact(input: {
  wallet: string;
  changeId?: string;
  scenario?: string;
  includeStrategies?: boolean;
}) {
  return request<SimulationRun>("/simulations/impact", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSimulation(id: string) {
  return request<SimulationRun>(`/simulations/${id}`);
}

export function getProof(id: string) {
  return request<Record<string, unknown>>(`/simulations/${id}/proof`);
}

export function getStrategies(id: string) {
  return request<StrategiesResponse>(`/simulations/${id}/strategies`);
}

export function getHistoricalReplays() {
  return request<HistoricalReplay[] | { replays: HistoricalReplay[] }>("/historical-replays");
}

export function runHistoricalReplay(
  slug: string,
  input: { wallet?: string; includeStrategies?: boolean },
) {
  return request<SimulationRun>(`/historical-replays/${encodeURIComponent(slug)}/run`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAgentTrace(id: string) {
  return request<AgentTraceResponse>(`/agent-runs/${id}/trace`);
}

export function getHealthReady() {
  return fetch(`${API_ORIGIN}/health/ready`, { headers: { accept: "application/json" } }).then(
    async (response) => {
      const body = (await parseBody(response)) as {
        status: string;
        checks?: Record<string, string>;
      };
      if (!response.ok) {
        throw new ApiError(response.status, "INTERNAL", "API health check failed", body);
      }
      return body;
    },
  );
}

export function simulationStreamUrl(id: string) {
  return `${API_V1}/simulations/${id}/stream`;
}
