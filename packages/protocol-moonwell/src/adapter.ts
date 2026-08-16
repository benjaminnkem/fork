import {
  erc20MetadataAbi,
  getRequiredContract,
  moonwellComptrollerAbi,
  moonwellMTokenAbi,
} from "@fork/abis";
import type { ForkChainClient } from "@fork/blockchain";
import { getBlockAnchor } from "@fork/blockchain";
import { withRpcRetry } from "@fork/blockchain";
import type { ExposureResult, ProtocolAdapter } from "@fork/protocol-core";
import { classifyComptrollerLiquidity } from "@fork/risk-engine";
import {
  BASE_CHAIN_ID,
  ForkError,
  PROTOCOL_MOONWELL,
  type Address,
  type BlockAnchor,
  type EvidenceRef,
  type ProtocolChange,
  type ProtocolPosition,
  type RiskState,
} from "@fork/shared";
import { getAddress } from "viem";
import { hasOpenPosition, underlyingFromSnapshot } from "./snapshot.js";

export interface MoonwellMarket {
  market: Address;
  underlying?: Address;
  listed: boolean;
  collateralFactorMantissa: bigint;
  mTokenSymbol?: string;
  mTokenDecimals?: number;
  underlyingSymbol?: string;
  underlyingDecimals?: number;
  supported: boolean;
}

function asAddress(value: string): Address {
  return getAddress(value) as Address;
}

function callEvidence(anchor: BlockAnchor, address: Address, method: string): EvidenceRef {
  return {
    type: "CONTRACT_CALL",
    chainId: BASE_CHAIN_ID,
    blockNumber: anchor.blockNumber.toString(),
    blockHash: anchor.blockHash,
    address,
    method,
  };
}

export class MoonwellAdapter implements ProtocolAdapter {
  readonly protocolId = PROTOCOL_MOONWELL;
  private readonly comptroller: Address;

  constructor(private readonly forkClient: ForkChainClient) {
    if (forkClient.chainId !== BASE_CHAIN_ID) {
      throw new ForkError("INVALID_CONFIG", "Moonwell V1 adapter only reads Base Mainnet");
    }
    this.comptroller = asAddress(getRequiredContract(BASE_CHAIN_ID, "comptroller").address);
  }

  async resolveAnchor(anchor?: BlockAnchor): Promise<BlockAnchor> {
    if (anchor) {
      if (anchor.chainId !== BASE_CHAIN_ID) {
        throw new ForkError("INVALID_CONFIG", "Moonwell position reads require a Base anchor");
      }
      return anchor;
    }
    return getBlockAnchor(this.forkClient, "safe");
  }

  async listMarkets(anchor?: BlockAnchor): Promise<MoonwellMarket[]> {
    const resolved = await this.resolveAnchor(anchor);
    const markets = await withRpcRetry("comptroller.getAllMarkets", () =>
      this.forkClient.client.readContract({
        address: this.comptroller,
        abi: moonwellComptrollerAbi,
        functionName: "getAllMarkets",
        blockNumber: resolved.blockNumber,
      }),
    );

    const [listings, underlyings, symbols, decimals] = await Promise.all([
      withRpcRetry("comptroller.markets.multicall", () =>
        this.forkClient.client.multicall({
          contracts: markets.map((market) => ({
            address: this.comptroller,
            abi: moonwellComptrollerAbi,
            functionName: "markets" as const,
            args: [market] as const,
          })),
          allowFailure: true,
          blockNumber: resolved.blockNumber,
        }),
      ),
      withRpcRetry("mtoken.underlying.multicall", () =>
        this.forkClient.client.multicall({
          contracts: markets.map((market) => ({
            address: market,
            abi: moonwellMTokenAbi,
            functionName: "underlying" as const,
          })),
          allowFailure: true,
          blockNumber: resolved.blockNumber,
        }),
      ),
      withRpcRetry("mtoken.symbol.multicall", () =>
        this.forkClient.client.multicall({
          contracts: markets.map((market) => ({
            address: market,
            abi: moonwellMTokenAbi,
            functionName: "symbol" as const,
          })),
          allowFailure: true,
          blockNumber: resolved.blockNumber,
        }),
      ),
      withRpcRetry("mtoken.decimals.multicall", () =>
        this.forkClient.client.multicall({
          contracts: markets.map((market) => ({
            address: market,
            abi: moonwellMTokenAbi,
            functionName: "decimals" as const,
          })),
          allowFailure: true,
          blockNumber: resolved.blockNumber,
        }),
      ),
    ]);

    const result: MoonwellMarket[] = [];
    for (let i = 0; i < markets.length; i += 1) {
      const listing = listings[i];
      const underlying = underlyings[i];
      const symbol = symbols[i];
      const decimal = decimals[i];
      const listed = listing?.status === "success" ? listing.result[0] : false;
      const collateralFactorMantissa = listing?.status === "success" ? listing.result[1] : 0n;
      const underlyingAddress =
        underlying?.status === "success" ? asAddress(underlying.result) : undefined;
      result.push({
        market: asAddress(markets[i]!),
        underlying: underlyingAddress,
        listed,
        collateralFactorMantissa,
        mTokenSymbol: symbol?.status === "success" ? symbol.result : undefined,
        mTokenDecimals: decimal?.status === "success" ? Number(decimal.result) : undefined,
        supported: listed && Boolean(underlyingAddress),
      });
    }

    const withUnderlying = result.filter((market) => market.underlying);
    if (withUnderlying.length > 0) {
      const [underlyingSymbols, underlyingDecimals] = await Promise.all([
        withRpcRetry("erc20.symbol.multicall", () =>
          this.forkClient.client.multicall({
            contracts: withUnderlying.map((market) => ({
              address: market.underlying!,
              abi: erc20MetadataAbi,
              functionName: "symbol" as const,
            })),
            allowFailure: true,
            blockNumber: resolved.blockNumber,
          }),
        ),
        withRpcRetry("erc20.decimals.multicall", () =>
          this.forkClient.client.multicall({
            contracts: withUnderlying.map((market) => ({
              address: market.underlying!,
              abi: erc20MetadataAbi,
              functionName: "decimals" as const,
            })),
            allowFailure: true,
            blockNumber: resolved.blockNumber,
          }),
        ),
      ]);
      for (let i = 0; i < withUnderlying.length; i += 1) {
        const market = withUnderlying[i]!;
        const symbol = underlyingSymbols[i];
        const decimal = underlyingDecimals[i];
        market.underlyingSymbol = symbol?.status === "success" ? symbol.result : undefined;
        market.underlyingDecimals =
          decimal?.status === "success" ? Number(decimal.result) : undefined;
      }
    }

    return result;
  }

