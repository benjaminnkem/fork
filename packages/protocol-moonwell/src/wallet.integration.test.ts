import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createForkClients } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createMoonwellAdapter } from "./adapter.js";

loadRootEnv();

const fixture = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../tests/fixtures/moonwell-discovered-wallets.json"),
    "utf8",
  ),
) as { activeWallet: string; emptyWallet: string };

const config = loadConfig();
const live = Boolean(config.BASE_RPC_URL);

describe.skipIf(!live)("Moonwell Base live position reads", () => {
  const clients = createForkClients(config);
  const adapter = createMoonwellAdapter(clients.base!);

  it("lists onchain Core markets", { timeout: 90_000 }, async () => {
    const markets = await adapter.listMarkets();
    expect(markets.length).toBeGreaterThan(0);
    expect(markets.some((market) => market.supported && market.underlying)).toBe(true);
  });

  it("returns no positions for an empty wallet", { timeout: 90_000 }, async () => {
    const positions = await adapter.getUserPositions(fixture.emptyWallet as `0x${string}`);
    expect(positions).toEqual([]);
    const risk = await adapter.getRiskState(fixture.emptyWallet as `0x${string}`);
    expect(risk.status === "SAFE" || risk.status === "AT_RISK" || risk.status === "UNKNOWN").toBe(
      true,
    );
    expect(risk.shortfallRaw).toBe(0n);
    expect(risk.evidence.some((item) => item.method === "getAccountLiquidity")).toBe(true);
    expect(risk.anchor.blockHash.startsWith("0x")).toBe(true);
  });

  it("reads a real discovered Moonwell wallet", { timeout: 90_000 }, async () => {
    const positions = await adapter.getUserPositions(fixture.activeWallet as `0x${string}`);
    expect(positions.length).toBeGreaterThan(0);
    for (const position of positions) {
      expect(position.chainId).toBe(8453);
      expect(position.protocol).toBe("moonwell");
      expect(position.suppliedRaw > 0n || position.borrowedRaw > 0n).toBe(true);
      expect(position.underlying.startsWith("0x")).toBe(true);
      expect(typeof position.suppliedRaw).toBe("bigint");
      expect(typeof position.borrowedRaw).toBe("bigint");
    }
    const risk = await adapter.getRiskState(fixture.activeWallet as `0x${string}`);
    expect(risk.wallet.toLowerCase()).toBe(fixture.activeWallet.toLowerCase());
    expect(["SAFE", "AT_RISK", "SHORTFALL", "UNKNOWN"]).toContain(risk.status);
    expect(risk.anchor.blockNumber > 0n).toBe(true);
    expect(typeof risk.liquidityRaw).toBe("bigint");
  });
});
