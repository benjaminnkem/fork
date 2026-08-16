import { loadConfig, loadRootEnv } from "@fork/config";
import {
  assertPinnedRegistry,
  createForkClients,
  toJsonSafe,
} from "@fork/blockchain";

loadRootEnv();

async function main() {
  const config = loadConfig();
  if (!config.BASE_RPC_URL && !config.BASE_FALLBACK_RPC_URL) {
    throw new Error("Set BASE_RPC_URL or BASE_FALLBACK_RPC_URL");
  }
  if (!config.ETHEREUM_RPC_URL && !config.ETHEREUM_FALLBACK_RPC_URL) {
    throw new Error("Set ETHEREUM_RPC_URL or ETHEREUM_FALLBACK_RPC_URL");
  }

  const clients = createForkClients(config);
  const results = await assertPinnedRegistry(clients);
  for (const result of results) {
    console.log(
      `${result.ok ? "ok" : "MISSING"} chain=${result.chainId} ${result.key} ${result.address} bytes=${result.codeBytes}`,
    );
  }
  console.log(JSON.stringify(toJsonSafe({ count: results.length, ok: true })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
