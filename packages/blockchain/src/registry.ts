import { getAddress } from "viem";
import {
  getRequiredContract,
  listVerifiedContracts,
  type ContractRecord,
} from "@fork/abis";
import { ForkError, type Address } from "@fork/shared";
import type { ForkChainClient, ForkClients } from "./clients.js";
import { requireChainClient } from "./clients.js";
import { withRpcRetry } from "./retry.js";

export interface BytecodeCheck {
  chainId: number;
  key: string;
  address: Address;
  codeBytes: number;
  ok: boolean;
  implementation?: Address;
  implementationCodeBytes?: number;
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

export async function getCodeBytes(
  forkClient: ForkChainClient,
  address: string,
): Promise<number> {
  const code = await withRpcRetry(`eth_getCode(${forkClient.chainId},${address})`, () =>
    forkClient.client.getCode({ address: asAddress(address) }),
  );
  if (!code || code === "0x") {
    return 0;
  }
  return Math.max(0, (code.length - 2) / 2);
}

export async function verifyContractRecord(
  forkClient: ForkChainClient,
  key: string,
  record: ContractRecord,
): Promise<BytecodeCheck> {
  if (forkClient.client.chain?.id && forkClient.client.chain.id !== forkClient.chainId) {
    throw new ForkError("RPC_INCONSISTENT_STATE", "Client chain does not match registry chain");
  }
  const address = asAddress(record.address);
  const codeBytes = await getCodeBytes(forkClient, address);
  const result: BytecodeCheck = {
    chainId: forkClient.chainId,
    key,
    address,
    codeBytes,
    ok: codeBytes > 0,
  };

  if (record.implementation) {
    const implementation = asAddress(record.implementation);
    const implementationCodeBytes = await getCodeBytes(forkClient, implementation);
    result.implementation = implementation;
    result.implementationCodeBytes = implementationCodeBytes;
    result.ok = result.ok && implementationCodeBytes > 0;
  }

  return result;
}

export async function verifyPinnedRegistry(clients: ForkClients): Promise<BytecodeCheck[]> {
  const results: BytecodeCheck[] = [];
  for (const record of listVerifiedContracts()) {
    const chainId = record.chainId === 8453 || record.chainId === 1 ? record.chainId : undefined;
    if (!chainId) {
      throw new ForkError("INVALID_CONFIG", `Unsupported registry chain ${record.chainId}`);
    }
    const forkClient = requireChainClient(clients, chainId);
    results.push(await verifyContractRecord(forkClient, record.key, record));
  }
  return results;
}

export async function assertPinnedRegistry(clients: ForkClients): Promise<BytecodeCheck[]> {
  const results = await verifyPinnedRegistry(clients);
  const missing = results.filter((result) => !result.ok);
  if (missing.length > 0) {
    throw new ForkError(
      "RPC_INCONSISTENT_STATE",
      "Pinned contract registry failed bytecode checks",
      {
        details: {
          missing: missing.map((item) => `${item.chainId}:${item.key}`),
        },
      },
    );
  }
  return results;
}

export function requiredMoonwellAddresses() {
  return {
    baseComptroller: getRequiredContract(8453, "comptroller").address,
    temporalGovernor: getRequiredContract(8453, "temporalGovernor").address,
    ethereumGovernor: getRequiredContract(1, "multichainGovernor").address,
  };
}
