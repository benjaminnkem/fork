import { moonwellComptrollerAbi, moonwellOracleAbi } from "@fork/abis";
import { computeSafetyBufferBps } from "@fork/risk-engine";
import type { Address, ProtocolPosition, RiskState } from "@fork/shared";
import { getAddress } from "viem";

export interface OracleReader {
  readContract: (args: object) => Promise<unknown>;
}

export async function readOraclePrices(input: {
  client: OracleReader;
  comptroller: Address;
  markets: Address[];
  blockNumber?: bigint;
}): Promise<Map<string, bigint>> {
  const oracle = asAddress(
    (await input.client.readContract({
      address: input.comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "oracle",
      blockNumber: input.blockNumber,
    })) as string,
  );
  const prices = new Map<string, bigint>();
  for (const market of input.markets) {
    const price = (await input.client.readContract({
      address: oracle,
      abi: moonwellOracleAbi,
      functionName: "getUnderlyingPrice",
      args: [market],
      blockNumber: input.blockNumber,
    })) as bigint;
    prices.set(market.toLowerCase(), price);
  }
  return prices;
}

export async function readBorrowValueRaw(input: {
  client: OracleReader;
  comptroller: Address;
  positions: ProtocolPosition[];
  blockNumber?: bigint;
}): Promise<bigint> {
  const oracle = asAddress(
    (await input.client.readContract({
      address: input.comptroller,
      abi: moonwellComptrollerAbi,
      functionName: "oracle",
      blockNumber: input.blockNumber,
    })) as string,
  );

  let total = 0n;
  for (const position of input.positions) {
    if (position.borrowedRaw <= 0n) continue;
    const price = (await input.client.readContract({
      address: oracle,
      abi: moonwellOracleAbi,
      functionName: "getUnderlyingPrice",
      args: [position.market],
      blockNumber: input.blockNumber,
    })) as bigint;
    if (price <= 0n) continue;
    total += (position.borrowedRaw * price) / 10n ** 18n;
  }
  return total;
}

export function withDerivedBuffer(state: RiskState, borrowValueRaw: bigint): RiskState {
  const safetyBufferBps = computeSafetyBufferBps(state.liquidityRaw, borrowValueRaw);
  return {
    ...state,
    derived: {
      ...state.derived,
      safetyBufferBps,
      usd: {
        ...state.derived?.usd,
        borrowValueRaw: borrowValueRaw.toString(),
      },
    },
  };
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}
