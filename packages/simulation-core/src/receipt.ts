import { keccak256, stringToBytes } from "viem";
import { toJsonSafe } from "@fork/blockchain";
import type { BlockAnchor, RiskState } from "@fork/shared";
import type { ImpersonationRecord, SimulatedCallRecord } from "./actions.js";

export const SIMULATION_RECEIPT_SCHEMA_VERSION = "1";

export interface SimulationReceipt {
  receiptSchemaVersion: string;
  replayGrade: "DESTINATION_EFFECT_REPLAY";
  proposalId: string;
  wallet: string;
  chainId: number;
  fork: BlockAnchor;
  impersonations: ImpersonationRecord[];
  timeJumps: unknown[];
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
}

export function hashReceipt(receipt: SimulationReceipt): `0x${string}` {
  return keccak256(stringToBytes(JSON.stringify(toJsonSafe(receipt))));
}
