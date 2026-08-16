import type { ProtocolChangeStatus } from "@fork/shared";

export const SOURCE_STATUSES: ProtocolChangeStatus[] = [
  "ADVISORY",
  "PROPOSED",
  "APPROVED",
  "EXECUTED",
  "CANCELLED",
  "EXPIRED",
  "UNKNOWN",
];

export const DESTINATION_STATUSES: ProtocolChangeStatus[] = [
  "DESTINATION_PENDING",
  "QUEUED",
  "EXECUTABLE",
  "EXECUTED",
  "CANCELLED",
  "UNKNOWN",
];

export function isTerminalChangeStatus(status: ProtocolChangeStatus): boolean {
  return status === "EXECUTED" || status === "CANCELLED" || status === "EXPIRED";
}
