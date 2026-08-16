import type { AppConfig } from "@fork/config";
import { ForkError, type Address } from "@fork/shared";
import { GROQ_FALLBACK_MODEL, GROQ_PLANNER_MODEL } from "./names.js";
import { authorizeToolCall, callFingerprint } from "./policy.js";
import { AGENT_SYSTEM_PROMPT } from "./prompt.js";
import type { ModelProvider, ProviderMessage, ProviderResponse } from "./provider.js";
import { isTransientProviderError } from "./provider.js";
import type { AgentSession } from "./session.js";
import {
  sanitizeUserText,
  type AgentTraceEvent,
} from "./trace.js";
import { TOOL_SPECS } from "./tools.js";

export interface AgentRequest {
  wallet: Address;
  prompt: string;
  scenario?: string;
}

export interface AgentResult {
  status: "COMPLETED" | "FAILED";
  userSummary: string | null;
  model: string | null;
  toolNames: string[];
  traces: AgentTraceEvent[];
  reasons: string[];
}

export async function runAgent(input: {
  provider: ModelProvider;
  session: AgentSession;
  config: AppConfig;
  request: AgentRequest;
  now?: () => number;
}): Promise<AgentResult> {
  const traces: AgentTraceEvent[] = [];
  const toolNames: string[] = [];
  const started = (input.now ?? Date.now)();
  const deadline = started + input.config.AGENT_TIMEOUT_MS;
  const includeReasoning =
    input.config.AGENT_INCLUDE_REASONING &&
    input.config.APP_ENV !== "production" &&
    input.config.NODE_ENV !== "production";

  const messages: ProviderMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Scenario: ${input.request.scenario ?? "moonwell-176"}`,
        `Session wallet: ${input.request.wallet}`,
        "User request:",
        input.request.prompt,
      ].join("\n"),
    },
  ];

  let model = input.config.GROQ_PLANNER_MODEL || GROQ_PLANNER_MODEL;
  const fallback = input.config.GROQ_FALLBACK_MODEL || GROQ_FALLBACK_MODEL;
  let usedFallback = false;
  const invalidCounts = new Map<string, number>();
  let invalidTotal = 0;

  traces.push({
    type: "OBSERVATION",
    summary: `Investigate ${input.request.wallet} for ${input.request.scenario ?? "moonwell-176"}`,
  });

  for (let step = 0; step < input.config.AGENT_MAX_STEPS; step += 1) {
    if ((input.now ?? Date.now)() > deadline) {
      traces.push({ type: "FAILED", summary: "AGENT_TIMEOUT" });
      return fail(traces, toolNames, ["AGENT_TIMEOUT"]);
    }

    let response: ProviderResponse & { switchedToFallback: boolean };
    try {
      response = await completeWithFallback({
        provider: input.provider,
        model,
        fallback,
        usedFallback,
        request: {
          model,
          messages,
          tools: TOOL_SPECS,
          temperature: 0.2,
          maxCompletionTokens: input.config.AGENT_MAX_COMPLETION_TOKENS,
          reasoningEffort: input.config.AGENT_REASONING_EFFORT,
          includeReasoning,
        },
      });
      if (response.switchedToFallback && !usedFallback) {
        usedFallback = true;
        model = fallback;
        traces.push({
          type: "MODEL_FALLBACK",
          summary: `Fell back from ${input.config.GROQ_PLANNER_MODEL} to ${fallback}`,
        });
      }
    } catch (error) {
      const reason =
        error instanceof ForkError && error.code === "GROQ_UNAVAILABLE"
          ? "GROQ_UNAVAILABLE"
          : "BOTH_MODELS_FAILED";
      traces.push({ type: "FAILED", summary: reason });
      return fail(traces, toolNames, [reason]);
    }

    if (response.toolCalls.length === 0) {
      const summary = sanitizeUserText(response.content ?? "");
      traces.push({ type: "DECISION_SUMMARY", summary: summary || "Model returned an empty summary" });
      traces.push({ type: "FINAL_SELECTION", summary: summary || "No strategy selected" });
      return {
        status: "COMPLETED",
        userSummary: summary || "The agent finished without a user-safe summary.",
        model: response.model,
        toolNames,
        traces,
        reasons: ["COMPLETED"],
      };
    }

    messages.push({
      role: "assistant",
      content: response.content,
      tool_calls: response.toolCalls,
    });

    for (const call of response.toolCalls) {
      toolNames.push(call.function.name);
      traces.push({
        type: "TOOL_CALL",
        toolName: call.function.name,
        summary: `Requested ${call.function.name}`,
      });
      try {
        const authorized = authorizeToolCall({
          name: call.function.name,
          rawArguments: call.function.arguments,
          sessionWallet: input.request.wallet,
        });
        const fingerprint = callFingerprint(authorized.name, authorized.args);
        if ((invalidCounts.get(fingerprint) ?? 0) >= 2) {
          throw new ForkError("GROQ_INVALID_TOOL_CALL", "Repeated invalid tool call blocked");
        }
        const result = await input.session.execute(authorized);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: authorized.name,
          content: JSON.stringify(result),
        });
        traces.push({
          type: "TOOL_RESULT",
          toolName: authorized.name,
          ok: true,
          summary: summarizeToolResult(authorized.name, result),
        });
        recordStrategyTrace(traces, authorized.name, result);
      } catch (error) {
        invalidTotal += 1;
        const fingerprint = callFingerprint(call.function.name, call.function.arguments);
        invalidCounts.set(fingerprint, (invalidCounts.get(fingerprint) ?? 0) + 1);
        const message = error instanceof ForkError ? error.message : String(error);
        traces.push({
          type: "TOOL_REJECTED",
          toolName: call.function.name,
          ok: false,
          summary: message,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify({ error: message }),
        });
        if (invalidTotal >= input.config.AGENT_MAX_INVALID_CALLS) {
          traces.push({ type: "FAILED", summary: "TOO_MANY_INVALID_TOOL_CALLS" });
          return fail(traces, toolNames, ["TOO_MANY_INVALID_TOOL_CALLS"]);
        }
      }
    }
  }

  traces.push({ type: "FAILED", summary: "MAX_STEPS_REACHED" });
  return fail(traces, toolNames, ["MAX_STEPS_REACHED"]);
}

async function completeWithFallback(input: {
  provider: ModelProvider;
  model: string;
  fallback: string;
  usedFallback: boolean;
  request: Parameters<ModelProvider["complete"]>[0];
}): Promise<ProviderResponse & { switchedToFallback: boolean }> {
  try {
    const response = await input.provider.complete({ ...input.request, model: input.model });
    return { ...response, switchedToFallback: false };
  } catch (error) {
    if (!isTransientProviderError(error) && !(error instanceof ForkError && error.retryable)) {
      throw error;
    }
    if (input.usedFallback || input.fallback === input.model) {
      throw error;
    }
    const response = await input.provider.complete({ ...input.request, model: input.fallback });
    return { ...response, switchedToFallback: true };
  }
}

function fail(traces: AgentTraceEvent[], toolNames: string[], reasons: string[]): AgentResult {
  return {
    status: "FAILED",
    userSummary: null,
    model: null,
    toolNames,
    traces,
    reasons,
  };
}

function summarizeToolResult(name: string, result: unknown): string {
  if (!result || typeof result !== "object") return `${name} returned`;
  const record = result as Record<string, unknown>;
  if (typeof record.status === "string") return `${name} status ${record.status}`;
  if (record.risk && typeof record.risk === "object") {
    const risk = record.risk as Record<string, unknown>;
    return `${name} risk ${String(risk.status ?? "unknown")}`;
  }
  return `${name} returned structured data`;
}

function recordStrategyTrace(traces: AgentTraceEvent[], name: string, result: unknown): void {
  if (name !== "optimize_repayment" && name !== "optimize_add_collateral" && name !== "compare_verified_strategies") {
    return;
  }
  const record = result as Record<string, unknown>;
  const items = [record, record.repay, record.addCollateral].filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  for (const item of items) {
    if (item.status === "VERIFIED") {
      traces.push({
        type: "STRATEGY_VERIFIED",
        summary: `${String(item.strategyType ?? "strategy")} verified at ${String(item.amountRaw)}`,
      });
    }
    if (item.status === "INFEASIBLE" || item.status === "REJECTED") {
      traces.push({
        type: "STRATEGY_REJECTED",
        summary: `${String(item.strategyType ?? "strategy")} ${String(item.status)}`,
      });
    }
  }
}
