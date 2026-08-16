import {
  getRequiredContract,
  moonwellComptrollerAbi,
  moonwellSetCollateralFactorAbi,
} from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { loadConfig } from "@fork/config";
import {
  impersonateAndFund,
  sendImpersonatedCall,
  startAnvilFork,
  stopAnvil,
  type SimulationReceipt,
} from "@fork/simulation-core";
import { BASE_CHAIN_ID, ForkError, type Address, type BlockAnchor } from "@fork/shared";
import { getAddress } from "viem";
import { createMoonwellAdapter } from "../adapter.js";
import { decodeSetCollateralFactor } from "./decode.js";
import { PINNED_BASE_CF_PROPOSAL_ID } from "./normalize.js";
import { readGovernorProposal } from "./sync.js";

export const PINNED_REPLAY_FORK_BLOCK = 48025643n;
export const PINNED_REPLAY_FORK_HASH =
  "0x587e0cab88e0fd0929f24e36240bd4943e8162cab4a42bb1064d48936fa2e8bc" as const;
export const PINNED_REPLAY_WALLET = "0x9eec3976435a37b0340ecbd966c226a691956b35" as Address;

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

export async function replayPinnedCollateralFactor(input: {
  ethereum: ForkChainClient;
  baseRpcUrl: string;
  wallet?: Address;
}): Promise<SimulationReceipt> {
  const config = loadConfig();
  const wallet = input.wallet ?? PINNED_REPLAY_WALLET;
  const proposal = await readGovernorProposal(input.ethereum, BigInt(PINNED_BASE_CF_PROPOSAL_ID));
  const temporalGovernor = asAddress(getRequiredContract(BASE_CHAIN_ID, "temporalGovernor").address);
  const comptroller = asAddress(getRequiredContract(BASE_CHAIN_ID, "comptroller").address);

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
    const anchor: BlockAnchor = {
      chainId: BASE_CHAIN_ID,
      blockNumber: PINNED_REPLAY_FORK_BLOCK,
      blockHash: PINNED_REPLAY_FORK_HASH,
      timestamp: Number((await anvil.client.getBlock({ blockNumber: PINNED_REPLAY_FORK_BLOCK })).timestamp),
      finality: "historical",
      rpcProviderId: "anvil-fork",
    };

    const market = asAddress(decodeSetCollateralFactor(cfCall.calldata).market);
    const beforeMarket = (await anvil.client.readContract({
      address: comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "markets",
      args: [market],
    })) as readonly [boolean, bigint];
    const beforeRisk = await adapter.getRiskState(wallet, anchor);

    const impersonation = await impersonateAndFund(
      anvil,
      temporalGovernor,
      "DESTINATION_EFFECT_REPLAY authorized Temporal Governor",
    );
    const call = await sendImpersonatedCall(
      anvil,
      temporalGovernor,
      cfCall.target,
      cfCall.calldata,
      cfCall.valueRaw,
    );
    if (!call.success) {
      throw new ForkError("CHANGE_REPLAY_REVERTED", call.error ?? "CF replay transaction failed");
    }

    const afterMarket = (await anvil.client.readContract({
      address: comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "markets",
      args: [market],
    })) as readonly [boolean, bigint];
    const latest = await anvil.client.getBlock({ blockTag: "latest" });
    if (!latest.hash) {
      throw new ForkError("RPC_INCONSISTENT_STATE", "Anvil latest block is missing a hash");
    }
    const afterAnchor: BlockAnchor = {
      chainId: BASE_CHAIN_ID,
      blockNumber: latest.number,
      blockHash: latest.hash,
      timestamp: Number(latest.timestamp),
      finality: "latest",
      rpcProviderId: "anvil-fork",
    };
    const afterRisk = await adapter.getRiskState(wallet, afterAnchor);

    return {
      receiptSchemaVersion: "1",
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      proposalId: PINNED_BASE_CF_PROPOSAL_ID,
      wallet,
      chainId: BASE_CHAIN_ID,
      fork: anchor,
      impersonations: [impersonation],
      timeJumps: [],
      calls: [call],
      before: {
        collateralFactorMantissa: beforeMarket[1].toString(),
        risk: beforeRisk,
      },
      after: {
        collateralFactorMantissa: afterMarket[1].toString(),
        risk: afterRisk,
      },
      liquidityDeltaRaw: (afterRisk.liquidityRaw - beforeRisk.liquidityRaw).toString(),
    };
  } finally {
    await stopAnvil(anvil);
  }
}

export const pinnedReplayCallAbi = moonwellSetCollateralFactorAbi;
