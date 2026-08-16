export type Hex = `0x${string}`;
export type Address = `0x${string}`;

export interface BlockAnchor {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex;
  timestamp: number;
  finality: "latest" | "safe" | "finalized" | "historical";
  rpcProviderId: string;
}

export interface EvidenceRef {
  type:
    | "BLOCK"
    | "LOG"
    | "TRANSACTION"
    | "CONTRACT_CALL"
    | "CONTRACT_CODE"
    | "SIMULATED_TRANSACTION"
    | "TOOL_RESULT";
  chainId: number;
  blockNumber?: string;
  blockHash?: Hex;
  txHash?: Hex;
  address?: Address;
  method?: string;
  rawHash?: Hex;
}

export interface ProtocolPosition {
  protocol: "moonwell";
  chainId: 8453;
  wallet: Address;
  market: Address;
  underlying: Address;
  suppliedRaw: bigint;
  borrowedRaw: bigint;
  collateralEnabled: boolean;
  exchangeRateRaw?: bigint;
  metadata: Record<string, unknown>;
  anchor: BlockAnchor;
}

export type RiskStatus = "SAFE" | "AT_RISK" | "SHORTFALL" | "UNKNOWN";

export interface RiskState {
  wallet: Address;
  protocol: "moonwell";
  anchor: BlockAnchor;
  liquidityRaw: bigint;
  shortfallRaw: bigint;
  status: RiskStatus;
  derived?: {
    safetyBufferBps?: number;
    usd?: Record<string, string>;
  };
  evidence: EvidenceRef[];
}

export type ProtocolChangeStatus =
  | "ADVISORY"
  | "PROPOSED"
  | "APPROVED"
  | "DESTINATION_PENDING"
  | "QUEUED"
  | "EXECUTABLE"
  | "EXECUTED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export type ProtocolChangeType =
  | "COLLATERAL_FACTOR_CHANGE"
  | "BORROW_CAP_CHANGE"
  | "SUPPLY_CAP_CHANGE"
  | "INTEREST_RATE_MODEL_CHANGE"
  | "MARKET_CONFIGURATION_CHANGE"
  | "CONTRACT_UPGRADE"
  | "UNKNOWN";

export type ReplaySupportLevel =
  | "FULL_REPLAY"
  | "DESTINATION_EFFECT_REPLAY"
  | "ANALYSIS_ONLY"
  | "UNSUPPORTED";

export interface GovernanceCall {
  destinationChainId: number;
  target: Address;
  valueRaw: bigint;
  calldata: Hex;
  selector: Hex;
  decoded?: {
    functionName: string;
    args: unknown[];
    abiSource: string;
  };
}

export interface ProtocolChange {
  id: string;
  protocol: "moonwell";
  sourceChainId: number;
  destinationChainId: 8453;
  status: ProtocolChangeStatus;
  type: ProtocolChangeType;
  proposalId?: string;
  sourceTxHashes: Hex[];
  destinationTxHashes?: Hex[];
  targetCalls: GovernanceCall[];
  affectedMarkets: Address[];
  affectedAssets: Address[];
  earliestExecutionAt?: Date;
  latestExecutionAt?: Date;
  discoveredAt: Date;
  updatedAt: Date;
  evidence: EvidenceRef[];
  supportLevel: ReplaySupportLevel;
}

export type OptimizationGoal = "MIN_CAPITAL" | "MAX_SAFETY" | "MIN_TX_COUNT";

export type MinSafetyBufferBpsSource = "ENV" | "EXPLICIT" | "NO_ADDITIONAL_BUFFER";

export interface UserRiskPolicy {
  policyVersion: string;
  minSafetyBufferBps: number;
  minSafetyBufferBpsSource: MinSafetyBufferBpsSource;
  optimizationGoal: OptimizationGoal;
  allowRepayDebt: boolean;
  allowAddCollateral: boolean;
  maxRepayRawByAsset?: Record<string, string>;
  maxCollateralRawByAsset?: Record<string, string>;
}

export type ExposureSeverityHint = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface ExposureResult {
  relevant: boolean;
  severityHint: ExposureSeverityHint;
  matchedMarkets: Address[];
  matchedAssets: Address[];
  rationaleCodes: string[];
  evidence: EvidenceRef[];
}

export const RISK_POLICY_SCHEMA_VERSION = "1";

export type StrategyType = "REPAY_DEBT" | "ADD_COLLATERAL";

export const BASE_CHAIN_ID = 8453;
export const ETHEREUM_CHAIN_ID = 1;
export const PROTOCOL_MOONWELL = "moonwell" as const;
