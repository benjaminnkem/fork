import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import { ForkError, type Address, type Hex } from "@fork/shared";

export interface ReplayWalletRole {
  address: Address;
  role: string;
  notes: string;
}

export interface ReplayManifest {
  manifestVersion: string;
  slug: string;
  replayGrade: "DESTINATION_EFFECT_REPLAY";
  proposalId: string;
  changeId: string;
  sourceChainId: 1;
  destinationChainId: 8453;
  fork: {
    chainId: 8453;
    blockNumber: string;
    blockHash: Hex;
  };
  destinationEffectBlock: {
    chainId: 8453;
    blockNumber: string;
    blockHash: Hex;
  };
  contracts: {
    ethereumGovernor: Address;
    temporalGovernor: Address;
    comptroller: Address;
    market: Address;
  };
  action: {
    type: "COLLATERAL_FACTOR_CHANGE";
    functionName: "_setCollateralFactor";
    beforeCollateralFactorMantissa: string;
    afterCollateralFactorMantissa: string;
  };
  wallets: {
    historical: ReplayWalletRole;
    isolatedAddCollateral: ReplayWalletRole;
    repaySmoke: ReplayWalletRole;
  };
  sources: string[];
}

const RESULT_KEYS = [
  "liquidityRaw",
  "shortfallRaw",
  "liquidityDeltaRaw",
  "liquidityDropBps",
  "receiptHash",
  "healthFactor",
];

function asAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new ForkError("INVALID_CONFIG", `Replay manifest ${field} is not an address`);
  }
  return getAddress(value) as Address;
}

function asHex(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new ForkError("INVALID_CONFIG", `Replay manifest ${field} is not a 32-byte hash`);
  }
  return value.toLowerCase() as Hex;
}

function asDecimal(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ForkError("INVALID_CONFIG", `Replay manifest ${field} is not a decimal string`);
  }
  return value;
}

function asWallet(value: unknown, field: string): ReplayWalletRole {
  if (!value || typeof value !== "object") {
    throw new ForkError("INVALID_CONFIG", `Replay manifest ${field} is missing`);
  }
  const record = value as Record<string, unknown>;
  return {
    address: asAddress(record.address, `${field}.address`),
    role: typeof record.role === "string" ? record.role : field,
    notes: typeof record.notes === "string" ? record.notes : "",
  };
}

export function assertManifestHasNoResultValues(raw: unknown): void {
  const text = JSON.stringify(raw);
  for (const key of RESULT_KEYS) {
    if (text.includes(`"${key}"`)) {
      throw new ForkError(
        "INVALID_CONFIG",
        `Replay manifest must not store result field ${key}. Recompute the receipt.`,
      );
    }
  }
}

