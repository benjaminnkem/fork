import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toJsonSafe } from "@fork/blockchain";
import { loadConfig, loadRootEnv } from "@fork/config";
import { GroqModelProvider, createAgentSession, runAgent } from "@fork/agent-core";
import { PINNED_ADD_COLLATERAL_WALLET } from "@fork/protocol-moonwell";
import { isAddress, type Address } from "viem";

loadRootEnv();

function parseArgs(argv: string[]) {
  const walletArg = argv.find((arg) => isAddress(arg));
  return {
    scenario: "moonwell-176",
    wallet: (walletArg as Address | undefined) ?? PINNED_ADD_COLLATERAL_WALLET,
    forceSearch: argv.includes("--force-search-buffer"),
  };
}

async function main() {
  const { scenario, wallet, forceSearch } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  if (!config.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required for pnpm fork:agent");
  }
  if (!config.BASE_RPC_URL || !config.ETHEREUM_RPC_URL) {
    throw new Error("BASE_RPC_URL and ETHEREUM_RPC_URL are required");
  }
  const result = await runAgent({
    provider: GroqModelProvider.fromApiKey(config.GROQ_API_KEY),
    session: createAgentSession({
      config,
      wallet,
      forceSearchBuffer: forceSearch,
    }),
    config,
    request: {
      wallet,
      scenario,
      prompt:
        "Investigate this wallet against Moonwell proposal 176. Use tools. Do not invent Comptroller numbers. Recommend a rescue only if a tool verified one.",
    },
  });
  mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), ".data/agent-moonwell-176.json"),
    `${JSON.stringify(toJsonSafe(result), null, 2)}\n`,
  );
  console.log(JSON.stringify(toJsonSafe(result), null, 2));
  if (result.status === "FAILED") process.exit(1);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
