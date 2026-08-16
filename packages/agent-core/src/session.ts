import {
  createForkClients,
  getHistoricalAnchor,
  requireChainClient,
  toJsonSafe,
} from "@fork/blockchain";
import type { AppConfig } from "@fork/config";
import {
  assessAddCollateralFeasibility,
  assessRepayFeasibility,
  comparePinnedStrategies,
  createMoonwellAdapter,
  getMoonwellBaseComptroller,
  matchMoonwellExposure,
  normalizeGovernorProposal,
  PINNED_BASE_CF_PROPOSAL_ID,
  PINNED_REPLAY_FORK_BLOCK,
  readGovernorProposal,
  readMarketConstraints,
  readOraclePrices,
  readTokenBalance,
  replayPinnedCollateralFactor,
  type StrategyComparison,
} from "@fork/protocol-moonwell";
import { createUserRiskPolicy } from "@fork/risk-engine";
import type { StrategySearchResult } from "@fork/strategy-engine";
import {
  BASE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  ForkError,
  type Address,
  type BlockAnchor,
  type ProtocolChange,
  type ProtocolPosition,
  type RiskState,
  type UserRiskPolicy,
} from "@fork/shared";
import { wrapUntrusted } from "./trace.js";
import type { AuthorizedToolCall } from "./policy.js";

export interface AgentSession {
  execute(call: AuthorizedToolCall): Promise<unknown>;
}

