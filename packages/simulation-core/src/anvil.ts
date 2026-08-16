import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { createTestClient, http, publicActions, walletActions, type Hex } from "viem";
import { base } from "viem/chains";
import { BASE_CHAIN_ID, ForkError } from "@fork/shared";

export type AnvilClient = {
  getChainId: () => Promise<number>;
  getBlock: (args: { blockNumber?: bigint; blockTag?: "latest" }) => Promise<{
    hash: Hex | null;
    number: bigint;
    timestamp: bigint;
  }>;
  impersonateAccount: (args: { address: Hex }) => Promise<void>;
  setBalance: (args: { address: Hex; value: bigint }) => Promise<void>;
  sendTransaction: (args: {
    account: Hex;
    to: Hex;
    data?: Hex;
    value?: bigint;
    chain?: unknown;
  }) => Promise<Hex>;
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: "success" | "reverted" }>;
  readContract: (args: object) => Promise<unknown>;
};

export interface AnvilInstance {
  port: number;
  host: string;
  rpcUrl: string;
  process: ChildProcess;
  client: AnvilClient;
}

function createAnvilClient(rpcUrl: string): AnvilClient {
  return createTestClient({
    chain: base,
    mode: "anvil",
    transport: http(rpcUrl, { timeout: 60_000 }),
  })
    .extend(publicActions)
    .extend(walletActions) as unknown as AnvilClient;
}

function portFree(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function reserveAnvilPort(host: string, startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await portFree(host, port)) {
      return port;
    }
  }
  throw new ForkError("FORK_START_FAILED", "No free Anvil port in configured range");
}

export async function startAnvilFork(input: {
  binary: string;
  host: string;
  startPort: number;
  forkUrl: string;
  forkBlockNumber: bigint;
  expectedBlockHash: Hex;
  startTimeoutMs: number;
}): Promise<AnvilInstance> {
  if (input.host !== "127.0.0.1") {
    throw new ForkError("INVALID_CONFIG", "Anvil must bind to 127.0.0.1");
  }
  const port = await reserveAnvilPort(input.host, input.startPort);
  const rpcUrl = `http://${input.host}:${port}`;
  const child = spawn(
    input.binary,
    [
      "--host",
      input.host,
      "--port",
      String(port),
      "--fork-url",
      input.forkUrl,
      "--fork-block-number",
      input.forkBlockNumber.toString(),
      "--no-rate-limit",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const stop = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  try {
    const client = createAnvilClient(rpcUrl);
    const deadline = Date.now() + input.startTimeoutMs;
    let lastError = "timeout";
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new ForkError("FORK_START_FAILED", `Anvil exited with code ${child.exitCode}`);
      }
      try {
        const chainId = await client.getChainId();
        if (chainId !== BASE_CHAIN_ID) {
          throw new ForkError("RPC_INCONSISTENT_STATE", `Anvil chain ${chainId} is not Base`);
        }
        const block = await client.getBlock({ blockNumber: input.forkBlockNumber });
        if (block.hash !== input.expectedBlockHash) {
          throw new ForkError("RPC_INCONSISTENT_STATE", "Anvil fork block hash does not match pin");
        }
        return { port, host: input.host, rpcUrl, process: child, client };
      } catch (error) {
        if (error instanceof ForkError) {
          throw error;
        }
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new ForkError("FORK_TIMEOUT", `Anvil did not become healthy: ${lastError}`);
  } catch (error) {
    stop();
    throw error;
  }
}

export async function stopAnvil(instance: AnvilInstance): Promise<void> {
  const child = instance.process;
  if (child.killed || child.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
