import { describe, expect, it } from "vitest";
import { loadConfig, loadRootEnv } from "@fork/config";
import { getBlockAnchor, getHistoricalAnchor } from "./anchors.js";
import { assertChainId, createForkClients } from "./clients.js";
import { assertPinnedRegistry } from "./registry.js";

loadRootEnv();

const config = loadConfig();
const live = Boolean(config.BASE_RPC_URL && config.ETHEREUM_RPC_URL);

describe.skipIf(!live)("live Base and Ethereum RPC reads", () => {
  const clients = createForkClients(config);

  it("validates configured chain IDs", { timeout: 60_000 }, async () => {
    expect(clients.base).toBeDefined();
    expect(clients.ethereum).toBeDefined();
    await expect(assertChainId(clients.base!)).resolves.toBe(8453);
    await expect(assertChainId(clients.ethereum!)).resolves.toBe(1);
  });

  it("pins latest anchors by number and hash", { timeout: 60_000 }, async () => {
    const base = await getBlockAnchor(clients.base!, "latest");
    const ethereum = await getBlockAnchor(clients.ethereum!, "latest");
    expect(base.chainId).toBe(8453);
    expect(ethereum.chainId).toBe(1);
    expect(base.blockHash.startsWith("0x")).toBe(true);
    expect(ethereum.blockHash.startsWith("0x")).toBe(true);
    expect(base.blockNumber > 0n).toBe(true);
    expect(ethereum.blockNumber > 0n).toBe(true);
  });

  it("refuses to silently replace a requested historical block", { timeout: 60_000 }, async () => {
    const latest = await getBlockAnchor(clients.base!, "latest");
    const historical = await getHistoricalAnchor(clients.base!, latest.blockNumber);
    expect(historical.blockNumber).toBe(latest.blockNumber);
    expect(historical.finality).toBe("historical");
  });

  it("confirms pinned Moonwell registry bytecode on both chains", { timeout: 90_000 }, async () => {
    const results = await assertPinnedRegistry(clients);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.some((result) => result.key === "comptroller" && result.chainId === 8453)).toBe(
      true,
    );
    expect(
      results.some((result) => result.key === "multichainGovernor" && result.chainId === 1),
    ).toBe(true);
  });
});
