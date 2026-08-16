import { parseAbi } from "viem";

export const moonwellComptrollerAbi = parseAbi([
  "function getAllMarkets() view returns (address[])",
  "function getAccountLiquidity(address account) view returns (uint256,uint256,uint256)",
  "function getAssetsIn(address account) view returns (address[])",
  "function checkMembership(address account, address mToken) view returns (bool)",
  "function markets(address mToken) view returns (bool,uint256)",
  "function borrowCaps(address mToken) view returns (uint256)",
  "function supplyCaps(address mToken) view returns (uint256)",
]);

export const moonwellMTokenAbi = parseAbi([
  "function getAccountSnapshot(address account) view returns (uint256,uint256,uint256,uint256)",
  "function underlying() view returns (address)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function comptroller() view returns (address)",
]);

export const erc20MetadataAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
]);

export const MOONWELL_ABI_PROVENANCE = {
  source:
    "https://docs.moonwell.fi/moonwell/developers/protocol/comptroller/contract-interactions",
  mtokenSource: "https://docs.moonwell.fi/moonwell/developers/protocol/mtokens",
  verifiedOnchainAt: "2026-08-16",
} as const;
