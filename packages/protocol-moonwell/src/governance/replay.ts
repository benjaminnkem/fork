import { moonwellSetCollateralFactorAbi } from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { assessMaterialRisk, evaluatePolicy } from "@fork/risk-engine";
import {
  impersonateAndFund,
  sendImpersonatedCall,
  SIMULATION_RECEIPT_SCHEMA_VERSION,
  type CanonicalGovernanceCall,
  type SimulationReceipt,
} from "@fork/simulation-core";
import { BASE_CHAIN_ID, ForkError, type Address, type BlockAnchor, type Hex } from "@fork/shared";
import { keccak256 } from "viem";
import { PINNED_BASE_CF_PROPOSAL_ID } from "./normalize.js";
import { openPinnedReplaySession, readPinnedMarketFactor } from "./pinned-fork.js";

export {
  PINNED_ADD_COLLATERAL_WALLET,
  PINNED_REPAY_WALLET,
  PINNED_REPLAY_FORK_BLOCK,
  PINNED_REPLAY_FORK_HASH,
  PINNED_REPLAY_WALLET,
} from "./pinned-fork.js";

async function codeHashAt(
  client: { getCode: (args: { address: Address; blockNumber?: bigint }) => Promise<Hex | undefined> },
  address: Address,
  blockNumber: bigint,
): Promise<Hex | null> {
  const code = await client.getCode({ address, blockNumber });
  if (!code || code === "0x") return null;
  return keccak256(code);
}

export async function replayPinnedCollateralFactor(input: {
  ethereum: ForkChainClient;
  baseRpcUrl: string;
  wallet?: Address;
}): Promise<SimulationReceipt> {
  const session = await openPinnedReplaySession(input);
  try {
    const { anvil, adapter, wallet, anchor, change, cfCall, temporalGovernor, comptroller, market } =
      session;
    const targetCalls: CanonicalGovernanceCall[] = change.targetCalls.map((call) => ({
      destinationChainId: call.destinationChainId,
      target: call.target,
      valueRaw: call.valueRaw.toString(),
      calldata: call.calldata,
      selector: call.selector,
      decoded: call.decoded,
    }));

    const [beforeMarket, beforeRisk, positions, comptrollerCodeHash, marketCodeHash, temporalGovernorCodeHash] =
      await Promise.all([
        readPinnedMarketFactor(session),
        adapter.getRiskState(wallet, anchor),
        adapter.getUserPositions(wallet, anchor),
        codeHashAt(anvil.client, comptroller, anchor.blockNumber),
        codeHashAt(anvil.client, market, anchor.blockNumber),
        codeHashAt(anvil.client, temporalGovernor, anchor.blockNumber),
      ]);

    const exposure = await adapter.matchExposure(positions, change);
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

    const afterMarket = await readPinnedMarketFactor(session);
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
    const materialRisk = assessMaterialRisk(beforeRisk, afterRisk);
    const policyEvaluation = evaluatePolicy(afterRisk, session.policy);

    return {
      receiptSchemaVersion: SIMULATION_RECEIPT_SCHEMA_VERSION,
      engineVersion: session.config.APP_VERSION,
      replayGrade: "DESTINATION_EFFECT_REPLAY",
      proposalId: PINNED_BASE_CF_PROPOSAL_ID,
      changeId: change.id,
      wallet,
      chainId: BASE_CHAIN_ID,
      fork: anchor,
      policy: session.policy,
      policyEvaluation,
      exposure,
      impersonations: [impersonation],
      timeJumps: [],
      targetCalls,
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
      materialRisk,
      provenance: {
        comptroller,
        temporalGovernor,
        market,
        comptrollerCodeHash,
        marketCodeHash,
        temporalGovernorCodeHash,
      },
      runEvidence: {
        simulatedTxHashes: [call.hash ?? null],
        afterBlockNumber: latest.number.toString(),
        afterBlockHash: latest.hash,
        completedAt: new Date().toISOString(),
      },
      evidence: [
        {
          type: "BLOCK",
          chainId: BASE_CHAIN_ID,
          blockNumber: anchor.blockNumber.toString(),
          blockHash: anchor.blockHash,
        },
        {
          type: "CONTRACT_CALL",
          chainId: BASE_CHAIN_ID,
          blockNumber: anchor.blockNumber.toString(),
          blockHash: anchor.blockHash,
          address: comptroller,
          method: "getAccountLiquidity",
        },
        {
          type: "SIMULATED_TRANSACTION",
          chainId: BASE_CHAIN_ID,
          txHash: call.hash,
          address: cfCall.target,
          method: "_setCollateralFactor",
        },
        ...change.evidence,
        ...exposure.evidence,
      ],
    };
  } finally {
    await session.close();
  }
}

export const pinnedReplayCallAbi = moonwellSetCollateralFactorAbi;