export function createAgentSession(input: {
  config: AppConfig;
  wallet: Address;
  policy?: UserRiskPolicy;
  forceSearchBuffer?: boolean;
}): AgentSession {
  const clients = createForkClients(input.config);
  const base = requireChainClient(clients, BASE_CHAIN_ID);
  const ethereum = requireChainClient(clients, ETHEREUM_CHAIN_ID);
  const adapter = createMoonwellAdapter(base);
  const reader = {
    readContract: (args: object) => base.client.readContract(args as never),
  };
  const policy = input.policy ?? createUserRiskPolicy();
  const cache: {
    anchor?: BlockAnchor;
    positions?: ProtocolPosition[];
    risk?: RiskState;
    change?: ProtocolChange;
    impact?: unknown;
    comparison?: StrategyComparison;
  } = {};

  async function anchor(): Promise<BlockAnchor> {
    cache.anchor ??= await getHistoricalAnchor(base, PINNED_REPLAY_FORK_BLOCK);
    return cache.anchor;
  }

  async function positions(): Promise<ProtocolPosition[]> {
    if (!cache.positions) {
      cache.positions = await adapter.getUserPositions(input.wallet, await anchor());
    }
    return cache.positions;
  }

  async function risk(): Promise<RiskState> {
    if (!cache.risk) {
      cache.risk = await adapter.getRiskState(input.wallet, await anchor());
    }
    return cache.risk;
  }

  async function change(): Promise<ProtocolChange> {
    if (!cache.change) {
      const resolved = await anchor();
      const proposal = await readGovernorProposal(ethereum, BigInt(PINNED_BASE_CF_PROPOSAL_ID));
      const markets = await adapter.listMarkets(resolved);
      const indexed = normalizeGovernorProposal({
        proposal: proposal.decoded,
        rawGovernorState: proposal.rawState,
        votes: proposal.votes,
        discoveredAt: new Date(resolved.timestamp * 1000),
        affectedAssets: markets
          .filter((market) =>
            proposal.decoded.destinationBatches.some((batch) =>
              batch.calls.some((call) =>
                typeof call.decoded?.args[0] === "string" &&
                call.decoded.args[0].toLowerCase() === market.market.toLowerCase(),
              ),
            ),
          )
          .flatMap((market) => (market.underlying ? [market.underlying] : [])),
        evidence: [
          {
            type: "CONTRACT_CALL",
            chainId: ETHEREUM_CHAIN_ID,
            method: "getProposalData",
          },
        ],
      });
      cache.change = indexed.change;
    }
    return cache.change;
  }

  async function inventory() {
    const resolved = await anchor();
    const [held, listed] = await Promise.all([positions(), adapter.listMarkets(resolved)]);
    const comptroller = getMoonwellBaseComptroller() as Address;
    const balances = new Map<string, bigint>();
    for (const market of listed) {
      if (!market.underlying) continue;
      balances.set(
        market.underlying.toLowerCase(),
        await readTokenBalance({
          client: reader,
          token: market.underlying,
          wallet: input.wallet,
          blockNumber: resolved.blockNumber,
        }),
      );
    }
    const constraints = new Map();
    for (const market of listed) {
      constraints.set(
        market.market.toLowerCase(),
        await readMarketConstraints({
          client: reader,
          comptroller,
          market: market.market,
          blockNumber: resolved.blockNumber,
        }),
      );
    }
    const prices = await readOraclePrices({
      client: reader,
      comptroller,
      markets: listed.map((market) => market.market),
      blockNumber: resolved.blockNumber,
    });
    return {
      repay: assessRepayFeasibility({ positions: held, balances, prices, policy }),
      addCollateral: assessAddCollateralFeasibility({
        positions: held,
        markets: listed,
        balances,
        constraints,
        prices,
        policy,
      }),
    };
  }

  async function comparison(): Promise<StrategyComparison> {
    if (!input.config.BASE_RPC_URL) {
      throw new ForkError("INVALID_CONFIG", "BASE_RPC_URL is required for strategy search");
    }
    cache.comparison ??= await comparePinnedStrategies({
      ethereum,
      baseRpcUrl: input.config.BASE_RPC_URL,
      wallet: input.wallet,
      policy,
      maxProbes: 40,
      raiseBufferToForceSearch: input.forceSearchBuffer ?? false,
    });
    return cache.comparison;
  }

  return {
    async execute(call: AuthorizedToolCall): Promise<unknown> {
      switch (call.name) {
        case "get_wallet_positions": {
          const [held, state] = await Promise.all([positions(), risk()]);
          return toJsonSafe({
            wallet: input.wallet,
            positions: held.map((position) => ({
              market: position.market,
              underlying: position.underlying,
              suppliedRaw: position.suppliedRaw,
              borrowedRaw: position.borrowedRaw,
              collateralEnabled: position.collateralEnabled,
              metadata: wrapUntrusted("token-metadata", position.metadata),
            })),
            risk: {
              status: state.status,
              liquidityRaw: state.liquidityRaw,
              shortfallRaw: state.shortfallRaw,
              blockNumber: state.anchor.blockNumber,
              blockHash: state.anchor.blockHash,
            },
          });
        }
        case "get_change_details": {
          const protocolChange = await change();
          return toJsonSafe({
            id: protocolChange.id,
            proposalId: protocolChange.proposalId,
            type: protocolChange.type,
            status: protocolChange.status,
            supportLevel: protocolChange.supportLevel,
            affectedMarkets: protocolChange.affectedMarkets,
            affectedAssets: protocolChange.affectedAssets,
            targetCalls: protocolChange.targetCalls.map((item) => ({
              target: item.target,
              selector: item.selector,
              functionName: item.decoded?.functionName,
              args: wrapUntrusted("decoded-call-args", item.decoded?.args ?? []),
            })),
          });
        }
        case "get_exposure":
          return toJsonSafe(await matchMoonwellExposure(await positions(), await change()));
        case "run_impact_simulation": {
          if (!input.config.BASE_RPC_URL) {
            throw new ForkError("INVALID_CONFIG", "BASE_RPC_URL is required for impact simulation");
          }
          if (!cache.impact) {
            const receipt = await replayPinnedCollateralFactor({
              ethereum,
              baseRpcUrl: input.config.BASE_RPC_URL,
              wallet: input.wallet,
            });
            cache.impact = {
              replayGrade: receipt.replayGrade,
              proposalId: receipt.proposalId,
              before: {
                collateralFactorMantissa: receipt.before.collateralFactorMantissa,
                liquidityRaw: receipt.before.risk.liquidityRaw,
                shortfallRaw: receipt.before.risk.shortfallRaw,
                status: receipt.before.risk.status,
              },
              after: {
                collateralFactorMantissa: receipt.after.collateralFactorMantissa,
                liquidityRaw: receipt.after.risk.liquidityRaw,
                shortfallRaw: receipt.after.risk.shortfallRaw,
                status: receipt.after.risk.status,
              },
              liquidityDeltaRaw: receipt.liquidityDeltaRaw,
              materialRisk: receipt.materialRisk,
              exposure: receipt.exposure,
              policyEvaluation: receipt.policyEvaluation,
            };
          }
          return toJsonSafe(cache.impact);
        }
        case "list_available_rescue_assets":
          return toJsonSafe(await inventory());
        case "optimize_repayment":
          return toJsonSafe(summarizeStrategy((await comparison()).repay));
        case "optimize_add_collateral":
          return toJsonSafe(summarizeStrategy((await comparison()).addCollateral));
        case "get_verified_strategies":
          if (!cache.comparison) {
            return { repay: null, addCollateral: null, note: "NO_STRATEGY_SEARCH_YET" };
          }
          return toJsonSafe({
            repay: summarizeStrategy(cache.comparison.repay),
            addCollateral: summarizeStrategy(cache.comparison.addCollateral),
          });
        case "compare_verified_strategies": {
          const result = await comparison();
          return toJsonSafe({
            wallet: result.wallet,
            changeOnlyPassed: result.changeOnlyPassed,
            repay: summarizeStrategy(result.repay),
            addCollateral: summarizeStrategy(result.addCollateral),
          });
        }
        default:
          throw new ForkError("GROQ_INVALID_TOOL_CALL", "Unhandled allowlisted tool");
      }
    },
  };
}

function summarizeStrategy(result: StrategySearchResult) {
  return {
    strategyType: result.strategyType,
    status: result.status,
    amountRaw: result.amountRaw,
    boundRaw: result.boundRaw,
    reasons: result.reasons,
    probes: result.probes,
  };
}
