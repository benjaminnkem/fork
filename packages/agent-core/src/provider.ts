import { ForkError } from "@fork/shared";

export interface ProviderToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  tools: ProviderToolSpec[];
  temperature: number;
  maxCompletionTokens: number;
  reasoningEffort: "low" | "medium" | "high";
  includeReasoning: boolean;
}

export interface ProviderResponse {
  model: string;
  content: string | null;
  toolCalls: ProviderToolCall[];
  finishReason: string | null;
}

export interface ModelProvider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof ForkError && error.code === "GROQ_UNAVAILABLE") return true;
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: number; statusCode?: number; message?: string };
  const status = record.status ?? record.statusCode;
  if (status === 401 || status === 403) return true;
  return typeof record.message === "string" && /invalid api key|unauthorized|forbidden/i.test(record.message);
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof ForkError && error.code === "GROQ_RATE_LIMITED") return true;
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: number; statusCode?: number; message?: string };
  if (record.status === 429 || record.statusCode === 429) return true;
  return typeof record.message === "string" && /rate limit|429/i.test(record.message);
}

export function isTransientProviderError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: number; statusCode?: number };
  const status = record.status ?? record.statusCode;
  return status === 500 || status === 502 || status === 503 || status === 504;
}

export class ScriptedModelProvider implements ModelProvider {
  private index = 0;

  constructor(
    private readonly steps: Array<
      | ProviderResponse
      | { error: "rate_limit" | "unavailable" | "auth" }
    >,
  ) {}

  async complete(_request: ProviderRequest): Promise<ProviderResponse> {
    void _request;
    const step = this.steps[this.index];
    this.index += 1;
    if (!step) {
      return { model: "scripted", content: "No further scripted steps.", toolCalls: [], finishReason: "stop" };
    }
    if ("error" in step) {
      if (step.error === "auth") {
        throw new ForkError("GROQ_UNAVAILABLE", "scripted invalid key", { retryable: false });
      }
      if (step.error === "rate_limit") {
        throw new ForkError("GROQ_RATE_LIMITED", "scripted rate limit", { retryable: true });
      }
      throw new ForkError("GROQ_RATE_LIMITED", "scripted provider unavailable", { retryable: true });
    }
    return step;
  }
}
