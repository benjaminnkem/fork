import { ForkError, type ForkErrorCode } from "@fork/shared";

export type RpcFailureClass =
  | "RATE_LIMIT"
  | "TRANSIENT"
  | "ARCHIVE_MISSING"
  | "INCONSISTENT"
  | "PERMANENT";

export interface ClassifiedRpcError {
  class: RpcFailureClass;
  retryable: boolean;
  code: ForkErrorCode;
}

function readErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const extra = error as Error & { details?: string; shortMessage?: string; status?: number };
    return [error.message, extra.shortMessage, extra.details, extra.status].filter(Boolean).join(" ");
  }
  return JSON.stringify(error);
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: number; statusCode?: number };
  return candidate.status ?? candidate.statusCode;
}

export function classifyRpcError(error: unknown): ClassifiedRpcError {
  const text = readErrorText(error).toLowerCase();
  const status = readStatus(error);

  if (status === 429 || text.includes("rate limit") || text.includes("too many requests")) {
    return { class: "RATE_LIMIT", retryable: true, code: "RPC_RATE_LIMITED" };
  }
  if (
    text.includes("missing trie node") ||
    text.includes("historical state") ||
    text.includes("missing ancestor") ||
    text.includes("header not found")
  ) {
    return { class: "ARCHIVE_MISSING", retryable: false, code: "RPC_ARCHIVE_UNAVAILABLE" };
  }
  if (text.includes("inconsistent") || text.includes("block hash mismatch")) {
    return { class: "INCONSISTENT", retryable: false, code: "RPC_INCONSISTENT_STATE" };
  }
  if (
    status === 408 ||
    (status !== undefined && status >= 500) ||
    text.includes("timeout") ||
    text.includes("econnreset") ||
    text.includes("fetch failed") ||
    text.includes("network")
  ) {
    return { class: "TRANSIENT", retryable: true, code: "RPC_UNAVAILABLE" };
  }
  return { class: "PERMANENT", retryable: false, code: "RPC_UNAVAILABLE" };
}

export function toForkRpcError(error: unknown, message: string): ForkError {
  if (error instanceof ForkError) {
    return error;
  }
  const classified = classifyRpcError(error);
  return new ForkError(classified.code, message, {
    retryable: classified.retryable,
    details: { class: classified.class },
    cause: error,
  });
}
