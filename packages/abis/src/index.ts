import registryJson from "./registry/moonwell-core-2026-08-16.json" with { type: "json" };

export {
  moonwellComptrollerAbi,
  moonwellMTokenAbi,
  erc20MetadataAbi,
  erc20Abi,
  moonwellOracleAbi,
  MOONWELL_ABI_PROVENANCE,
} from "./moonwell.js";
export {
  moonwellMultichainGovernorAbi,
  wormholePublishMessageAbi,
  moonwellTemporalGovernorAbi,
  moonwellSetCollateralFactorAbi,
  ETHEREUM_WORMHOLE_CORE,
  SET_COLLATERAL_FACTOR_SELECTOR,
  PUBLISH_MESSAGE_SELECTOR,
} from "./moonwell-governor.js";

export const CURRENT_REGISTRY_VERSION = "moonwell-core-2026-08-16";

export type ContractRecord = {
  address: string;
  role: string;
  proxyPattern?: string;
  implementation?: string;
  codeBytes?: number;
  implementationCodeBytes?: number;
  verified?: boolean;
  verifiedOnchain?: boolean;
  ownerObserved?: string;
  note?: string;
};

export type ChainRegistry = {
  name: string;
  contracts: Record<string, ContractRecord>;
  markets?: Record<string, string>;
};

export type ContractRegistry = {
  registryVersion: string;
  researchedAt: string;
  sources: string[];
  bytecodeVerifiedAt: {
    date: string;
    baseBlockNumber: string;
    baseBlockHash: string;
    ethereumBlockNumber: string;
    ethereumBlockHash: string;
    baseRpc: string;
    ethereumRpc: string;
  };
  chains: Record<string, ChainRegistry>;
};

export const moonwellRegistry = registryJson as ContractRegistry;

export function getRequiredContract(chainId: number, key: string): ContractRecord {
  const chain = moonwellRegistry.chains[String(chainId)];
  if (!chain) {
    throw new Error(`Unknown chain in registry: ${chainId}`);
  }
  const record = chain.contracts[key];
  if (!record) {
    throw new Error(`Unknown contract key ${key} on chain ${chainId}`);
  }
  return record;
}

export function listVerifiedContracts(): Array<ContractRecord & { chainId: number; key: string }> {
  const out: Array<ContractRecord & { chainId: number; key: string }> = [];
  for (const [chainId, chain] of Object.entries(moonwellRegistry.chains)) {
    for (const [key, record] of Object.entries(chain.contracts)) {
      if (record.verified) {
        out.push({ ...record, chainId: Number(chainId), key });
      }
    }
  }
  return out;
}
