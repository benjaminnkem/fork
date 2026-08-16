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

export function mapMultichainGovernorState(raw: number): ProtocolChangeStatus {
  switch (raw) {
    case 0:
      return "PROPOSED";
    case 1:
      return "APPROVED";
    case 2:
      return "CANCELLED";
    case 3:
      return "UNKNOWN";
    case 4:
      return "APPROVED";
    case 5:
      return "EXECUTED";
    case 6:
      return "EXPIRED";
    default:
      return "UNKNOWN";
  }
}

export function combineChangeStatus(
  sourceStatus: ProtocolChangeStatus,
  destinationStatus: ProtocolChangeStatus,
  hasDestinationCalls: boolean,
): ProtocolChangeStatus {
  if (sourceStatus === "CANCELLED" || sourceStatus === "EXPIRED") {
    return sourceStatus;
  }
  if (sourceStatus === "EXECUTED" && hasDestinationCalls) {
    return destinationStatus === "EXECUTED" ? "EXECUTED" : "DESTINATION_PENDING";
  }
  return sourceStatus;
}
