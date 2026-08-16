import { createPublicClient, fallback, http, type Chain, type PublicClient } from "viem";
import { base, mainnet } from "viem/chains";
import { BASE_CHAIN_ID, ETHEREUM_CHAIN_ID, ForkError } from "@fork/shared";
import type { AppConfig } from "@fork/config";
import { withRpcRetry } from "./retry.js";

export interface ForkChainClient {
  chainId: typeof BASE_CHAIN_ID | typeof ETHEREUM_CHAIN_ID;
  providerId: string;
  fallbackConfigured: boolean;
  client: PublicClient;
}

export interface ForkClients {
  base?: ForkChainClient;
  ethereum?: ForkChainClient;
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function isSupportedChainId(chainId: number): boolean {
  return chainId === BASE_CHAIN_ID || chainId === ETHEREUM_CHAIN_ID;
}

export function createForkChainClient(input: {
  chainId: typeof BASE_CHAIN_ID | typeof ETHEREUM_CHAIN_ID;
  chain: Chain;
  primaryUrl?: string;
  fallbackUrl?: string;
  providerId: string;
}): ForkChainClient {
  const urls = uniqueUrls([input.primaryUrl, input.fallbackUrl]);
  if (urls.length === 0) {
    throw new ForkError("INVALID_CONFIG", `No RPC URL configured for chain ${input.chainId}`);
  }

  const transports = urls.map((url) =>
    http(url, {
      retryCount: 0,
      timeout: 20_000,
    }),
  );

  const client = createPublicClient({
    chain: input.chain,
    transport: transports.length === 1 ? transports[0]! : fallback(transports, { rank: false }),
  });

  return {
    chainId: input.chainId,
    providerId: input.providerId,
    fallbackConfigured: urls.length > 1,
    client,
  };
}

export function createForkClients(config: AppConfig): ForkClients {
  const clients: ForkClients = {};

  if (config.BASE_RPC_URL || config.BASE_FALLBACK_RPC_URL) {
    clients.base = createForkChainClient({
      chainId: BASE_CHAIN_ID,
      chain: base,
      primaryUrl: config.BASE_RPC_URL || undefined,
      fallbackUrl: config.BASE_FALLBACK_RPC_URL || undefined,
      providerId: config.BASE_RPC_URL ? "base-primary" : "base-fallback",
    });
  }

  if (config.ETHEREUM_RPC_URL || config.ETHEREUM_FALLBACK_RPC_URL) {
    clients.ethereum = createForkChainClient({
      chainId: ETHEREUM_CHAIN_ID,
      chain: mainnet,
      primaryUrl: config.ETHEREUM_RPC_URL || undefined,
      fallbackUrl: config.ETHEREUM_FALLBACK_RPC_URL || undefined,
      providerId: config.ETHEREUM_RPC_URL ? "ethereum-primary" : "ethereum-fallback",
    });
  }

  return clients;
}

export async function assertChainId(forkClient: ForkChainClient): Promise<number> {
  const chainId = await withRpcRetry(`eth_chainId(${forkClient.chainId})`, () =>
    forkClient.client.getChainId(),
  );
  if (chainId !== forkClient.chainId) {
    throw new ForkError(
      "RPC_INCONSISTENT_STATE",
      `RPC chain ID ${chainId} does not match expected ${forkClient.chainId}`,
      { details: { providerId: forkClient.providerId } },
    );
  }
  return chainId;
}

export function requireChainClient(
  clients: ForkClients,
  chainId: typeof BASE_CHAIN_ID | typeof ETHEREUM_CHAIN_ID,
): ForkChainClient {
  const client = chainId === BASE_CHAIN_ID ? clients.base : clients.ethereum;
  if (!client) {
    throw new ForkError("INVALID_CONFIG", `RPC client not configured for chain ${chainId}`);
  }
  return client;
}
