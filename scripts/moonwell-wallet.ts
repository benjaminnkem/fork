import { isAddress } from "viem";
import { createForkClients, requireChainClient, toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { createMoonwellAdapter } from "@fork/protocol-moonwell";
import { BASE_CHAIN_ID } from "@fork/shared";

loadRootEnv();

function parseArgs(argv: string[]) {
  const blockFlag = argv.find((arg) => arg.startsWith("--block="));
  const address = argv.find((arg) => isAddress(arg));
  return {
    address,
    blockNumber: blockFlag ? BigInt(blockFlag.slice("--block=".length)) : undefined,
  };
}

async function main() {
  const { address, blockNumber } = parseArgs(process.argv.slice(2));
  if (!address) {
    throw new Error("Usage: pnpm moonwell:wallet <0xAddress> [--block=<number>]");
  }

  const config = loadConfig();
  const clients = createForkClients(config);
  const base = requireChainClient(clients, BASE_CHAIN_ID);
  const adapter = createMoonwellAdapter(base);
  const anchor = blockNumber
    ? await (await import("@fork/blockchain")).getHistoricalAnchor(base, blockNumber)
    : undefined;
  const resolved = await adapter.resolveAnchor(anchor);
  const [markets, positions, risk] = await Promise.all([
    adapter.listMarkets(resolved),
    adapter.getUserPositions(address, resolved),
    adapter.getRiskState(address, resolved),
  ]);

  console.log(
    JSON.stringify(
      toJsonSafe({
        wallet: address,
        anchor: resolved,
        marketCount: markets.length,
        supportedMarketCount: markets.filter((market) => market.supported).length,
        positions,
        risk,
      }),
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
