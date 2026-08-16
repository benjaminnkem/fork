import { ForkError, PROTOCOL_MOONWELL } from "@fork/shared";
import { getRequiredContract } from "@fork/abis";

export const moonwellProtocolId = PROTOCOL_MOONWELL;

export function getMoonwellBaseComptroller(): string {
  return getRequiredContract(8453, "comptroller").address;
}

export function getMoonwellTemporalGovernor(): string {
  return getRequiredContract(8453, "temporalGovernor").address;
}

export function getMoonwellEthereumGovernor(): string {
  return getRequiredContract(1, "multichainGovernor").address;
}

export function createMoonwellAdapter(): never {
  throw new ForkError(
    "NOT_IMPLEMENTED",
    "Moonwell adapter reads are Phase 2; governance indexing is Phase 3",
  );
}