  async getUserPositions(wallet: Address, anchor?: BlockAnchor): Promise<ProtocolPosition[]> {
    const resolved = await this.resolveAnchor(anchor);
    const account = asAddress(wallet);
    const markets = await this.listMarkets(resolved);
    const entered = await withRpcRetry("comptroller.getAssetsIn", () =>
      this.forkClient.client.readContract({
        address: this.comptroller,
        abi: moonwellComptrollerAbi,
        functionName: "getAssetsIn",
        args: [account],
        blockNumber: resolved.blockNumber,
      }),
    );
    const enteredSet = new Set(entered.map((item) => asAddress(item)));

    const snapshots = await withRpcRetry("mtoken.getAccountSnapshot.multicall", () =>
      this.forkClient.client.multicall({
        contracts: markets.map((market) => ({
          address: market.market,
          abi: moonwellMTokenAbi,
          functionName: "getAccountSnapshot" as const,
          args: [account] as const,
        })),
        allowFailure: true,
        blockNumber: resolved.blockNumber,
      }),
    );

    const positions: ProtocolPosition[] = [];
    for (let i = 0; i < markets.length; i += 1) {
      const market = markets[i]!;
      const snapshot = snapshots[i];
      if (snapshot?.status !== "success") continue;
      const [error, mTokenBalance, borrowedRaw, exchangeRateRaw] = snapshot.result;
      if (error !== 0n) continue;
      const suppliedRaw = underlyingFromSnapshot(mTokenBalance, exchangeRateRaw);
      if (!hasOpenPosition(suppliedRaw, borrowedRaw)) continue;
      if (!market.supported || !market.underlying) continue;
      positions.push({
        protocol: PROTOCOL_MOONWELL,
        chainId: BASE_CHAIN_ID,
        wallet: account,
        market: market.market,
        underlying: market.underlying,
        suppliedRaw,
        borrowedRaw,
        collateralEnabled: enteredSet.has(market.market),
        exchangeRateRaw,
        metadata: {
          mTokenBalanceRaw: mTokenBalance.toString(),
          mTokenSymbol: market.mTokenSymbol,
          mTokenDecimals: market.mTokenDecimals,
          underlyingSymbol: market.underlyingSymbol,
          underlyingDecimals: market.underlyingDecimals,
          listed: market.listed,
          collateralFactorMantissa: market.collateralFactorMantissa.toString(),
        },
        anchor: resolved,
      });
    }
    return positions;
  }

  async getRiskState(wallet: Address, anchor?: BlockAnchor): Promise<RiskState> {
    const resolved = await this.resolveAnchor(anchor);
    const account = asAddress(wallet);
    const [error, liquidityRaw, shortfallRaw] = await withRpcRetry(
      "comptroller.getAccountLiquidity",
      () =>
        this.forkClient.client.readContract({
          address: this.comptroller,
          abi: moonwellComptrollerAbi,
          functionName: "getAccountLiquidity",
          args: [account],
          blockNumber: resolved.blockNumber,
        }),
    );
    return {
      wallet: account,
      protocol: PROTOCOL_MOONWELL,
      anchor: resolved,
      liquidityRaw,
      shortfallRaw,
      status: classifyComptrollerLiquidity(error, liquidityRaw, shortfallRaw),
      evidence: [
        callEvidence(resolved, this.comptroller, "getAccountLiquidity"),
        {
          type: "BLOCK",
          chainId: BASE_CHAIN_ID,
          blockNumber: resolved.blockNumber.toString(),
          blockHash: resolved.blockHash,
        },
      ],
    };
  }

  async listRelevantChanges(): Promise<ProtocolChange[]> {
    throw new ForkError("NOT_IMPLEMENTED", "Governance change listing is Phase 3");
  }

  async matchExposure(
    positions: ProtocolPosition[],
    change: ProtocolChange,
  ): Promise<ExposureResult> {
    void positions;
    void change;
    throw new ForkError("NOT_IMPLEMENTED", "Exposure matching is Phase 5");
  }
}

export function createMoonwellAdapter(forkClient: ForkChainClient): MoonwellAdapter {
  return new MoonwellAdapter(forkClient);
}

export function getMoonwellBaseComptroller(): string {
  return getRequiredContract(BASE_CHAIN_ID, "comptroller").address;
}

export function getMoonwellTemporalGovernor(): string {
  return getRequiredContract(BASE_CHAIN_ID, "temporalGovernor").address;
}

export function getMoonwellEthereumGovernor(): string {
  return getRequiredContract(1, "multichainGovernor").address;
}
