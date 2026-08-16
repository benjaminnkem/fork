import { computeSafetyBufferBps } from "@fork/risk-engine";
import type { RiskState } from "@fork/shared";

export type ExecutionVerification = "VERIFIED" | "PARTIAL" | "MISMATCH" | "FAILED";

export function classifyExecutionState(input: {
  expected: { maxShortfallRaw: string; minSafetyBufferBps: number };
  before: Pick<RiskState, "status" | "liquidityRaw" | "shortfallRaw" | "derived">;
  after: Pick<RiskState, "status" | "liquidityRaw" | "shortfallRaw" | "derived">;
  submittedCalls: number;
  confirmedCalls: number;
  reverted: boolean;
  borrowValueRaw?: bigint;
}): ExecutionVerification {
  if (input.reverted) return "FAILED";
  if (input.confirmedCalls === 0) return "FAILED";
  if (input.confirmedCalls < input.submittedCalls) return "PARTIAL";

  const maxShortfall = BigInt(input.expected.maxShortfallRaw);
  if (input.after.shortfallRaw > maxShortfall) return "MISMATCH";
  if (input.after.status === "UNKNOWN") return "MISMATCH";

  if (input.expected.minSafetyBufferBps > 0) {
    const buffer =
      input.after.derived?.safetyBufferBps ??
      (input.borrowValueRaw !== undefined
        ? computeSafetyBufferBps(input.after.liquidityRaw, input.borrowValueRaw)
        : undefined);
    if (buffer === undefined || buffer < input.expected.minSafetyBufferBps) {
      return "MISMATCH";
    }
  }

  if (input.after.shortfallRaw < input.before.shortfallRaw) return "VERIFIED";
  if (input.after.liquidityRaw > input.before.liquidityRaw) return "VERIFIED";
  if (input.after.status !== "SHORTFALL" && input.before.status === "SHORTFALL") return "VERIFIED";
  if (input.after.shortfallRaw === input.before.shortfallRaw && input.after.liquidityRaw === input.before.liquidityRaw) {
    return "MISMATCH";
  }
  return "VERIFIED";
}
