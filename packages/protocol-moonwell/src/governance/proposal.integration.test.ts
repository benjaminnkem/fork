import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { MemoryGovernanceStore } from "@fork/governance-core";
import { decodeSetCollateralFactor } from "./decode.js";
import { PINNED_BASE_CF_PROPOSAL_ID } from "./normalize.js";
import { readGovernorProposal, syncMoonwellGovernor } from "./sync.js";

loadRootEnv();

const fixture = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../tests/fixtures/moonwell-proposal-176.json",
    ),
    "utf8",
  ),
) as {
  proposalId: string;
  changeId: string;
  temporalGovernor: string;
  baseComptroller: string;
  affectedMarket: string;
  newCollateralFactorMantissa: string;
  expectedType: string;
  expectedSupportLevel: string;
};

const config = loadConfig();
const live = Boolean(config.ETHEREUM_RPC_URL && config.BASE_RPC_URL);

describe.skipIf(!live)("Moonwell governor live ingest", () => {
  const clients = createForkClients(config);

  it("reconstructs pinned proposal 176 from chain data", { timeout: 60_000 }, async () => {
    const read = await readGovernorProposal(clients.ethereum!, BigInt(fixture.proposalId));
    expect(read.decoded.proposalId).toBe(PINNED_BASE_CF_PROPOSAL_ID);
    expect(read.rawState).toBe(5);
    const batch = read.decoded.destinationBatches.find(
      (item) => item.temporalGovernor.toLowerCase() === fixture.temporalGovernor.toLowerCase(),
    );
    expect(batch).toBeDefined();
    const cf = batch!.calls.find((call) => call.decoded?.functionName === "_setCollateralFactor");
    expect(cf?.target.toLowerCase()).toBe(fixture.baseComptroller.toLowerCase());
    const decoded = decodeSetCollateralFactor(cf!.calldata);
    expect(decoded.market.toLowerCase()).toBe(fixture.affectedMarket.toLowerCase());
    expect(decoded.newCollateralFactorMantissa.toString()).toBe(fixture.newCollateralFactorMantissa);
    expect(cf?.calldata.startsWith("0xe4028eee")).toBe(true);
  });

  it("syncs Ethereum proposals into normalized changes", { timeout: 120_000 }, async () => {
    const store = new MemoryGovernanceStore();
    const result = await syncMoonwellGovernor({
      ethereum: clients.ethereum!,
      base: clients.base,
      store,
      startProposalId: 176n,
    });
    expect(result.upserted).toBeGreaterThan(0);
    const record = await store.getIndexedChange(fixture.changeId);
    expect(record?.change.type).toBe(fixture.expectedType);
    expect(record?.change.supportLevel).toBe(fixture.expectedSupportLevel);
    expect(record?.change.affectedMarkets.map((item) => item.toLowerCase())).toContain(
      fixture.affectedMarket.toLowerCase(),
    );
    expect(record?.sourceStatus).toBe("EXECUTED");
    expect(record?.change.targetCalls.some((call) => call.decoded?.functionName === "_setCollateralFactor")).toBe(
      true,
    );
    const raw = await store.getRawEvent(`eth:proposal:${fixture.proposalId}`);
    expect(raw?.blockHash.startsWith("0x")).toBe(true);
    expect(Array.isArray(raw?.raw.calldatas)).toBe(true);
  });
});
