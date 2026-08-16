import { loadConfig, loadRootEnv } from "@fork/config";
import {
  assertChainId,
  createForkClients,
  getBlockAnchor,
  requireChainClient,
  toJsonSafe,
} from "@fork/blockchain";
import { BASE_CHAIN_ID, ETHEREUM_CHAIN_ID } from "@fork/shared";

loadRootEnv();

function requestedChain(): 8453 | 1 | "all" {
  const flag = process.argv.find((arg) => arg.startsWith("--chain="));
  const value = flag?.slice("--chain=".length) ?? "all";
  if (value === "base") return BASE_CHAIN_ID;
  if (value === "ethereum") return ETHEREUM_CHAIN_ID;
  return "all";
}

async function smoke(chainId: 8453 | 1) {
  const config = loadConfig();
  const clients = createForkClients(config);
  const client = requireChainClient(clients, chainId);
  const id = await assertChainId(client);
  const latest = await getBlockAnchor(client, "latest");
  const safe = await getBlockAnchor(client, "safe");
  console.log(
    JSON.stringify(
      toJsonSafe({
        chainId: id,
        providerId: client.providerId,
        fallbackConfigured: client.fallbackConfigured,
        latest,
        safe,
      }),
    ),
  );
}

async function main() {
  const chain = requestedChain();
  if (chain === "all") {
    await smoke(BASE_CHAIN_ID);
    await smoke(ETHEREUM_CHAIN_ID);
    return;
  }
  await smoke(chain);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
