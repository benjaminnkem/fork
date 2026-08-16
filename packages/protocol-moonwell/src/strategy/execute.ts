import { moonwellComptrollerAbi, moonwellMTokenAbi } from "@fork/abis";
import { evaluatePolicy, type PolicyEvaluation } from "@fork/risk-engine";
import {
  impersonateAndFund,
  impersonateForGas,
  sendImpersonatedCall,
  type AnvilInstance,
  type SimulatedCallRecord,
} from "@fork/simulation-core";
import type { TransactionPlan } from "@fork/strategy-engine";
import {
  BASE_CHAIN_ID,
  type Address,
  type BlockAnchor,
  type Hex,
  type RiskState,
  type UserRiskPolicy,
} from "@fork/shared";
import { decodeFunctionResult } from "viem";
import {
  ALLOWLIST_ENTER_MARKETS,
  ALLOWLIST_MTOKEN_MINT,
  ALLOWLIST_MTOKEN_REPAY_BORROW,
  type PlannedCall,
} from "@fork/strategy-engine";
import type { MoonwellAdapter } from "../adapter.js";
import { readBorrowValueRaw, withDerivedBuffer } from "./oracle.js";

export interface BranchExecution {
  calls: SimulatedCallRecord[];
  allSucceeded: boolean;
  risk: RiskState;
  policyEvaluation: PolicyEvaluation;
  reasons: string[];
}

export async function applyDestinationCall(
  anvil: AnvilInstance,
  from: Address,
  to: Address,
  data: Hex,
  value: bigint,
): Promise<SimulatedCallRecord> {
  await impersonateAndFund(anvil, from, "DESTINATION_EFFECT_REPLAY authorized Temporal Governor");
  return sendImpersonatedCall(anvil, from, to, data, value);
}

export async function executePlanCalls(
  anvil: AnvilInstance,
  wallet: Address,
  plan: TransactionPlan,
): Promise<{ calls: SimulatedCallRecord[]; reasons: string[] }> {
  await impersonateForGas(anvil, wallet, "strategy search user impersonation for gas only");
  const calls: SimulatedCallRecord[] = [];
  const reasons: string[] = [];

  for (const planned of plan.calls) {
    const preview = await previewCall(anvil, wallet, planned);
    if (!preview.ok) {
      reasons.push(preview.reason);
      calls.push({
        to: planned.to,
        data: planned.data,
        value: planned.value.toString(),
        from: wallet,
        success: false,
        error: preview.reason,
      });
      return { calls, reasons };
    }
    const sent = await sendImpersonatedCall(anvil, wallet, planned.to, planned.data, planned.value);
    if (!sent.success) {
      reasons.push(sent.error ?? "strategy transaction reverted");
      calls.push(sent);
      return { calls, reasons };
    }
    calls.push(sent);
  }
  return { calls, reasons };
}

export async function readEnrichedRisk(
  adapter: MoonwellAdapter,
  client: { readContract: (args: object) => Promise<unknown> },
  comptroller: Address,
  wallet: Address,
  anchor: BlockAnchor,
): Promise<RiskState> {
  const [risk, positions] = await Promise.all([
    adapter.getRiskState(wallet, anchor),
    adapter.getUserPositions(wallet, anchor),
  ]);
  const borrowValueRaw = await readBorrowValueRaw({
    client,
    comptroller,
    positions,
    blockNumber: anchor.blockNumber,
  });
  return withDerivedBuffer(risk, borrowValueRaw);
}