export function parseReplayManifest(raw: unknown): ReplayManifest {
  assertManifestHasNoResultValues(raw);
  if (!raw || typeof raw !== "object") {
    throw new ForkError("INVALID_CONFIG", "Replay manifest is not an object");
  }
  const record = raw as Record<string, unknown>;
  const fork = record.fork as Record<string, unknown> | undefined;
  const dest = record.destinationEffectBlock as Record<string, unknown> | undefined;
  const contracts = record.contracts as Record<string, unknown> | undefined;
  const action = record.action as Record<string, unknown> | undefined;
  const wallets = record.wallets as Record<string, unknown> | undefined;
  if (!fork || !dest || !contracts || !action || !wallets) {
    throw new ForkError("INVALID_CONFIG", "Replay manifest is missing required sections");
  }
  if (record.slug !== "moonwell-176" || record.proposalId !== "176") {
    throw new ForkError("INVALID_CONFIG", "Only the moonwell-176 replay manifest is supported");
  }
  if (record.replayGrade !== "DESTINATION_EFFECT_REPLAY") {
    throw new ForkError("INVALID_CONFIG", "Manifest replayGrade must be DESTINATION_EFFECT_REPLAY");
  }
  return {
    manifestVersion: String(record.manifestVersion ?? "1"),
    slug: "moonwell-176",
    replayGrade: "DESTINATION_EFFECT_REPLAY",
    proposalId: "176",
    changeId: String(record.changeId ?? "moonwell:eth:176"),
    sourceChainId: 1,
    destinationChainId: 8453,
    fork: {
      chainId: 8453,
      blockNumber: asDecimal(fork.blockNumber, "fork.blockNumber"),
      blockHash: asHex(fork.blockHash, "fork.blockHash"),
    },
    destinationEffectBlock: {
      chainId: 8453,
      blockNumber: asDecimal(dest.blockNumber, "destinationEffectBlock.blockNumber"),
      blockHash: asHex(dest.blockHash, "destinationEffectBlock.blockHash"),
    },
    contracts: {
      ethereumGovernor: asAddress(contracts.ethereumGovernor, "contracts.ethereumGovernor"),
      temporalGovernor: asAddress(contracts.temporalGovernor, "contracts.temporalGovernor"),
      comptroller: asAddress(contracts.comptroller, "contracts.comptroller"),
      market: asAddress(contracts.market, "contracts.market"),
    },
    action: {
      type: "COLLATERAL_FACTOR_CHANGE",
      functionName: "_setCollateralFactor",
      beforeCollateralFactorMantissa: asDecimal(
        action.beforeCollateralFactorMantissa,
        "action.beforeCollateralFactorMantissa",
      ),
      afterCollateralFactorMantissa: asDecimal(
        action.afterCollateralFactorMantissa,
        "action.afterCollateralFactorMantissa",
      ),
    },
    wallets: {
      historical: asWallet(wallets.historical, "wallets.historical"),
      isolatedAddCollateral: asWallet(wallets.isolatedAddCollateral, "wallets.isolatedAddCollateral"),
      repaySmoke: asWallet(wallets.repaySmoke, "wallets.repaySmoke"),
    },
    sources: Array.isArray(record.sources) ? record.sources.map(String) : [],
  };
}

export function findMoonwell176ManifestPath(startDir = process.cwd()): string {
  let current = startDir;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(current, "replays", "moonwell-176.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const nearby = join(dirname(fileURLToPath(import.meta.url)), "../../../../replays/moonwell-176.json");
  if (existsSync(nearby)) return nearby;
  throw new ForkError("INVALID_CONFIG", "Committed replays/moonwell-176.json was not found");
}

export function loadMoonwell176Manifest(startDir = process.cwd()): ReplayManifest {
  return parseReplayManifest(JSON.parse(readFileSync(findMoonwell176ManifestPath(startDir), "utf8")));
}

export function receiptMatchesManifestAction(
  receipt: {
    proposalId: string;
    wallet: string;
    replayGrade: string;
    fork: { blockNumber: { toString(): string }; blockHash: string };
    before: { collateralFactorMantissa: string };
    after: { collateralFactorMantissa: string };
    provenance: { comptroller: string; temporalGovernor: string; market: string };
  },
  manifest: ReplayManifest,
): { match: boolean; diffs: Array<{ path: string; expected: string; actual: string }> } {
  const pairs: Array<[string, string, string]> = [
    ["proposalId", manifest.proposalId, receipt.proposalId],
    ["wallet", manifest.wallets.historical.address.toLowerCase(), receipt.wallet.toLowerCase()],
    ["replayGrade", manifest.replayGrade, receipt.replayGrade],
    ["fork.blockNumber", manifest.fork.blockNumber, receipt.fork.blockNumber.toString()],
    ["fork.blockHash", manifest.fork.blockHash.toLowerCase(), receipt.fork.blockHash.toLowerCase()],
    [
      "before.collateralFactorMantissa",
      manifest.action.beforeCollateralFactorMantissa,
      receipt.before.collateralFactorMantissa,
    ],
    [
      "after.collateralFactorMantissa",
      manifest.action.afterCollateralFactorMantissa,
      receipt.after.collateralFactorMantissa,
    ],
    ["provenance.comptroller", manifest.contracts.comptroller.toLowerCase(), receipt.provenance.comptroller.toLowerCase()],
    [
      "provenance.temporalGovernor",
      manifest.contracts.temporalGovernor.toLowerCase(),
      receipt.provenance.temporalGovernor.toLowerCase(),
    ],
    ["provenance.market", manifest.contracts.market.toLowerCase(), receipt.provenance.market.toLowerCase()],
  ];
  const diffs = pairs
    .filter(([, expected, actual]) => expected !== actual)
    .map(([path, expected, actual]) => ({ path, expected, actual }));
  return { match: diffs.length === 0, diffs };
}
