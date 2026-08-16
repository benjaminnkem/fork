export const FORK_ERROR_CODES = [
  "NOT_IMPLEMENTED",
  "INVALID_CONFIG",
  "UNSUPPORTED_PROTOCOL_CHANGE",
  "UNSUPPORTED_MARKET",
  "GOVERNANCE_STATE_UNCERTAIN",
  "CROSS_CHAIN_PAYLOAD_UNRESOLVED",
  "RPC_ARCHIVE_UNAVAILABLE",
  "RPC_INCONSISTENT_STATE",
  "RPC_RATE_LIMITED",
  "RPC_UNAVAILABLE",
  "FORK_START_FAILED",
  "FORK_TIMEOUT",
  "CHANGE_REPLAY_REVERTED",
  "RISK_READ_FAILED",
  "NO_RELEVANT_EXPOSURE",
  "NO_FEASIBLE_STRATEGY",
  "STRATEGY_POLICY_REJECTED",
  "GROQ_RATE_LIMITED",
  "GROQ_INVALID_TOOL_CALL",
  "GROQ_UNAVAILABLE",
  "SIMULATION_STALE",
  "CHANGE_CANCELLED",
  "MAINNET_STATE_MISMATCH",
  "USER_REJECTED_SIGNATURE",
] as const;

export type ForkErrorCode = (typeof FORK_ERROR_CODES)[number];

export class ForkError extends Error {
  readonly code: ForkErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ForkErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ForkError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}