export async function verifyExecutedPlan(input: {
  adapter: MoonwellAdapter;
  client: { readContract: (args: object) => Promise<unknown> };
  anvil: AnvilInstance;
  comptroller: Address;
  wallet: Address;
  plan: TransactionPlan;
  policy: UserRiskPolicy;
  destination: { from: Address; to: Address; data: Hex; value: bigint };
}): Promise<BranchExecution> {
  const executed = await executePlanCalls(input.anvil, input.wallet, input.plan);
  if (executed.reasons.length > 0) {
    const latest = await latestAnchor(input.anvil);
    const risk = await readEnrichedRisk(
      input.adapter,
      input.client,
      input.comptroller,
      input.wallet,
      latest,
    );
    return {
      calls: executed.calls,
      allSucceeded: false,
      risk,
      policyEvaluation: evaluatePolicy(risk, input.policy),
      reasons: executed.reasons,
    };
  }

  const destination = await applyDestinationCall(
    input.anvil,
    input.destination.from,
    input.destination.to,
    input.destination.data,
    input.destination.value,
  );
  if (!destination.success) {
    const latest = await latestAnchor(input.anvil);
    const risk = await readEnrichedRisk(
      input.adapter,
      input.client,
      input.comptroller,
      input.wallet,
      latest,
    );
    return {
      calls: [...executed.calls, destination],
      allSucceeded: false,
      risk,
      policyEvaluation: evaluatePolicy(risk, input.policy),
      reasons: [destination.error ?? "destination effect reverted"],
    };
  }

  const latest = await latestAnchor(input.anvil);
  const risk = await readEnrichedRisk(
    input.adapter,
    input.client,
    input.comptroller,
    input.wallet,
    latest,
  );
  const policyEvaluation = evaluatePolicy(risk, input.policy);
  const reasons = [...policyEvaluation.reasons];
  if (risk.shortfallRaw > BigInt(input.plan.expectedState.maxShortfallRaw)) {
    reasons.push("SHORTFALL_ABOVE_EXPECTED");
  }
  return {
    calls: [...executed.calls, destination],
    allSucceeded: true,
    risk,
    policyEvaluation,
    reasons: policyEvaluation.passed && !reasons.includes("SHORTFALL_ABOVE_EXPECTED")
      ? ["POLICY_PASSED"]
      : reasons.filter((item) => item !== "POLICY_PASSED"),
  };
}

async function latestAnchor(anvil: AnvilInstance): Promise<BlockAnchor> {
  const latest = await anvil.client.getBlock({ blockTag: "latest" });
  if (!latest.hash) {
    throw new Error("Anvil latest block is missing a hash");
  }
  return {
    chainId: BASE_CHAIN_ID,
    blockNumber: latest.number,
    blockHash: latest.hash,
    timestamp: Number(latest.timestamp),
    finality: "latest",
    rpcProviderId: "anvil-fork",
  };
}

async function previewCall(
  anvil: AnvilInstance,
  from: Address,
  planned: PlannedCall,
): Promise<{ ok: boolean; reason: string }> {
  try {
    const result = await anvil.client.call({ account: from, to: planned.to, data: planned.data });
    const payload = result.data;
    if (!payload || payload === "0x") return { ok: true, reason: "ok" };
    if (
      planned.allowlistRuleId === ALLOWLIST_MTOKEN_REPAY_BORROW ||
      planned.allowlistRuleId === ALLOWLIST_MTOKEN_MINT
    ) {
      const decoded = decodeFunctionResult({
        abi: moonwellMTokenAbi,
        functionName:
          planned.allowlistRuleId === ALLOWLIST_MTOKEN_REPAY_BORROW ? "repayBorrow" : "mint",
        data: payload,
      });
      if (decoded !== 0n) {
        return { ok: false, reason: `mtoken_error_${decoded.toString()}` };
      }
    }
    if (planned.allowlistRuleId === ALLOWLIST_ENTER_MARKETS) {
      const decoded = decodeFunctionResult({
        abi: moonwellComptrollerAbi,
        functionName: "enterMarkets",
        data: payload,
      });
      if (decoded.some((code) => code !== 0n)) {
        return { ok: false, reason: `enter_markets_error_${decoded.join(",")}` };
      }
    }
    return { ok: true, reason: "ok" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
