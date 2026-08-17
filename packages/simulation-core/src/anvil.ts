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
  getCode: (args: { address: Hex; blockNumber?: bigint }) => Promise<Hex | undefined>;
  getBalance: (args: { address: Hex }) => Promise<bigint>;
  snapshot: () => Promise<Hex>;
  revert: (args: { id: Hex }) => Promise<void>;
  call: (args: { account?: Hex; to: Hex; data: Hex }) => Promise<{ data?: Hex }>;
};

export interface AnvilInstance {
  port: number;
  host: string;
  rpcUrl: string;
  process: ChildProcess;
  client: AnvilClient;
}

const liveAnvils = new Set<AnvilInstance>();

export function liveAnvilCount(): number {
  return liveAnvils.size;
}

export function hashesEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
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
    { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
  );

  const stop = () => {
    killAnvilProcess(child);
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
        if (!hashesEqual(block.hash, input.expectedBlockHash)) {
          throw new ForkError("RPC_INCONSISTENT_STATE", "Anvil fork block hash does not match pin");
        }
        const instance = { port, host: input.host, rpcUrl, process: child, client };
        liveAnvils.add(instance);
        child.once("exit", () => {
          liveAnvils.delete(instance);
        });
        return instance;
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

function killAnvilProcess(child: ChildProcess): void {
  if (child.killed || child.exitCode !== null) return;
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      child.kill("SIGTERM");
      return;
    }
  }
  child.kill("SIGTERM");
}

export async function stopAnvil(instance: AnvilInstance): Promise<void> {
  const child = instance.process;
  if (child.killed || child.exitCode !== null) {
    liveAnvils.delete(instance);
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (process.platform !== "win32" && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      } else {
        child.kill("SIGKILL");
      }
      resolve();
    }, 2000);
    child.once("exit", () => {
      clearTimeout(timer);
      liveAnvils.delete(instance);
      resolve();
    });
    killAnvilProcess(child);
  });
}

export async function stopAllAnvils(): Promise<void> {
  await Promise.all([...liveAnvils].map((instance) => stopAnvil(instance)));
}
