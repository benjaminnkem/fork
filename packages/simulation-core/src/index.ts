import { ForkError } from "@fork/shared";

export const SIMULATION_RECEIPT_SCHEMA_VERSION = "1";

export function startSimulation(): never {
  throw new ForkError("NOT_IMPLEMENTED", "Anvil fork simulation is Phase 4");
}
