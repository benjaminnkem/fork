import { describe, expect, it } from "vitest";
import { COLLECTION_INDEXES } from "./indexes.js";
import { MONGO_SCHEMAS } from "./schemas.js";

describe("persistence schemas", () => {
  it("declares the Phase 5 collections", () => {
    expect(Object.keys(MONGO_SCHEMAS).sort()).toEqual(
      [
        "agentRuns",
        "agentTraceEvents",
        "evidence",
        "executionAttempts",
        "exposures",
        "governanceRawEvents",
        "positionSnapshots",
        "protocolChanges",
        "receipts",
        "simulationBranches",
        "simulationRuns",
        "walletRiskPolicies",
        "wallets",
      ].sort(),
    );
  });

  it("registers unique indexes required by the spec", () => {
    const unique = COLLECTION_INDEXES.filter((item) => item.unique).map((item) => item.name);
    expect(unique).toEqual(
      expect.arrayContaining([
        "wallets_chain_address_unique",
        "governance_raw_events_log_unique",
        "protocol_changes_id_unique",
        "exposures_wallet_change_unique",
        "simulation_runs_idempotency_unique",
        "receipts_hash_unique",
      ]),
    );
  });

  it("applies declared indexes onto mongoose schemas", () => {
    const protocolIndexes = protocolChangeIndexNames();
    expect(protocolIndexes).toEqual(
      expect.arrayContaining([
        "protocol_changes_id_unique",
        "protocol_changes_status_execution",
        "protocol_changes_markets_status",
        "protocol_changes_assets_status",
      ]),
    );
    const receiptIndexes = indexNames("receipts");
    expect(receiptIndexes).toContain("receipts_hash_unique");
  });
});

function indexNames(collection: keyof typeof MONGO_SCHEMAS): string[] {
  return MONGO_SCHEMAS[collection]
    .indexes()
    .map((entry) => {
      const options = entry[1] as { name?: string };
      return options.name ?? "";
    })
    .filter(Boolean);
}

function protocolChangeIndexNames(): string[] {
  return indexNames("protocolChanges");
}
