import { getRequiredContract, moonwellComptrollerAbi } from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { withRpcRetry } from "@fork/blockchain";
import { BASE_CHAIN_ID, ETHEREUM_CHAIN_ID, ForkError } from "@fork/shared";
import { decodeSetCollateralFactor } from "./decode.js";
import type { ReplayManifest } from "./manifest.js";
import { readGovernorProposal } from "./sync.js";

export interface AnchorCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface AnchorVerification {
  ok: boolean;
  checks: AnchorCheck[];
}

function push(checks: AnchorCheck[], id: string, ok: boolean, detail: string) {
  checks.push({ id, ok, detail });
}

export async function verifyPinnedReplayAnchors(input: {
  ethereum: ForkChainClient;
  base: ForkChainClient;
  manifest: ReplayManifest;
}): Promise<AnchorVerification> {
  const checks: AnchorCheck[] = [];
  const forkBlock = BigInt(input.manifest.fork.blockNumber);

  const registryGovernor = getRequiredContract(ETHEREUM_CHAIN_ID, "multichainGovernor").address;
  const registryComptroller = getRequiredContract(BASE_CHAIN_ID, "comptroller").address;
  const registryTemporal = getRequiredContract(BASE_CHAIN_ID, "temporalGovernor").address;
  push(
    checks,
    "registry-governor",
    registryGovernor.toLowerCase() === input.manifest.contracts.ethereumGovernor.toLowerCase(),
    registryGovernor,
  );
  push(
    checks,
    "registry-comptroller",
    registryComptroller.toLowerCase() === input.manifest.contracts.comptroller.toLowerCase(),
    registryComptroller,
  );
  push(
    checks,
    "registry-temporal-governor",
    registryTemporal.toLowerCase() === input.manifest.contracts.temporalGovernor.toLowerCase(),
    registryTemporal,
  );

  const fork = await withRpcRetry("base.getBlock(manifest.fork)", () =>
    input.base.client.getBlock({ blockNumber: forkBlock }),
  );
  push(
    checks,
    "fork-block-hash",
    (fork.hash ?? "").toLowerCase() === input.manifest.fork.blockHash.toLowerCase(),
    fork.hash ?? "missing",
  );

  const effect = await withRpcRetry("base.getBlock(destinationEffect)", () =>
    input.base.client.getBlock({ blockNumber: BigInt(input.manifest.destinationEffectBlock.blockNumber) }),
  );
  push(
    checks,
    "destination-effect-block-hash",
    (effect.hash ?? "").toLowerCase() === input.manifest.destinationEffectBlock.blockHash.toLowerCase(),
    effect.hash ?? "missing",
  );

  for (const [id, address] of [
    ["code-comptroller", input.manifest.contracts.comptroller],
    ["code-temporal-governor", input.manifest.contracts.temporalGovernor],
    ["code-market", input.manifest.contracts.market],
  ] as const) {
    const code = await withRpcRetry(`base.getCode(${id})`, () =>
      input.base.client.getCode({ address, blockNumber: forkBlock }),
    );
    push(checks, id, Boolean(code && code !== "0x"), code && code !== "0x" ? `${code.slice(0, 10)}…` : "empty");
  }

  const proposal = await readGovernorProposal(input.ethereum, BigInt(input.manifest.proposalId));
  const cfCall = proposal.decoded.destinationBatches
    .flatMap((batch) => batch.calls)
    .find((call) => call.decoded?.functionName === "_setCollateralFactor");
  if (!cfCall) {
    push(checks, "proposal-cf-call", false, "no _setCollateralFactor destination call");
  } else {
    const decoded = decodeSetCollateralFactor(cfCall.calldata);
    push(
      checks,
      "proposal-market",
      decoded.market.toLowerCase() === input.manifest.contracts.market.toLowerCase(),
      decoded.market,
    );
    push(
      checks,
      "proposal-after-cf",
      decoded.newCollateralFactorMantissa.toString() === input.manifest.action.afterCollateralFactorMantissa,
      decoded.newCollateralFactorMantissa.toString(),
    );
  }

  const listing = await withRpcRetry("comptroller.markets(fork)", () =>
    input.base.client.readContract({
      address: input.manifest.contracts.comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "markets",
      args: [input.manifest.contracts.market],
      blockNumber: forkBlock,
    }),
  );
  push(
    checks,
    "fork-cf-before",
    listing[1].toString() === input.manifest.action.beforeCollateralFactorMantissa,
    listing[1].toString(),
  );

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    throw new ForkError(
      "RPC_INCONSISTENT_STATE",
      `Pinned replay anchors failed: ${failed.map((check) => check.id).join(", ")}`,
      { details: { checks } },
    );
  }
  return { ok: true, checks };
}
