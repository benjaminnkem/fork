import { getRequiredContract, moonwellComptrollerAbi } from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { loadConfig, type AppConfig } from "@fork/config";
import { createUserRiskPolicy } from "@fork/risk-engine";
import { startAnvilFork, stopAnvil, type AnvilInstance } from "@fork/simulation-core";
import {
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  ForkError,
  type Address,
  type BlockAnchor,
  type Hex,
  type ProtocolChange,
  type UserRiskPolicy,
} from "@fork/shared";
import { getAddress } from "viem";
import { createMoonwellAdapter, type MoonwellAdapter } from "../adapter.js";
import { decodeSetCollateralFactor } from "./decode.js";
import { loadMoonwell176Manifest } from "./manifest.js";
import { normalizeGovernorProposal, PINNED_BASE_CF_PROPOSAL_ID } from "./normalize.js";
import { readGovernorProposal } from "./sync.js";

const MANIFEST = loadMoonwell176Manifest();

export const PINNED_REPLAY_FORK_BLOCK = BigInt(MANIFEST.fork.blockNumber);
export const PINNED_REPLAY_FORK_HASH = MANIFEST.fork.blockHash;
export const PINNED_REPLAY_WALLET = MANIFEST.wallets.historical.address;
export const PINNED_ADD_COLLATERAL_WALLET = MANIFEST.wallets.isolatedAddCollateral.address;
export const PINNED_REPAY_WALLET = MANIFEST.wallets.repaySmoke.address;
export const PINNED_REPLAY_MANIFEST = MANIFEST;

export interface PinnedReplaySession {
  config: AppConfig;
  anvil: AnvilInstance;
  adapter: MoonwellAdapter;
  forkClient: ForkChainClient;
  wallet: Address;
  anchor: BlockAnchor;
  change: ProtocolChange;
  cfCall: { target: Address; calldata: Hex; valueRaw: bigint };
  temporalGovernor: Address;
  comptroller: Address;
  governor: Address;
  market: Address;
  policy: UserRiskPolicy;
  close: () => Promise<void>;
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

function envMinSafetyBufferBps(configured?: number): number | undefined {
  const raw = process.env.DEFAULT_MIN_SAFETY_BUFFER_BPS;
  if (raw === undefined || raw.trim() === "") return undefined;
  return configured;
}

export async function openPinnedReplaySession(input: {
  ethereum: ForkChainClient;
  baseRpcUrl: string;
  wallet?: Address;
  policy?: UserRiskPolicy;
}): Promise<PinnedReplaySession> {
  const config = loadConfig();
  const wallet = asAddress(input.wallet ?? PINNED_REPLAY_WALLET);
  const proposal = await readGovernorProposal(input.ethereum, BigInt(PINNED_BASE_CF_PROPOSAL_ID));
  const temporalGovernor = asAddress(getRequiredContract(BASE_CHAIN_ID, "temporalGovernor").address);
  const comptroller = asAddress(getRequiredContract(BASE_CHAIN_ID, "comptroller").address);
  const governor = asAddress(getRequiredContract(ETHEREUM_CHAIN_ID, "multichainGovernor").address);

  const cfCall = proposal.decoded.destinationBatches
    .filter((batch) => batch.temporalGovernor.toLowerCase() === temporalGovernor.toLowerCase())
    .flatMap((batch) => batch.calls)
    .find((call) => call.decoded?.functionName === "_setCollateralFactor");
  if (!cfCall) {
    throw new ForkError("UNSUPPORTED_PROTOCOL_CHANGE", "Pinned proposal has no Base CF destination call");
  }
  decodeSetCollateralFactor(cfCall.calldata);

  const anvil = await startAnvilFork({
    binary: config.ANVIL_BINARY,
    host: config.ANVIL_HOST,
    startPort: config.ANVIL_PORT_START,
    forkUrl: input.baseRpcUrl,
    forkBlockNumber: PINNED_REPLAY_FORK_BLOCK,
    expectedBlockHash: PINNED_REPLAY_FORK_HASH,
    startTimeoutMs: Math.max(config.FORK_START_TIMEOUT_MS, 180_000),
  });

  try {
    const forkClient: ForkChainClient = {
      chainId: BASE_CHAIN_ID,
      providerId: "anvil-fork",
      fallbackConfigured: false,
      client: anvil.client as unknown as ForkChainClient["client"],
    };
    const adapter = createMoonwellAdapter(forkClient);
    const forkBlock = await anvil.client.getBlock({ blockNumber: PINNED_REPLAY_FORK_BLOCK });
    const anchor: BlockAnchor = {
      chainId: BASE_CHAIN_ID,
      blockNumber: PINNED_REPLAY_FORK_BLOCK,
      blockHash: PINNED_REPLAY_FORK_HASH,
      timestamp: Number(forkBlock.timestamp),
      finality: "historical",
      rpcProviderId: "anvil-fork",
    };
    const market = asAddress(decodeSetCollateralFactor(cfCall.calldata).market);
    const markets = await adapter.listMarkets(anchor);
    const marketInfo = markets.find((item) => item.market.toLowerCase() === market.toLowerCase());
    const indexed = normalizeGovernorProposal({
      proposal: proposal.decoded,
      rawGovernorState: proposal.rawState,
      votes: proposal.votes,
      discoveredAt: new Date(anchor.timestamp * 1000),
      affectedAssets: marketInfo?.underlying ? [marketInfo.underlying] : [],
      evidence: [
        {
          type: "CONTRACT_CALL",
          chainId: ETHEREUM_CHAIN_ID,
          address: governor,
          method: "getProposalData",
        },
      ],
    });
    const policy =
      input.policy ??
      createUserRiskPolicy({
        envMinSafetyBufferBps: envMinSafetyBufferBps(config.DEFAULT_MIN_SAFETY_BUFFER_BPS),
      });

    return {
      config,
      anvil,
      adapter,
      forkClient,
      wallet,
      anchor,
      change: indexed.change,
      cfCall: {
        target: cfCall.target,
        calldata: cfCall.calldata,
        valueRaw: cfCall.valueRaw,
      },
      temporalGovernor,
      comptroller,
      governor,
      market,
      policy,
      close: async () => {
        await stopAnvil(anvil);
      },
    };
  } catch (error) {
    await stopAnvil(anvil);
    throw error;
  }
}

export async function readPinnedMarketFactor(
  session: PinnedReplaySession,
): Promise<readonly [boolean, bigint]> {
  return session.anvil.client.readContract({
    address: session.comptroller,
    abi: moonwellComptrollerAbi,
    functionName: "markets",
    args: [session.market],
  }) as Promise<readonly [boolean, bigint]>;
}
