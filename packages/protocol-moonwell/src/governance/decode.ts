import {
  moonwellSetCollateralFactorAbi,
  PUBLISH_MESSAGE_SELECTOR,
  SET_COLLATERAL_FACTOR_SELECTOR,
  wormholePublishMessageAbi,
} from "@fork/abis";
import type { Address, GovernanceCall, Hex, ProtocolChangeType } from "@fork/shared";
import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  type Hex as ViemHex,
} from "viem";

export interface DestinationBatch {
  temporalGovernor: Address;
  calls: GovernanceCall[];
}

export interface DecodedGovernorProposal {
  proposalId: string;
  sourceCalls: GovernanceCall[];
  destinationBatches: DestinationBatch[];
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

function asHex(value: string): Hex {
  return value as Hex;
}

export function classifySelector(selector: string): ProtocolChangeType {
  if (selector.toLowerCase() === SET_COLLATERAL_FACTOR_SELECTOR) {
    return "COLLATERAL_FACTOR_CHANGE";
  }
  return "UNKNOWN";
}

export function decodeSetCollateralFactor(calldata: Hex): {
  market: Address;
  newCollateralFactorMantissa: bigint;
} {
  const decoded = decodeFunctionData({
    abi: moonwellSetCollateralFactorAbi,
    data: calldata as ViemHex,
  });
  return {
    market: asAddress(decoded.args[0]),
    newCollateralFactorMantissa: decoded.args[1],
  };
}

export function decodeGovernanceCall(
  destinationChainId: number,
  target: string,
  valueRaw: bigint,
  calldata: string,
): GovernanceCall {
  const selector = asHex(calldata.slice(0, 10).padEnd(10, "0"));
  const call: GovernanceCall = {
    destinationChainId,
    target: asAddress(target),
    valueRaw,
    calldata: asHex(calldata),
    selector,
  };
  if (selector.toLowerCase() === SET_COLLATERAL_FACTOR_SELECTOR) {
    try {
      const decoded = decodeSetCollateralFactor(asHex(calldata));
      call.decoded = {
        functionName: "_setCollateralFactor",
        args: [decoded.market, decoded.newCollateralFactorMantissa.toString()],
        abiSource: "packages/abis/src/moonwell-governor.ts",
      };
    } catch {
      return call;
    }
  }
  return call;
}

export function decodePublishMessagePayload(calldata: Hex): DestinationBatch | undefined {
  if (!calldata.toLowerCase().startsWith(PUBLISH_MESSAGE_SELECTOR)) {
    return undefined;
  }
  try {
    const published = decodeFunctionData({
      abi: wormholePublishMessageAbi,
      data: calldata as ViemHex,
    });
    const payload = published.args[1];
    const [temporalGovernor, targets, values, datas] = decodeAbiParameters(
      [
        { type: "address" },
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "bytes[]" },
      ],
      payload,
    );
    return {
      temporalGovernor: asAddress(temporalGovernor),
      calls: targets.map((target, index) =>
        decodeGovernanceCall(8453, target, values[index] ?? 0n, datas[index] ?? "0x"),
      ),
    };
  } catch {
    return undefined;
  }
}

export function decodeGovernorProposalData(
  proposalId: bigint,
  targets: readonly string[],
  values: readonly bigint[],
  calldatas: readonly string[],
  sourceChainId: number,
): DecodedGovernorProposal {
  const sourceCalls = targets.map((target, index) =>
    decodeGovernanceCall(sourceChainId, target, values[index] ?? 0n, calldatas[index] ?? "0x"),
  );
  const destinationBatches: DestinationBatch[] = [];
  for (const call of sourceCalls) {
    const batch = decodePublishMessagePayload(call.calldata);
    if (batch) {
      destinationBatches.push(batch);
    }
  }
  return {
    proposalId: proposalId.toString(),
    sourceCalls,
    destinationBatches,
  };
}
