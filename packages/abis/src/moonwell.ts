import { parseAbi } from "viem";

export const moonwellComptrollerAbi = parseAbi([
  "function getAllMarkets() view returns (address[])",
  "function getAccountLiquidity(address account) view returns (uint256,uint256,uint256)",
  "function getHypotheticalAccountLiquidity(address account, address mTokenModify, uint256 redeemTokens, uint256 borrowAmount) view returns (uint256,uint256,uint256)",
  "function getAssetsIn(address account) view returns (address[])",
  "function checkMembership(address account, address mToken) view returns (bool)",
  "function enterMarkets(address[] mTokens) returns (uint256[])",
  "function markets(address mToken) view returns (bool,uint256)",
  "function borrowCaps(address mToken) view returns (uint256)",
  "function supplyCaps(address mToken) view returns (uint256)",
  "function mintGuardianPaused(address mToken) view returns (bool)",
  "function borrowGuardianPaused(address mToken) view returns (bool)",
  "function oracle() view returns (address)",
]);

export const moonwellMTokenAbi = parseAbi([
  "function getAccountSnapshot(address account) view returns (uint256,uint256,uint256,uint256)",
  "function underlying() view returns (address)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function comptroller() view returns (address)",
  "function mint(uint256 mintAmount) returns (uint256)",
  "function repayBorrow(uint256 repayAmount) returns (uint256)",
  "function borrowBalanceCurrent(address account) returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getCash() view returns (uint256)",
]);

export const erc20MetadataAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const moonwellOracleAbi = parseAbi([
  "function getUnderlyingPrice(address mToken) view returns (uint256)",
]);

export const MOONWELL_ABI_PROVENANCE = {
  source:
    "https://docs.moonwell.fi/moonwell/developers/protocol/comptroller/contract-interactions",
  mtokenSource: "https://docs.moonwell.fi/moonwell/developers/protocol/mtokens",
  verifiedOnchainAt: "2026-08-16",
} as const;
